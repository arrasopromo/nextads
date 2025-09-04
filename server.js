const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const crypto = require('crypto');
const heicConvert = require('heic-convert');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4001;

// Configuração dos proxies HTTP
const PROXIES = [
    {
        host: 'server.sixproxy.com',
        port: 24654,
        auth: {
            username: '275a97be4dc7',
            password: '28c0f08822a6'
        }
    },
    {
        host: 'server.sixproxy.com',
        port: 24654,
        auth: {
            username: '4315b5249d9c',
            password: '20e07229f661'
        }
    },
    {
        host: 'server.sixproxy.com',
        port: 24654,
        auth: {
            username: '8e23eea78993',
            password: 'c24e7ff91b12'
        }
    }
];

// Configuração da Evolution API
const EVOLUTION_CONFIG = {
    baseURL: 'https://evolutionapi.atendimento.info',
    instance: 'turbine',
    apiKey: process.env.EVOLUTION_API_KEY || '' // Adicionar suporte para API key se necessário
};

// Função para testar conectividade com Evolution API
async function testEvolutionAPI() {
    try {
        const response = await axios.get(`${EVOLUTION_CONFIG.baseURL}/instance/fetchInstances`, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(EVOLUTION_CONFIG.apiKey && { 'apikey': EVOLUTION_CONFIG.apiKey })
            },
            timeout: 10000
        });
        
        return response.data;
    } catch (error) {
        console.error('❌ Erro ao acessar Evolution API:', error.message);
        if (error.response) {
            console.error('📊 Status:', error.response.status);
            console.error('📄 Dados:', error.response.data);
        }
        return null;
    }
}

// Estado dos proxies (para rotação e controle de falhas)
let proxyIndex = 0;
let proxyFailures = new Map(); // Rastreia falhas por proxy

// Função para obter o próximo proxy disponível
function getNextProxy() {
    const maxRetries = PROXIES.length;
    let attempts = 0;
    
    while (attempts < maxRetries) {
        const proxy = PROXIES[proxyIndex];
        const proxyKey = `${proxy.host}:${proxy.port}:${proxy.auth.username}`;
        
        // Verifica se o proxy não teve muitas falhas recentes
        const failures = proxyFailures.get(proxyKey) || 0;
        if (failures < 3) {
            proxyIndex = (proxyIndex + 1) % PROXIES.length;
            return proxy;
        }
        
        proxyIndex = (proxyIndex + 1) % PROXIES.length;
        attempts++;
    }
    
    // Se todos os proxies falharam, reseta os contadores e tenta novamente
    proxyFailures.clear();
    return PROXIES[0];
}

// Função para marcar falha de proxy
function markProxyFailure(proxy) {
    const proxyKey = `${proxy.host}:${proxy.port}:${proxy.auth.username}`;
    const currentFailures = proxyFailures.get(proxyKey) || 0;
    proxyFailures.set(proxyKey, currentFailures + 1);
    
    console.log(`❌ Proxy ${proxyKey} falhou. Total de falhas: ${currentFailures + 1}`);
}

// Função para criar agente proxy
function createProxyAgent(proxy) {
    const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
    return new HttpsProxyAgent(proxyUrl);
}

// Função para fazer requisição com redundância de proxy
async function makeRequestWithProxy(config, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const proxy = getNextProxy();
        const proxyAgent = createProxyAgent(proxy);
        
        try {
            console.log(`🔄 Tentativa ${attempt + 1} com proxy ${proxy.host}:${proxy.port}`);
            
            const response = await axios({
                ...config,
                httpsAgent: proxyAgent,
                timeout: 15000
            });
            
            console.log(`✅ Sucesso com proxy ${proxy.host}:${proxy.port}`);
            return response;
            
        } catch (error) {
            console.log(`❌ Falha com proxy ${proxy.host}:${proxy.port}:`, error.message);
            markProxyFailure(proxy);
            lastError = error;
            
            // Se não é erro de rede, não tenta outros proxies
            if (error.response && error.response.status < 500) {
                throw error;
            }
        }
    }
    
    throw lastError;
}

// Middleware de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            mediaSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://api.instagram.com", "https://graph.instagram.com", "https://api.openai.com", "https://api.openpix.com.br", "https://api.woovi-sandbox.com", "https://api.woovi.com"]
        }
    }
}));

// Middleware básico
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Middleware de log para todas as requisições
app.use((req, res, next) => {
    console.log(`🌐 [REQUEST] ${req.method} ${req.url}`);
    console.log(`📋 [REQUEST] Headers:`, req.headers);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`📦 [REQUEST] Body:`, req.body);
    }
    next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB para permitir vídeos grandes, validação específica será feita na rota
    },
    fileFilter: (req, file, cb) => {
        console.log('🔍 Validando arquivo no servidor:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            fieldname: file.fieldname,
            size: file.size
        });
        
        // Obter extensão do arquivo
        const fileExtension = path.extname(file.originalname).toLowerCase();
        console.log('📁 Extensão do arquivo:', fileExtension);
        
        // Lista de extensões permitidas
        const imageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.heic', '.webp', '.dng'];
        const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.3gp', '.mkv', '.ts'];
        const allowedExtensions = [...imageExtensions, ...videoExtensions];
        
        // Verificar se a extensão está na lista permitida
        const isAllowedExtension = allowedExtensions.includes(fileExtension);
        const isImage = imageExtensions.includes(fileExtension);
        const isVideo = videoExtensions.includes(fileExtension);
        
        console.log('📊 Resultados da validação:', {
            fileExtension,
            isAllowedExtension,
            isImage,
            isVideo,
            allowedExtensions
        });
        
        if (isAllowedExtension) {
            console.log('✅ Arquivo aceito pela extensão');
            return cb(null, true);
        } else {
            console.log('❌ Arquivo rejeitado - extensão não permitida');
            cb(new Error('Apenas imagens (JPEG, PNG, GIF, HEIC, WebP, DNG) e vídeos (MP4, MOV, AVI, WEBM, 3GP, MKV, TS) são permitidos!'));
        }
    }
});

// Função para baixar e salvar imagens de perfil localmente
async function downloadAndSaveProfileImage(imageUrl, phoneNumber) {
    try {
        // Baixando imagem de perfil
        
        // Criar diretório para fotos de perfil se não existir
        const profilePicsDir = path.join(__dirname, 'uploads', 'profile-pics');
        if (!fs.existsSync(profilePicsDir)) {
            fs.mkdirSync(profilePicsDir, { recursive: true });
            // Diretório de fotos de perfil criado
        }
        
        // Gerar nome único para o arquivo baseado no número de telefone
        const timestamp = Date.now();
        const fileName = `whatsapp_${phoneNumber}_${timestamp}.jpg`;
        const filePath = path.join(profilePicsDir, fileName);
        
        // Baixar a imagem
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000
        });
        
        // Salvar a imagem no disco
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                // Retornar URL local para servir a imagem
                const localUrl = `/uploads/profile-pics/${fileName}`;
                resolve(localUrl);
            });
            
            writer.on('error', (error) => {
                reject(error);
            });
        });
        
    } catch (error) {
        throw error;
    }
}

// Sistema de rotação de cookies e User-Agents para Instagram
const instagramCookies = [
    {
        sessionid: '75489726402%3ACUJhdJ38edxkRv%3A3%3AAYf_hsoLAWpupEVhvCQ_fjLSMQWh_mdLdOmudtO6hw',
        ds_user_id: '75489726402'
    },
    {
        sessionid: '54810149178%3A0hQvZt9j3tl8ZK%3A16%3AAYf3WuDYSdfocroW0rzUTm524GvuXpPBSaD8Ah32TQ',
        ds_user_id: '54810149178'
    },
    {
        sessionid: '67441971128%3A7bdCVxtkoZWrmb%3A26%3AAYfVQrA3L6qDzqkB4cOiPMU5UVB_eeEo-0m4Od_f2w',
        ds_user_id: '67441971128'
    },
    {
        sessionid: '58223294440%3AxqRau7fIa2iVfG%3A27%3AAYcknIRr4Th7ZmilnMFhEH44bHDfmIPcA3mSGToaFA',
        ds_user_id: '58223294440'
    },
    {
        sessionid: '58145436541%3AuGb60d7VPJnZ8n%3A17%3AAYf9C8VJO2mfZ0525pqCgOsFk4FFyvftezJE6boqBw',
        ds_user_id: '58145436541'
    }
];

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

