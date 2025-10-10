// heic2jpg.js
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const heicConvert = require("heic-convert");
const chokidar = require("chokidar");

// ---- CLI args simples ----
function getArg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const inputDir = path.resolve(getArg("-i", "."));                   // pasta de entrada
const outputDir = path.resolve(getArg("-o", path.join(inputDir, "jpg"))); // pasta de saída
const watchMode = process.argv.includes("-w") || process.argv.includes("--watch");
const quality = Math.max(0.1, Math.min(1, Number(getArg("-q", "0.9"))));  // 0.1..1

// ---- utilitários ----
async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function uniquePath(p) {
  const { dir, name, ext } = path.parse(p);
  let i = 1;
  let candidate = p;
  while (true) {
    try {
      await fsp.access(candidate);
      candidate = path.join(dir, `${name}-${i}${ext}`);
      i++;
    } catch {
      return candidate;
    }
  }
}

async function convertFile(filePath) {
  try {
    const base = path.parse(filePath).name;
    const outBase = path.join(outputDir, `${base}.jpg`);
    const outPath = await uniquePath(outBase);

    const input = await fsp.readFile(filePath);
    const output = await heicConvert({
      buffer: input,
      format: "JPEG",
      quality, // 0.1..1
    });

    await fsp.writeFile(outPath, output);
    console.log(`✔ ${path.basename(filePath)} → ${path.basename(outPath)}`);
  } catch (err) {
    console.error(`✖ Falha em ${filePath}:`, err.message);
  }
}

async function listHeics(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries
    .filter((d) => d.isFile() && /\.heic$/i.test(d.name))
    .map((d) => path.join(dir, d.name));
}

async function convertAll(dir) {
  const files = await listHeics(dir);
  if (files.length === 0) {
    console.log("Nenhum .heic encontrado.");
    return;
  }
  // Limite simples de concorrência para não estourar memória
  const limit = 4;
  let idx = 0, active = 0;

  await new Promise((resolve) => {
    function next() {
      if (idx >= files.length && active === 0) return resolve();
      while (active < limit && idx < files.length) {
        const f = files[idx++];
        active++;
        convertFile(f).finally(() => {
          active--;
          next();
        });
      }
    }
    next();
  });
}

(async () => {
  await ensureDir(outputDir);

  if (watchMode) {
    await convertAll(inputDir);
    console.log(`👀 Observando novas imagens .heic em: ${inputDir}`);
    const watcher = chokidar.watch(inputDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });
    watcher.on("add", (p) => {
      if (/\.heic$/i.test(p)) convertFile(p);
    });
  } else {
    await convertAll(inputDir);
  }
})();