let currentCookieIndex = 0;
let currentUserAgentIndex = 0;

function getNextCookie() {
    const cookie = instagramCookies[currentCookieIndex];
    currentCookieIndex = (currentCookieIndex + 1) % instagramCookies.length;
    return cookie;
}

function getNextUserAgent() {
    const userAgent = userAgents[currentUserAgentIndex];
    currentUserAgentIndex = (currentUserAgentIndex + 1) % userAgents.length;
    return userAgent;
}

// API para validação de perfil do Instagram com proxies
app.post('/api/validate-instagram', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Nome de usuário é obrigatório' });
        }

        // Remove @ se presente
        const cleanUsername = username.replace('@', '');

        // Validando perfil Instagram
        
        // Obter cookie e user-agent para rotação
        const cookie = getNextCookie();
        const userAgent = getNextUserAgent();
        
        // Rotação de cookie
        // Rotação de UserAgent
        
        // URL da API do Instagram
        const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUsername}`;
        
        // Headers da requisição
        const headers = {
            'User-Agent': userAgent,
            'Cookie': `sessionid=${cookie.sessionid}; ds_user_id=${cookie.ds_user_id}`,
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': `https://www.instagram.com/${cleanUsername}/`,
            'Origin': 'https://www.instagram.com',
            'Accept': '*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
        };
        
        const requestConfig = {
            method: 'GET',
            url: apiUrl,
            headers: headers,
            validateStatus: function (status) {
                return status < 500;
            }
        };
        
        const response = await makeRequestWithProxy(requestConfig);
        
        if (response.status === 200 && response.data && response.data.data && response.data.data.user) {
            const userData = response.data.data.user;
            
            const profileData = {
                username: userData.username,
                full_name: userData.full_name || '',
                profile_pic_url: userData.profile_pic_url || '',
                profile_pic_url_hd: userData.profile_pic_url_hd || userData.profile_pic_url || '',
                follower_count: userData.edge_followed_by?.count || 0,
                following_count: userData.edge_follow?.count || 0,
                is_private: userData.is_private || false,
                is_verified: userData.is_verified || false,
                biography: userData.biography || ''
            };
            
            // Perfil Instagram validado
            console.log('🖼️ URLs de imagem encontradas:', {
                normal: profileData.profile_pic_url ? 'Sim' : 'Não',
                hd: profileData.profile_pic_url_hd ? 'Sim' : 'Não',
                url_normal: profileData.profile_pic_url,
                url_hd: profileData.profile_pic_url_hd
            });
            
            res.json({
                success: true,
                data: {
                    user: profileData
                }
            });
        } else {
            if (response.status === 404) {
                // Usuário não encontrado
                return res.status(404).json({ error: 'Usuário não encontrado' });
            } else if (response.status === 401 || response.status === 403) {
                // Erro de autenticação
                return res.status(401).json({ error: 'Erro de autenticação. Cookies podem estar expirados.' });
            } else {
                // Erro desconhecido
                return res.status(400).json({ error: 'Erro ao validar perfil' });
            }
        }
        
    } catch (error) {
        console.error('💥 Erro na validação Instagram:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para validar perfil do WhatsApp usando Evolution API
app.post('/api/validate-whatsapp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Número de telefone é obrigatório' });
        }
        
        // Limpa o número de telefone (remove caracteres especiais)
        const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
        
        // Adiciona código do país se não estiver presente
        const formattedNumber = cleanPhoneNumber.startsWith('55') ? cleanPhoneNumber : `55${cleanPhoneNumber}`;
        

        
        // Usar o endpoint correto baseado na resposta de sucesso fornecida
        const profileConfig = {
            method: 'POST',
            url: `${EVOLUTION_CONFIG.baseURL}/chat/whatsappNumbers/${EVOLUTION_CONFIG.instance}`,
            data: {
                numbers: [formattedNumber]
            },
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'apikey': EVOLUTION_CONFIG.apiKey
            },
            timeout: 15000
        };
        

        
        const profileResponse = await axios(profileConfig);
        

        
        // Verificar se a resposta tem o formato esperado
        if (!profileResponse.data || !Array.isArray(profileResponse.data) || profileResponse.data.length === 0) {
            return res.status(404).json({ error: 'Número não encontrado no WhatsApp' });
        }
        
        const numberData = profileResponse.data[0];
        
        // Verificar se o número existe no WhatsApp
        if (!numberData.exists) {
            return res.status(404).json({ error: 'Número não encontrado no WhatsApp' });
        }
        
        // Agora vamos buscar o perfil completo com a foto
        const profileUrl = `${EVOLUTION_CONFIG.baseURL}/chat/fetchProfile/${EVOLUTION_CONFIG.instance}`;
        const profileRequestData = {
            number: formattedNumber
        };
        

        
        const fullProfileResponse = await axios.post(profileUrl, profileRequestData, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_CONFIG.apiKey
            },
            timeout: 15000
        });
        

        
        const userData = fullProfileResponse.data;
        
        // Extrair informações do perfil
        const wuid = userData.wuid || numberData.jid || `${formattedNumber}@s.whatsapp.net`;
        const originalProfilePicUrl = userData.profilePictureUrl || userData.picture || '';
        
        // Baixar e salvar a imagem localmente
        let profilePicUrl = '';
        if (originalProfilePicUrl) {
            try {
                profilePicUrl = await downloadAndSaveProfileImage(originalProfilePicUrl, formattedNumber);
            } catch (error) {
                // Fallback para o proxy se o download falhar
                profilePicUrl = `/api/proxy-image?url=${encodeURIComponent(originalProfilePicUrl)}`;
            }
        }
        

        
        const profileData = {
            phoneNumber: formattedNumber,
            exists: true,
            profileName: '',
            profilePicUrl: profilePicUrl,
            originalProfilePicUrl: originalProfilePicUrl,
            status: 'Perfil encontrado',
            wuid: wuid
        };
        

        
        res.json(profileData);
        
    } catch (error) {
        console.error('❌ Erro ao validar perfil WhatsApp:', error.message);
        
        if (error.response) {
            console.error('📊 Status da resposta:', error.response.status);
            console.error('📋 Dados da resposta:', JSON.stringify(error.response.data, null, 2));
            console.error('🔗 URL da requisição:', error.config?.url);
            console.error('📤 Dados enviados:', JSON.stringify(error.config?.data, null, 2));
            
            const status = error.response.status;
            if (status === 404) {
                res.status(404).json({ 
                    error: 'Número não encontrado no WhatsApp',
                    details: 'O número fornecido não possui conta no WhatsApp'
                });
            } else if (status === 401) {
                res.status(401).json({ 
                    error: 'Erro de autenticação com Evolution API',
                    details: 'Verifique se a API Key está correta'
                });
            } else if (status === 429) {
                res.status(429).json({ 
                    error: 'Muitas tentativas. Aguarde um momento.',
                    details: 'Limite de requisições da API atingido'
                });
            } else if (status === 500) {
                res.status(500).json({ 
                    error: 'Erro interno da Evolution API',
                    details: 'Problema no servidor da Evolution API'
                });
            } else {
                res.status(500).json({ 
                    error: 'Erro ao acessar Evolution API',
                    details: `Status HTTP: ${status}`
                });
            }
        } else if (error.code === 'ECONNREFUSED') {
            res.status(503).json({ 
                error: 'Não foi possível conectar com a Evolution API',
                details: 'Verifique se a Evolution API está rodando'
            });
        } else if (error.code === 'ETIMEDOUT') {
            res.status(408).json({ 
                error: 'Timeout na requisição para Evolution API',
                details: 'A requisição demorou muito para responder'
            });
        } else {
            res.status(500).json({ 
                error: 'Erro de conexão com Evolution API',
                details: error.message
            });
        }
    }
});

// API para proxy de imagens (com logs detalhados)
// Proxy para imagens do WhatsApp (baixa e serve localmente)
app.get('/api/proxy-image', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'URL da imagem é obrigatória' });
        }
        
        // Baixando imagem do WhatsApp
        
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        

        
        // Definir headers apropriados
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Pipe da imagem para a resposta
        response.data.pipe(res);
        
    } catch (error) {
        
        if (error.code === 'ETIMEDOUT') {
            return res.status(408).json({ error: 'Timeout ao baixar imagem' });
        } else if (error.response && error.response.status === 404) {
            return res.status(404).json({ error: 'Imagem não encontrada' });
        } else if (error.response && error.response.status === 403) {
            return res.status(403).json({ error: 'Acesso negado à imagem' });
        }
        
        res.status(500).json({ error: 'Erro ao carregar imagem' });
    }
});

// Rota de teste para fetchProfile
app.post('/api/test-fetch-profile', async (req, res) => {
    const { number } = req.body;
    
    if (!number) {
        return res.status(400).json({ error: 'Número é obrigatório' });
    }
    
    try {
        console.log('🔍 Testando fetchProfile para:', number);
        
        const response = await axios.post(
            `${EVOLUTION_CONFIG.baseURL}/chat/fetchProfile/${EVOLUTION_CONFIG.instance}`,
            { number: number },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_CONFIG.apiKey
                },
                timeout: 30000
            }
        );
        
        console.log('📊 Resposta do fetchProfile:', JSON.stringify(response.data, null, 2));
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Erro ao testar fetchProfile:', error.message);
        
        if (error.response) {
            console.error('📊 Status da resposta:', error.response.status);
            console.error('📋 Dados da resposta:', JSON.stringify(error.response.data, null, 2));
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// API para obter municípios
app.get('/api/municipios', (req, res) => {
    try {
        // Ler arquivo com tratamento de BOM
        let rawData = fs.readFileSync(path.join(__dirname, 'municipios.json'), 'utf8');
        
        // Remover BOM se existir
        if (rawData.charCodeAt(0) === 0xFEFF) {
            rawData = rawData.slice(1);
        }
        
        // Remover caracteres invisíveis do início
        rawData = rawData.trim();
        
        const municipios = JSON.parse(rawData);
        res.json(municipios);
        
    } catch (error) {
        console.error('💥 Erro detalhado:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ error: 'Erro ao carregar dados de municípios' });
    }
});

// Lista de termos inadequados e filtros
const TERMOS_BLOQUEADOS = {
    nomesProprios: [
        'pedro', 'marcos', 'joão', 'maria', 'ana', 'carlos', 'josé', 'antonio', 'francisco',
        'paulo', 'adriana', 'juliana', 'fernando', 'ricardo', 'roberto', 'sandra', 'patricia',
        'daniel', 'rafael', 'lucas', 'gabriel', 'bruno', 'diego', 'felipe', 'gustavo',
        'leonardo', 'rodrigo', 'thiago', 'vinicius', 'andre', 'alexandre', 'eduardo',
        'marcelo', 'fabio', 'renato', 'sergio', 'claudio', 'mauricio', 'leandro'
    ],
    termosInadequados: [
        'teste', 'test', 'aaa', 'bbb', 'ccc', 'xxx', 'yyy', 'zzz', 'asdf', 'qwerty',
        '123', '456', '789', 'abc', 'def', 'ghi', 'jkl', 'mno', 'pqr', 'stu', 'vwx',
        'random', 'aleatorio', 'qualquer', 'nada', 'vazio', 'indefinido'
    ],
    apostasECassinos: [
        'apostas', 'aposta', 'cassino', 'cassinos', 'casino', 'casinos', 'slots', 'slot',
        'slot machine', 'slot machines', 'maquina caça-niquel', 'maquinas caça-niquel',
        'jogo de azar', 'jogos de azar', 'poker', 'blackjack', 'roleta', 'bingo',
        'loteria', 'loterias', 'bet', 'betting', 'gambling', 'caça-niquel', 'caça-niqueis',
        'fortune tiger', 'tigrinho', 'mines', 'aviator', 'spaceman', 'crash',
        'blaze', 'betano', 'bet365', 'sportingbet', 'pixbet', 'betfair'
    ],
    conteudoAdulto: [
        'adulto', 'sexual', 'sexo', 'nude', 'nudez', 'nua', 'nu', 'pelada', 'pelado',
        'encontros', 'encontro', 'acompanhante', 'acompanhantes', 'escort', 'escorts',
        'massagem tantrica', 'massagem erotica', 'strip', 'stripper', 'cam girl',
        'camgirl', 'webcam', 'onlyfans', 'privacy', 'hot', 'sensual', 'erotico',
        'erotica', 'pornografia', 'porno', 'xxx', 'swing', 'fetiche', 'bdsm',
        'dominatrix', 'prostituta', 'prostituto', 'garota de programa', 'michê',
        'nicho hot', 'produtora de conteudo +18', 'conteudo +18', '+18'
    ],
    satanismo: [
        'satanismo', 'satanista', 'satã', 'satan', 'satanas', 'diabo', 'demonio',
        'demônio', 'lucifer', 'belzebu', 'baphomet', 'anticristo', 'anti-cristo',
        'ocultismo', 'ocultista', 'magia negra', 'ritual satânico', 'ritual satanico',
        'invocação demoníaca', 'invocacao demoniaca', 'pentagrama invertido',
        'cruz invertida', 'missa negra', 'culto satânico', 'culto satanico',
        'adoração ao diabo', 'adoracao ao diabo', 'pacto com o diabo',
        'possessão demoníaca', 'possessao demoniaca', 'exorcismo', 'demônios',
        'demonios', 'entidades malignas', 'forças das trevas', 'forcas das trevas',
        'bruxaria', 'feitiçaria', 'feiticaria', 'necromancia', 'voodoo', 'vudu',
        'capeta', 'adoração ao capeta', 'adoracao ao capeta'
    ],
    palavrasVazias: [
        'a', 'o', 'e', 'de', 'da', 'do', 'em', 'um', 'uma', 'para', 'com', 'por',
        'na', 'no', 'ao', 'dos', 'das', 'se', 'que', 'ou', 'mas', 'como', 'quando'
    ]
};

// Função para extrair nicho principal de descrições longas
function extrairNichoPrincipal(texto) {
    if (!texto || typeof texto !== 'string') {
        return texto;
    }
    
    // Normalizar texto
    const textoLimpo = texto.toLowerCase().trim();
    
    // Palavras-chave que indicam profissões/nichos
    const indicadoresProfissao = [
        'sou', 'trabalho como', 'atuo como', 'profissional de', 'especialista em',
        'consultor', 'terapeuta', 'psicólogo', 'psicanalista', 'nutricionista',
        'personal trainer', 'coach', 'advogado', 'médico', 'dentista',
        'arquiteto', 'designer', 'desenvolvedor', 'programador', 'engenheiro'
    ];
    
    // Palavras-chave que indicam áreas de interesse/mercado
    const indicadoresArea = [
        'interessadas em', 'interessados em', 'que precisam de', 'que querem',
        'sessões de', 'consultas de', 'serviços de', 'produtos de',
        'relacionado a', 'área de', 'mercado de', 'nicho de'
    ];
    
    // Mapeamento de profissões para nichos
    const mapeamentoProfissoes = {
        'psicanalista': 'psicanálise',
        'psicologo': 'psicologia',
        'nutricionista': 'nutrição',
        'personal trainer': 'fitness',
        'personal': 'fitness',
        'trainer': 'fitness',
        'coach': 'coaching',
        'advogado': 'direito',
        'medico': 'medicina',
        'dentista': 'odontologia',
        'arquiteto': 'arquitetura',
        'designer': 'design',
        'desenvolvedor': 'tecnologia',
        'programador': 'tecnologia',
        'engenheiro': 'engenharia',
        'terapeuta': 'terapia',
        'consultor': 'consultoria'
    };
    
    // Tentar extrair nicho baseado em profissão mencionada
    for (const [profissao, nicho] of Object.entries(mapeamentoProfissoes)) {
        if (textoLimpo.includes(profissao)) {
            return nicho;
        }
    }
    
    // Tentar extrair nicho após indicadores de área
    for (const indicador of indicadoresArea) {
        const index = textoLimpo.indexOf(indicador);
        if (index !== -1) {
            const aposIndicador = textoLimpo.substring(index + indicador.length).trim();
            const palavras = aposIndicador.split(/\s+/);
            
            // Pegar as primeiras 1-3 palavras após o indicador
            const nicho = palavras.slice(0, 3).join(' ')
                .replace(/[^a-záàâãäéèêëíìîïóòôõöúùûüçñ\s-]/gi, '')
                .trim();
            
            if (nicho && nicho.length >= 3) {
                return nicho;
            }
        }
    }
    
    // Se não encontrou nada específico, verificar se o texto já é um nicho específico
    // Para textos como "Venda no atacado para lojas infantil", manter o texto completo
    const palavras = textoLimpo.split(/\s+/);
    
    // Se o texto tem palavras específicas de segmento/produto, manter o texto completo
    const palavrasEspecificas = ['infantil', 'fitness', 'fit', 'beleza', 'saúde', 'tecnologia', 'educação', 
                                'culinária', 'moda', 'esporte', 'música', 'arte', 'decoração',
                                'automóvel', 'imóvel', 'pet', 'viagem', 'fotografia', 'design',
                                'roupas', 'roupa', 'conteúdo', 'conteudo', 'criador', 'loja', 'lojas'];
    
    const temPalavraEspecifica = palavras.some(palavra => 
        palavrasEspecificas.includes(palavra) || 
        palavra.endsWith('ista') || 
        palavra.endsWith('ção') ||
        palavra.endsWith('ria')
    );
    
    // Se tem palavra específica de segmento, manter o texto completo
    if (temPalavraEspecifica) {
        return texto;
    }
    
    // Caso contrário, tentar extrair palavras-chave relevantes
    const palavrasRelevantes = palavras
        .filter(palavra => 
            palavra.length >= 4 && 
            !['sou', 'preciso', 'pessoas', 'interessadas', 'fazer', 'sessões', 
             'consultas', 'serviços', 'produtos', 'trabalho', 'como', 'que', 
             'para', 'com', 'uma', 'dos', 'das', 'este', 'esta', 'venda', 'vendas'].includes(palavra)
        );
    
    // Se encontrou palavras relevantes, retornar as principais (máximo 3)
    if (palavrasRelevantes.length > 0) {
        return palavrasRelevantes.slice(0, 3).join(' ');
    }
    
    // Se nada foi encontrado, retornar o texto original
    return texto;
}

// Função para validar se o termo é um nicho válido
function validarNicho(nicho) {
    if (!nicho || typeof nicho !== 'string') {
        return { valido: false, motivo: 'Termo inválido' };
    }
    
    // Normalizar caracteres Unicode e remover acentos para validação
    const nichoLimpo = nicho.toLowerCase()
        .trim()
        .replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, function(match) {
            const map = {
                'á':'a','à':'a','â':'a','ã':'a','ä':'a',
                'é':'e','è':'e','ê':'e','ë':'e',
                'í':'i','ì':'i','î':'i','ï':'i',
                'ó':'o','ò':'o','ô':'o','õ':'o','ö':'o',
                'ú':'u','ù':'u','û':'u','ü':'u',
                'ç':'c','ñ':'n'
            };
            return map[match] || match;
        });
    
    // Verificar se é muito curto
    if (nichoLimpo.length < 3) {
        return { valido: false, motivo: 'Termo muito curto. Use pelo menos 3 caracteres.' };
    }
    
    // Verificar se é muito longo
    if (nichoLimpo.length > 80) {
        return { valido: false, motivo: 'Termo muito longo. Use no máximo 80 caracteres.' };
    }
    
    // Verificar se contém apenas números
    if (/^\d+$/.test(nichoLimpo)) {
        return { valido: false, motivo: 'Use palavras, não apenas números.' };
    }
    
    // Verificar se contém caracteres especiais (agora sem acentos)
    if (/[^a-zA-Z\s-,]/g.test(nichoLimpo)) {
        return { valido: false, motivo: 'Use apenas letras, espaços, hífens e vírgulas.' };
    }
    
    // Verificar nomes próprios
    if (TERMOS_BLOQUEADOS.nomesProprios.includes(nichoLimpo)) {
        return { valido: false, motivo: 'Por favor, digite um nicho de mercado, não um nome próprio.' };
    }
    
    // Verificar termos inadequados
    if (TERMOS_BLOQUEADOS.termosInadequados.includes(nichoLimpo)) {
        return { valido: false, motivo: 'Digite um nicho de mercado válido (ex: "Fitness", "Culinária", "Tecnologia").' };
    }
    
    // Verificar apostas e cassinos
    const palavrasNicho = nichoLimpo.split(/\s+/);
    const contemApostasOuCassinos = TERMOS_BLOQUEADOS.apostasECassinos.some(termo => 
        palavrasNicho.includes(termo)
    );
    if (contemApostasOuCassinos) {
        return { valido: false, motivo: 'conteudo_inadequado' };
    }
    
    // Verificar conteúdo adulto/sexual
    const contemConteudoAdulto = TERMOS_BLOQUEADOS.conteudoAdulto.some(termo => 
        palavrasNicho.includes(termo)
    );
    if (contemConteudoAdulto) {
        return { valido: false, motivo: 'conteudo_inadequado' };
    }
    
    // Verificar conteúdo relacionado ao satanismo
    const contemSatanismo = TERMOS_BLOQUEADOS.satanismo.some(termo => 
        palavrasNicho.includes(termo)
    );
    if (contemSatanismo) {
        return { valido: false, motivo: 'conteudo_inadequado' };
    }
    
    // Verificar palavras vazias
    if (TERMOS_BLOQUEADOS.palavrasVazias.includes(nichoLimpo)) {
        return { valido: false, motivo: 'Digite um nicho de mercado específico.' };
    }
    
    // Verificar se contém pelo menos uma palavra significativa
    const palavras = nichoLimpo.split(/\s+/).filter(p => p.length > 2);
    if (palavras.length === 0) {
        return { valido: false, motivo: 'Digite um nicho de mercado com palavras significativas.' };
    }
    
    return { valido: true };
}

// API para buscar mercados semelhantes usando OpenAI
app.post('/api/buscar-mercado', async (req, res) => {
    try {
        let { nicho } = req.body;
        
        // Normalizar entrada para lidar com problemas de codificação
        if (nicho && typeof nicho === 'string') {
            // Corrigir caracteres corrompidos comuns
            nicho = nicho
                .replace(/psican�lise/gi, 'psicanálise')
                .replace(/�/g, 'á') // Corrigir caractere corrompido comum
                .normalize('NFC'); // Normalizar para forma composta
        }
        
        console.log('🔍 Requisição para buscar mercado:', { nicho });
        console.log('🔑 Chave da API carregada:', process.env.OPENAI_API_KEY ? 'Sim (primeiros 10 chars: ' + process.env.OPENAI_API_KEY.substring(0, 10) + '...)' : 'Não');
        
        if (!nicho) {
            return res.status(400).json({ error: 'Nicho é obrigatório' });
        }
        
        // PRIMEIRO: Validar o texto original antes de extrair o nicho
        const validacaoOriginal = validarNicho(nicho);
        if (!validacaoOriginal.valido) {
            console.log('❌ Nicho inválido (texto original):', validacaoOriginal.motivo);
            
            // Se for conteúdo inadequado, retornar erro específico
            if (validacaoOriginal.motivo === 'conteudo_inadequado') {
                return res.status(400).json({ 
                    error: 'conteudo_inadequado',
                    message: 'O termo pesquisado contém palavras ofensivas ou inadequadas.'
                });
            }
            
            return res.status(400).json({ 
                error: validacaoOriginal.motivo,
                sugestao: 'Tente termos como: "Fitness", "Culinária", "Tecnologia", "Educação", "Saúde", "Beleza", etc.'
            });
        }
        
        // SEGUNDO: Manter o texto original para enviar ao ChatGPT (não extrair)
        const nichoOriginal = nicho;
        // Comentado: nicho = extrairNichoPrincipal(nicho);
        // Agora enviamos o texto completo para o ChatGPT analisar
        
        console.log('🔍 Enviando texto completo para ChatGPT:', { original: nichoOriginal });
        
        // TERCEIRO: Validar o nicho extraído (validação adicional)
        const validacao = validarNicho(nicho);
        if (!validacao.valido) {
            console.log('❌ Nicho inválido:', validacao.motivo);
            
            // Se for conteúdo inadequado, retornar erro específico
            if (validacao.motivo === 'conteudo_inadequado') {
                return res.status(400).json({ 
                    error: 'conteudo_inadequado',
                    message: 'O termo pesquisado contém palavras ofensivas ou inadequadas.'
                });
            }
            
            return res.status(400).json({ 
                error: validacao.motivo,
                sugestao: 'Tente termos como: "Fitness", "Culinária", "Tecnologia", "Educação", "Saúde", "Beleza", etc.'
            });
        }
        
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sua_chave_openai_aqui') {
            console.log('❌ Chave da API não configurada');
            return res.status(401).json({ error: 'Chave da API OpenAI não configurada' });
        }
        
        // Validação adicional de contexto usando ChatGPT
        const validacaoPrompt = `Analise se "${nicho}" representa um nicho de mercado, profissão, área de interesse ou segmento válido para campanhas publicitárias.

O texto pode ser:
1. Um nicho direto (ex: "Fitness", "Culinária")
2. Uma descrição completa (ex: "Sou psicanalista, preciso de pessoas interessadas em psicanálise")
3. Uma profissão ou área de atuação

RESPONDA APENAS "SIM" ou "NÃO".

Exemplos de respostas:
- "Fitness" → SIM
- "Sou nutricionista e trabalho com emagrecimento" → SIM
- "Preciso de clientes para minha clínica de fisioterapia" → SIM
- "Pedro" → NÃO
- "Marcos" → NÃO
- "teste" → NÃO
- "asdfgh" → NÃO

Se o texto menciona uma profissão legítima, área de negócio ou interesse comercial válido, responda SIM.`;
        
        console.log('🔍 Validando contexto do nicho com ChatGPT...');
        
        const validacaoResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'user',
                content: validacaoPrompt
            }],
            max_tokens: 10,
            temperature: 0.1
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            timeout: 15000
        });
        
        const validacaoResposta = validacaoResponse.data.choices[0].message.content.trim().toUpperCase();
        console.log('🤖 Validação ChatGPT:', validacaoResposta);
        
        if (validacaoResposta !== 'SIM') {
            console.log('❌ Nicho rejeitado pelo ChatGPT');
            return res.status(400).json({ 
                error: 'Este termo não parece ser um nicho de mercado válido.',
                sugestao: 'Tente termos relacionados a profissões, hobbies, interesses ou áreas de negócio (ex: "Fitness", "Culinária", "Tecnologia", "Educação").'
            });
        }
        
        console.log('✅ Nicho validado, buscando mercados semelhantes...');
        
        const prompt = `IMPORTANTE: Você está analisando o seguinte texto relacionado a um nicho de mercado para campanhas publicitárias: "${nicho}"

Este texto pode ser:
1. Um nicho direto (ex: "Fitness", "Culinária")
2. Uma descrição completa (ex: "Sou psicanalista, preciso de pessoas interessadas em psicanálise")
3. Uma profissão ou área de atuação

Sua tarefa: Analise o CONTEXTO COMPLETO do texto para identificar o nicho específico. NUNCA extraia apenas uma palavra isolada. Considere TODAS as palavras e o significado conjunto para identificar o segmento específico.

PROCESSO DE ANÁLISE:
1. Leia TODA a frase/texto
2. Identifique o TEMA PRINCIPAL considerando todas as palavras
3. Ignore palavras genéricas como "venda", "serviço", "consultoria" se houver especificação
4. Foque no PRODUTO/ÁREA/SEGMENTO específico mencionado

Exemplos de análise correta:
- "Venda no atacado para lojas infantil" → ANALISE: venda (genérico) + atacado (modalidade) + lojas infantil (segmento específico) → NICHO: "Produtos Infantis" (foco no segmento específico)
- "Serviços de fisioterapia" → ANALISE: serviços (genérico) + fisioterapia (área específica) → NICHO: "Fisioterapia" (foco na área específica)
- "Consultoria em marketing digital" → ANALISE: consultoria (genérico) + marketing digital (área específica) → NICHO: "Marketing Digital" (foco na área específica)
- "Instalação de banheiras e spas" → ANALISE: instalação (genérico) + banheiras e spas (produtos específicos) → NICHO: "Hidromassagem/Relaxamento" (foco nos produtos específicos)

Após identificar o nicho específico, sugira 3 mercados ou segmentos que tenham LIGAÇÃO DIRETA E ESPECÍFICA com esse nicho.

CRÍTICO: Os mercados sugeridos devem ser DIRETAMENTE LIGADOS ao nicho específico identificado, não apenas "relacionados". Evite completamente sugestões genéricas ou distantes.

Para cada mercado, forneça:
1. Nome do mercado (OBRIGATÓRIO: use apenas 1 PALAVRA SIMPLES)
2. Breve descrição (1-2 frases) explicando a LIGAÇÃO DIRETA com o nicho identificado

REGRAS IMPORTANTES para o nome:
- Use APENAS 1 PALAVRA
- Deve ter LIGAÇÃO DIRETA com o nicho específico
- NÃO use termos genéricos como "Educação", "Consultoria", "Treinamento", "Imóveis", "Automóveis"
- Deve ser um MERCADO/SEGMENTO dentro da mesma área ou muito próximo

REGRA CRÍTICA: Os mercados sugeridos devem ser PRODUTOS/SERVIÇOS ESPECÍFICOS do mesmo segmento, NUNCA setores genéricos.

Exemplos CORRETOS (ligação direta):
- Para "Venda no atacado para lojas infantil": identifique "Produtos Infantis" → sugira "Brinquedos", "Roupas", "Calçados" (todos produtos infantis específicos)
- Para "Professor de artes marciais": identifique "Artes Marciais" → sugira "Lutas", "Defesa", "Kimono"
- Para "Produtor de música rap": identifique "Rap/Hip-Hop" → sugira "Hip-Hop", "Beatmaking", "Freestyle"
- Para "Nutricionista": identifique "Nutrição" → sugira "Suplementos", "Emagrecimento", "Dietas"
- Para "Instalação de banheiras e spas": identifique "Hidromassagem" → sugira "Piscinas", "Saunas", "Relaxamento"

Exemplos TOTALMENTE PROIBIDOS (sem ligação direta):
- Para "Venda no atacado infantil" → "Imóveis" ❌ (setor completamente diferente)
- Para "Venda no atacado infantil" → "Automóveis" ❌ (setor completamente diferente)
- Para "Venda no atacado infantil" → "Decoração" ❌ (setor completamente diferente)
- Para "Venda no atacado infantil" → "Corretagem" ❌ (setor completamente diferente)
- Para "Venda no atacado infantil" → "Eletrodomésticos" ❌ (setor completamente diferente)
- Para qualquer nicho → "Educação" ❌ (muito genérico)
- Para qualquer nicho → "Consultoria" ❌ (muito genérico)

IMPORTANTE: Se o nicho menciona "infantil", TODOS os mercados sugeridos devem ser relacionados a crianças/bebês. Se menciona "fitness", TODOS devem ser relacionados a exercícios/saúde. NUNCA misture setores diferentes.

Formato da resposta em JSON:
{
  "mercados": [
    {
      "nome": "UmaPalavra",
      "descricao": "Descrição específica do mercado e sua LIGAÇÃO DIRETA com o nicho identificado"
    }
  ]
}

Responda apenas com o JSON, sem texto adicional.`;
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            timeout: 30000
        });
        
        if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
            throw new Error('Resposta da API em formato inválido');
        }
        
        const content = response.data.choices[0].message.content.trim();
        
        try {
            const parsedContent = JSON.parse(content);
            
            if (!parsedContent.mercados || !Array.isArray(parsedContent.mercados)) {
                throw new Error('Formato de mercados inválido');
            }
            
            const mercadosValidos = parsedContent.mercados.filter(mercado => 
                mercado && 
                typeof mercado.nome === 'string' && 
                typeof mercado.descricao === 'string' &&
                mercado.nome.trim() && 
                mercado.descricao.trim()
            );
            
            if (mercadosValidos.length === 0) {
                throw new Error('Nenhum mercado válido encontrado');
            }
            
            res.json({ mercados: mercadosValidos });
            
        } catch (parseError) {
            console.error('Erro ao fazer parse da resposta:', parseError);
            console.log('Resposta recebida:', content);
            res.status(500).json({ error: 'Formato de resposta inválido' });
        }
        
    } catch (error) {
        console.error('Erro ao buscar mercados:', error.message);
        
        if (error.response) {
            const status = error.response.status;
            if (status === 401) {
                res.status(401).json({ error: 'Erro de autenticação. Verifique a chave da API.' });
            } else if (status === 429) {
                res.status(429).json({ error: 'Muitas solicitações. Aguarde um momento e tente novamente.' });
            } else if (status >= 500) {
                res.status(500).json({ error: 'Erro no servidor da OpenAI. Tente novamente em alguns minutos.' });
            } else {
                res.status(400).json({ error: 'Erro na requisição à OpenAI.' });
            }
        } else if (error.code === 'ECONNABORTED') {
            res.status(408).json({ error: 'Timeout: A requisição demorou muito para responder.' });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    }
});

// API para criar campanha
app.post('/api/campaign', (req, res) => {
    try {
        const campaignData = req.body;
        
        // Validações básicas
        if (!campaignData.objective) {
            return res.status(400).json({ error: 'Objetivo da campanha é obrigatório' });
        }
        
        if (!campaignData.direction) {
            return res.status(400).json({ error: 'Direcionamento é obrigatório' });
        }

        // Aqui você pode salvar os dados da campanha no banco de dados
        // Por enquanto, apenas retornamos sucesso
        
        console.log('Nova campanha criada:', campaignData);
        
        res.json({
            success: true,
            message: 'Campanha criada com sucesso!',
            campaignId: Date.now().toString()
        });
    } catch (error) {
        console.error('Erro ao criar campanha:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Arquivo muito grande. Máximo 500MB permitido.' });
        }
    }
    
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// ===== ROTAS DA API =====

// Rota para upload de arquivos com conversão HEIC
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
    try {
        console.log('📤 [UPLOAD] Recebendo arquivos para upload...');
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }
        
        const processedFiles = [];
        
        for (const file of req.files) {
            console.log(`📄 [UPLOAD] Processando arquivo: ${file.originalname}`);
            console.log(`📊 [UPLOAD] Tipo MIME: ${file.mimetype}`);
            console.log(`📏 [UPLOAD] Tamanho: ${file.size} bytes`);
            
            // Validação específica de tamanho por tipo de arquivo
            const fileExtension = path.extname(file.originalname).toLowerCase();
            const imageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.heic', '.webp', '.dng'];
            const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.3gp', '.mkv', '.ts'];
            
            const isImage = imageExtensions.includes(fileExtension);
            const isVideo = videoExtensions.includes(fileExtension);
            
            // Verificar limites específicos
            if (isImage && file.size > 10 * 1024 * 1024) { // 10MB para imagens
                return res.status(400).json({ error: 'Imagem muito grande. Máximo 10MB para imagens.' });
            }
            
            if (isVideo && file.size > 500 * 1024 * 1024) { // 500MB para vídeos
                return res.status(400).json({ error: 'Vídeo muito grande. Máximo 500MB para vídeos.' });
            }
            
            let processedFile = {
                originalName: file.originalname,
                filename: file.filename,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype,
                url: `/uploads/${file.filename}`
            };
            
            // Verificar se é arquivo HEIC e converter para JPG
            const isHEIC = file.originalname.toLowerCase().endsWith('.heic') || 
                          file.originalname.toLowerCase().endsWith('.heif');
            
            if (isHEIC) {
                try {
                    console.log('🔄 [HEIC] Iniciando conversão HEIC para JPG...');
                    
                    // Ler o arquivo HEIC
                    const inputBuffer = await fs.promises.readFile(file.path);
                    console.log(`📖 [HEIC] Arquivo HEIC lido: ${inputBuffer.length} bytes`);
                    
                    // Converter para JPG
                    const outputBuffer = await heicConvert({
                        buffer: inputBuffer,
                        format: 'JPEG',
                        quality: 0.9
                    });
                    console.log(`✅ [HEIC] Conversão concluída: ${outputBuffer.length} bytes`);
                    
                    // Gerar novo nome de arquivo JPG
                    const jpgFilename = file.filename.replace(/\.[^.]+$/, '.jpg');
                    const jpgPath = path.join(path.dirname(file.path), jpgFilename);
                    
                    // Salvar arquivo JPG convertido
                    await fs.promises.writeFile(jpgPath, outputBuffer);
                    console.log(`💾 [HEIC] Arquivo JPG salvo: ${jpgPath}`);
                    
                    // Remover arquivo HEIC original
                    await fs.promises.unlink(file.path);
                    console.log(`🗑️ [HEIC] Arquivo HEIC original removido`);
                    
                    // Atualizar informações do arquivo processado
                    processedFile.filename = jpgFilename;
                    processedFile.path = jpgPath;
                    processedFile.mimetype = 'image/jpeg';
                    processedFile.url = `/uploads/${jpgFilename}`;
                    processedFile.converted = true;
                    processedFile.originalFormat = 'HEIC';
                    
                } catch (conversionError) {
                    console.error('❌ [HEIC] Erro na conversão:', conversionError);
                    // Em caso de erro, manter arquivo original
                    processedFile.conversionError = conversionError.message;
                }
            }
            
            processedFiles.push(processedFile);
        }
        
        console.log(`✅ [UPLOAD] ${processedFiles.length} arquivo(s) processado(s) com sucesso`);
        
        res.json({
            success: true,
            message: 'Arquivos enviados com sucesso',
            files: processedFiles
        });
        
    } catch (error) {
        console.error('❌ [UPLOAD] Erro no upload:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message 
        });
    }
});

// Rota para criar cobrança PIX
app.post('/api/create-pix-charge', async (req, res) => {
    try {
        console.log('\n=== 🎯 [ROUTE] REQUISIÇÃO PIX RECEBIDA ===');
        console.log('📦 [ROUTE] Body da requisição:', JSON.stringify(req.body, null, 2));
        console.log('📋 [ROUTE] Headers da requisição:', JSON.stringify(req.headers, null, 2));
        console.log('⏰ [ROUTE] Timestamp:', new Date().toISOString());
        console.log('===========================================\n');
        
        const { 
            value, 
            days, 
            expiresIn,
            campaignType, 
            comment,
            customerName,
            customerPhone,
            customerEmail,
            customerTaxID,
            additionalInfo,
            correlationID,
            useSandbox
        } = req.body;
        
        // Usar expiresIn se fornecido, senão usar days
        const expiration = expiresIn || (days ? days * 24 * 60 * 60 : null);
        
        console.log('🔍 [ROUTE] Dados extraídos:');
        console.log('💰 [ROUTE] Value:', value);
        console.log('📅 [ROUTE] Days:', days);
        console.log('⏰ [ROUTE] ExpiresIn:', expiresIn);
        console.log('⏱️ [ROUTE] Expiration (seconds):', expiration);
        console.log('🆔 [ROUTE] Correlation ID:', correlationID);
        console.log('🏷️ [ROUTE] Campaign Type:', campaignType);
        console.log('💬 [ROUTE] Comment:', comment);
        console.log('👤 [ROUTE] Customer Name:', customerName);
        console.log('📱 [ROUTE] Customer Phone:', customerPhone);
        console.log('📧 [ROUTE] Customer Email:', customerEmail);
        console.log('🆔 [ROUTE] Customer Tax ID:', customerTaxID);
        console.log('📋 [ROUTE] Additional Info:', additionalInfo);
        
        if (!value || !expiration) {
            console.log('❌ [ROUTE] Validação falhou: valor ou duração ausentes');
            return res.status(400).json({
                success: false,
                error: 'Valor e duração são obrigatórios'
            });
        }
        
        console.log('✅ [ROUTE] Validação passou, chamando createPixCharge...');
        
        const pixData = await createPixCharge({
            value,
            expiresIn: expiration,
            correlationID,
            campaignType,
            comment,
            customerName,
            customerPhone,
            customerEmail,
            customerTaxID,
            additionalInfo,
            useSandbox
        });
        
        console.log('🎉 [ROUTE] PIX criado com sucesso!');
        console.log('📋 [ROUTE] Dados do PIX:', JSON.stringify(pixData, null, 2));
        
        res.json({
            success: true,
            data: pixData
        });
        
    } catch (error) {
        console.error('❌ [ROUTE] Erro ao criar PIX:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// ===== WOOVI/OPENPIX INTEGRATION =====

// Configuração da Woovi
const WOOVI_CONFIG = {
    baseURL: process.env.WOOVI_BASE_URL || 'https://api.woovi.com',
    sandboxURL: process.env.WOOVI_SANDBOX_URL || 'https://api.woovi-sandbox.com',
    appId: process.env.WOOVI_APP_ID,
    sandboxAppId: process.env.WOOVI_SANDBOX_APP_ID,
    webhookSecret: process.env.WOOVI_WEBHOOK_SECRET || 'default_secret',
    webhookURL: process.env.WOOVI_WEBHOOK_URL || 'http://localhost:4000/api/woovi-webhook'
};

console.log('🔧 Configuração Woovi carregada:');
console.log('📍 Base URL:', WOOVI_CONFIG.baseURL);
console.log('🔑 App ID (Produção):', WOOVI_CONFIG.appId ? 'Configurado ✅' : 'NÃO CONFIGURADO ❌');
console.log('🧪 App ID (Sandbox):', WOOVI_CONFIG.sandboxAppId ? 'Configurado ✅' : 'NÃO CONFIGURADO ❌');
console.log('🔐 Webhook Secret:', WOOVI_CONFIG.webhookSecret !== 'default_secret' ? 'Configurado ✅' : 'Usando padrão ⚠️');
console.log('🌐 Webhook URL:', WOOVI_CONFIG.webhookURL);
if (WOOVI_CONFIG.webhookURL.includes('localhost')) {
    console.log('⚠️  ATENÇÃO: Webhook configurado para localhost - não funcionará em produção!');
    console.log('💡 Para testar webhooks, configure WOOVI_WEBHOOK_URL com uma URL pública (ex: ngrok)');
}

// Função para criar cobrança PIX
async function createPixCharge(data) {
    try {
        console.log('🚀 [SERVER] Iniciando criação de cobrança PIX');
        console.log('📦 [SERVER] Dados recebidos:', data);
        
        // Determinar qual URL usar baseado no parâmetro useSandbox
        const apiURL = data.useSandbox ? WOOVI_CONFIG.sandboxURL : WOOVI_CONFIG.baseURL;
        console.log('🌐 [SERVER] Modo:', data.useSandbox ? 'SANDBOX' : 'PRODUÇÃO');
        console.log('🔗 [SERVER] URL selecionada:', apiURL);
        
        const chargeData = {
            correlationID: data.correlationID || `pedido-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, // ID único
            value: data.value, // valor em centavos
            comment: data.comment || "Pagamento de campanha publicitária",
            expiresIn: data.expiresIn || 900, // usar expiresIn fornecido ou padrão de 15 minutos
            webhook: {
                url: WOOVI_CONFIG.webhookURL
            }
        };
        
        // Adicionar customer se fornecido
        if (data.customerName || data.customerPhone || data.customerEmail || data.customerTaxID) {
            chargeData.customer = {};
            if (data.customerName) chargeData.customer.name = data.customerName;
            if (data.customerTaxID) chargeData.customer.taxID = data.customerTaxID;
            if (data.customerEmail) chargeData.customer.email = data.customerEmail;
            if (data.customerPhone) chargeData.customer.phone = data.customerPhone;
        }
        
        // Adicionar additionalInfo se fornecido
        if (data.additionalInfo) {
            chargeData.additionalInfo = data.additionalInfo;
        }
        
        // Determinar qual App ID usar baseado no ambiente
        const appId = data.useSandbox ? WOOVI_CONFIG.sandboxAppId : WOOVI_CONFIG.appId;
        
        console.log('📋 [SERVER] Dados da cobrança preparados:', JSON.stringify(chargeData, null, 2));
        console.log('🌐 [SERVER] URL da API:', `${apiURL}/api/v1/charge`);
        console.log('🧪 [SERVER] Ambiente:', data.useSandbox ? 'Sandbox' : 'Produção');
        console.log('🔑 [SERVER] App ID header:', appId ? 'Presente' : 'AUSENTE');
        console.log('📤 [SERVER] Enviando requisição para Woovi...');

        const response = await axios.post(
            `${apiURL}/api/v1/charge`,
            chargeData,
            {
                headers: {
                    'Authorization': appId,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 segundos
            }
        );
        
        console.log('✅ [SERVER] Resposta da API Woovi recebida:');
        console.log('📊 [SERVER] Status:', response.status);
        console.log('📦 [SERVER] Dados:', response.data);

        // Salvar dados da transação pendente para validação posterior
        const transactionData = {
            correlationID: chargeData.correlationID,
            value: chargeData.value,
            comment: chargeData.comment,
            createdAt: new Date().toISOString(),
            customer: chargeData.customer,
            additionalInfo: chargeData.additionalInfo,
            useSandbox: data.useSandbox,
            originalData: data
        };
        
        pendingTransactions.set(chargeData.correlationID, transactionData);
        logTransactionAudit('TRANSACTION_CREATED', chargeData.correlationID, {
            value: chargeData.value,
            comment: chargeData.comment,
            useSandbox: data.useSandbox
        });
        
        console.log(`💾 [SERVER] Transação salva como pendente: ${chargeData.correlationID}`);

        return response.data;
    } catch (error) {
        console.error('❌ [SERVER] Erro ao criar cobrança PIX:');
        console.error('📄 [SERVER] Mensagem:', error.message);
        console.error('📊 [SERVER] Status:', error.response?.status);
        console.error('📋 [SERVER] Headers da resposta:', JSON.stringify(error.response?.headers, null, 2));
        console.error('📦 [SERVER] Dados do erro:', JSON.stringify(error.response?.data, null, 2));
        console.error('🔗 [SERVER] URL da requisição:', error.config?.url);
        console.error('📤 [SERVER] Dados enviados:', JSON.stringify(error.config?.data, null, 2));
        console.error('🔍 [SERVER] Erro completo:', error);
        
        // Tratamento específico baseado no status da resposta
        let errorMessage = 'Erro desconhecido ao criar cobrança PIX';
        
        if (error.response) {
            switch (error.response.status) {
                case 400:
                    errorMessage = `Dados inválidos: ${error.response.data?.message || 'Verifique os campos obrigatórios (value e correlationID)'}`;
                    break;
                case 401:
                    errorMessage = 'Token de autorização inválido ou expirado - verifique o token Woovi';
                    break;
                case 403:
                    errorMessage = 'Acesso negado - verifique as permissões da API Woovi';
                    break;
                case 404:
                    errorMessage = 'Endpoint não encontrado - verifique a URL da API';
                    break;
                case 422:
                    errorMessage = `Erro de validação: ${error.response.data?.message || 'Dados não processáveis pela API'}`;
                    break;
                case 500:
                    errorMessage = 'Erro interno do servidor Woovi - tente novamente mais tarde';
                    break;
                default:
                    errorMessage = `Erro HTTP ${error.response.status}: ${error.response.data?.message || error.message}`;
            }
        } else if (error.request) {
            errorMessage = 'Não foi possível conectar com a API Woovi - verifique sua conexão com a internet';
        }
        
        throw new Error(errorMessage);
    }
}

// Função para validar webhook
function validateWebhookSignature(payload, signature) {
    const hmac = crypto.createHmac('sha256', WOOVI_CONFIG.webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    return signature === expectedSignature;
}



// Armazenar pagamentos processados em memória (em produção, usar banco de dados)
const processedPayments = new Map();

// Armazenar transações pendentes (dados salvos na criação)
const pendingTransactions = new Map();

// Sistema de logs de auditoria
const transactionLogs = [];

// Função para registrar logs de auditoria
function logTransactionAudit(action, correlationID, data = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        correlationID,
        data,
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    };
    transactionLogs.push(logEntry);
    console.log(`📋 [AUDIT] ${action} - ${correlationID}:`, data);
    
    // Manter apenas os últimos 1000 logs
    if (transactionLogs.length > 1000) {
        transactionLogs.shift();
    }
}

// Rota para webhook da Woovi
app.post('/api/woovi-webhook', (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const payload = JSON.stringify(req.body);
        
        // Validar assinatura do webhook
        if (!validateWebhookSignature(payload, signature)) {
            console.log('Assinatura do webhook inválida');
            return res.status(401).json({ error: 'Assinatura inválida' });
        }

        const { event, charge } = req.body;
        
        console.log('🔔 [WEBHOOK] Webhook recebido:', event, charge?.correlationID);
        logTransactionAudit('WEBHOOK_RECEIVED', charge?.correlationID, { event, charge });
        
        // Processar diferentes tipos de eventos
        switch (event) {
            case 'OPENPIX:CHARGE_COMPLETED':
            case 'woovi:TRANSACTION_RECEIVED':
                console.log(`💰 [WEBHOOK] Pagamento confirmado para: ${charge.correlationID}`);
                
                // Validar se a transação existe nas pendentes
                const pendingTransaction = pendingTransactions.get(charge.correlationID);
                if (!pendingTransaction) {
                    console.error(`❌ [WEBHOOK] Transação não encontrada nas pendentes: ${charge.correlationID}`);
                    logTransactionAudit('VALIDATION_FAILED', charge.correlationID, {
                        reason: 'Transaction not found in pending',
                        receivedValue: charge.value
                    });
                    return res.status(400).json({ error: 'Transação não encontrada' });
                }
                
                // Validar valor da transação
                if (pendingTransaction.value !== charge.value) {
                    console.error(`❌ [WEBHOOK] Valor não confere para ${charge.correlationID}:`);
                    console.error(`   Esperado: ${pendingTransaction.value}, Recebido: ${charge.value}`);
                    logTransactionAudit('VALIDATION_FAILED', charge.correlationID, {
                        reason: 'Value mismatch',
                        expectedValue: pendingTransaction.value,
                        receivedValue: charge.value
                    });
                    return res.status(400).json({ error: 'Valor da transação não confere' });
                }
                
                console.log(`✅ [WEBHOOK] Validação passou para: ${charge.correlationID}`);
                
                // Armazenar o pagamento como processado
                processedPayments.set(charge.correlationID, {
                    status: 'COMPLETED',
                    paidAt: new Date().toISOString(),
                    value: charge.value,
                    event: event,
                    validatedAt: new Date().toISOString(),
                    pendingData: pendingTransaction
                });
                
                // Remover da lista de pendentes
                pendingTransactions.delete(charge.correlationID);
                
                logTransactionAudit('PAYMENT_VALIDATED', charge.correlationID, {
                    value: charge.value,
                    event: event
                });
                
                console.log(`💾 [WEBHOOK] Pagamento validado e armazenado: ${charge.correlationID}`);
                break;
            case 'OPENPIX:CHARGE_EXPIRED':
                console.log(`Cobrança expirada: ${charge.correlationID}`);
                processedPayments.set(charge.correlationID, {
                    status: 'EXPIRED',
                    expiredAt: new Date().toISOString()
                });
                break;
            default:
                console.log(`Evento não tratado: ${event}`);
        }
        
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Erro no webhook:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Rota para verificar status do pagamento (polling + consulta direta à API)
app.get('/api/payment-status/:correlationID', async (req, res) => {
    const { correlationID } = req.params;
    
    // Primeiro verifica se já foi processado localmente
    const localPayment = processedPayments.get(correlationID);
    if (localPayment) {
        return res.json({ 
            success: true, 
            status: localPayment.status,
            data: localPayment
        });
    }
    
    // Se não foi processado, consulta diretamente a API da Woovi
    const pendingTransaction = pendingTransactions.get(correlationID);
    if (!pendingTransaction) {
        return res.json({ 
            success: false, 
            status: 'NOT_FOUND',
            message: 'Transação não encontrada'
        });
    }
    
    try {
        // Determinar qual API usar baseado no ambiente da transação
        const apiURL = pendingTransaction.useSandbox ? WOOVI_CONFIG.sandboxURL : WOOVI_CONFIG.baseURL;
        const appId = pendingTransaction.useSandbox ? WOOVI_CONFIG.sandboxAppId : WOOVI_CONFIG.appId;
        
        console.log(`🔍 [POLLING] Consultando status na API Woovi: ${correlationID}`);
        
        const response = await axios.get(
            `${apiURL}/api/v1/charge/${correlationID}`,
            {
                headers: {
                    'Authorization': appId,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        const charge = response.data.charge;
        console.log(`📊 [POLLING] Status recebido: ${charge.status} para ${correlationID}`);
        
        // Se o pagamento foi completado, processar localmente
        if (charge.status === 'COMPLETED') {
            console.log(`✅ [POLLING] Pagamento confirmado via API: ${correlationID}`);
            
            // Validar valor
            if (pendingTransaction.value !== charge.value) {
                console.error(`❌ [POLLING] Valor não confere para ${correlationID}:`);
                console.error(`   Esperado: ${pendingTransaction.value}, Recebido: ${charge.value}`);
                logTransactionAudit('VALIDATION_FAILED', correlationID, {
                    reason: 'Value mismatch via polling',
                    expectedValue: pendingTransaction.value,
                    receivedValue: charge.value
                });
                return res.json({ 
                    success: false, 
                    status: 'VALIDATION_ERROR',
                    message: 'Valor da transação não confere'
                });
            }
            
            // Armazenar como processado
            const processedPayment = {
                status: 'COMPLETED',
                paidAt: charge.paidAt || new Date().toISOString(),
                value: charge.value,
                event: 'POLLING_CONFIRMED',
                validatedAt: new Date().toISOString(),
                pendingData: pendingTransaction,
                chargeData: charge
            };
            
            processedPayments.set(correlationID, processedPayment);
            pendingTransactions.delete(correlationID);
            
            logTransactionAudit('PAYMENT_VALIDATED', correlationID, {
                value: charge.value,
                method: 'polling',
                paidAt: charge.paidAt
            });
            
            console.log(`💾 [POLLING] Pagamento validado e armazenado: ${correlationID}`);
            
            return res.json({ 
                success: true, 
                status: 'COMPLETED',
                data: processedPayment
            });
        } else if (charge.status === 'EXPIRED') {
            console.log(`⏰ [POLLING] Cobrança expirada: ${correlationID}`);
            
            const expiredPayment = {
                status: 'EXPIRED',
                expiredAt: charge.expiredAt || new Date().toISOString(),
                chargeData: charge
            };
            
            processedPayments.set(correlationID, expiredPayment);
            pendingTransactions.delete(correlationID);
            
            logTransactionAudit('PAYMENT_EXPIRED', correlationID, {
                expiredAt: charge.expiredAt,
                method: 'polling'
            });
            
            return res.json({ 
                success: true, 
                status: 'EXPIRED',
                data: expiredPayment
            });
        } else {
            // Ainda pendente
            return res.json({ 
                success: false, 
                status: 'PENDING',
                message: 'Pagamento ainda pendente',
                chargeStatus: charge.status
            });
        }
        
    } catch (error) {
        console.error(`❌ [POLLING] Erro ao consultar API Woovi para ${correlationID}:`, error.message);
        
        // Se der erro na consulta, retorna como pendente
        return res.json({ 
            success: false, 
            status: 'PENDING',
            message: 'Erro ao verificar status - tentando novamente...',
            error: error.message
        });
    }
});

// Rota para visualizar logs de auditoria
app.get('/api/transaction-logs', (req, res) => {
    const { limit = 50, correlationID } = req.query;
    
    let logs = transactionLogs;
    
    // Filtrar por correlationID se fornecido
    if (correlationID) {
        logs = logs.filter(log => log.correlationID === correlationID);
    }
    
    // Limitar quantidade de logs
    const limitedLogs = logs.slice(-parseInt(limit));
    
    res.json({
        success: true,
        logs: limitedLogs,
        total: logs.length
    });
});

// Rota para estatísticas das transações
app.get('/api/transaction-stats', (req, res) => {
    const stats = {
        pendingTransactions: pendingTransactions.size,
        processedPayments: processedPayments.size,
        totalLogs: transactionLogs.length,
        recentActivity: transactionLogs.slice(-10)
    };
    
    res.json({
        success: true,
        stats
    });
});

// Rota 404 - deve ser a última rota
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Arquivos estáticos servidos de: ${path.join(__dirname, 'public')}`);
    console.log(`📤 Uploads salvos em: ${path.join(__dirname, 'uploads')}`);
    console.log(`💳 Woovi PIX integrado e funcionando`);
    
    // Testar conectividade com Evolution API
    testEvolutionAPI();
});

module.exports = app;