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
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Função para definir permissões corretas nos arquivos de upload
function setCorrectFilePermissions(filePath) {
    try {
        // Definir permissões 644 (rw-r--r--) para o arquivo
        fs.chmodSync(filePath, 0o644);
        
        // No ambiente Linux/Unix, também definir o grupo correto
        if (process.platform !== 'win32') {
            const { execSync } = require('child_process');
            try {
                // Tentar definir o grupo como www-data (usuário do nginx)
                execSync(`chown :www-data "${filePath}"`, { stdio: 'ignore' });
            } catch (chownError) {
                // Se falhar, apenas log (não é crítico)
                console.log('⚠️ Não foi possível alterar o grupo do arquivo:', filePath);
            }
        }
        
        console.log('✅ Permissões definidas corretamente para:', filePath);
    } catch (error) {
        console.error('❌ Erro ao definir permissões para:', filePath, error.message);
    }
}
// const MCPMongoDB = require('./mcp-mongodb');
const mcpClient = require('./mcp-client');
require('dotenv').config();

// Configure global MCP for server environment
global.runMCP = mcpClient.runMCP;

const app = express();
const PORT = process.env.PORT || 4000;

// MongoDB configuration
// Tentar diferentes configurações de conexão
const mongoConfigs = [
    'mongodb://mongo:Rr12415721@69.62.99.94:27017/turbo_impulsione?tls=false',
    'mongodb://mongo:Rr12415721@69.62.99.94:27017/?tls=false',
    'mongodb://mongo:Rr12415721@69.62.99.94:27017/turbo_impulsione?authSource=admin&authMechanism=SCRAM-SHA-256&tls=false'
];
const mongoUri = process.env.MONGODB_URI || mongoConfigs[0];
const DB_NAME = 'turbo_impulsione';
const COLLECTION_NAME = 'campaigns';
const USERS_COLLECTION_NAME = 'users';
const SESSIONS_COLLECTION_NAME = 'sessions';
const TESTIMONIALS_COLLECTION_NAME = 'testimonials';

let db;
let campaignsCollection;
let usersCollection;
let sessionsCollection;
let testimonialsCollection;
let mcpMongoDB;

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

// Session storage for invalidated tokens
const invalidatedTokens = new Set();
const activeSessions = new Map();

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

// Connect to MongoDB via MCP
async function connectToMongoDB() {
    console.log('🚀 Iniciando conexão com MongoDB...');
    console.log('🔧 Variáveis de ambiente:');
    console.log('   - PORT:', process.env.PORT);
    console.log('   - NODE_ENV:', process.env.NODE_ENV);
    console.log('   - MONGODB_URI definida:', !!process.env.MONGODB_URI);
    
    // Always initialize MCP MongoDB
    try {
        // mcpMongoDB = new MCPMongoDB();
        // await mcpMongoDB.connect();
        console.log('✅ MCP MongoDB inicializado');
    } catch (mcpError) {
        console.error('❌ Erro ao inicializar MCP MongoDB:', mcpError);
    }
    
    // Use environment variable first, then fallback to hardcoded configs
    const urisToTry = process.env.MONGODB_URI ? [process.env.MONGODB_URI, ...mongoConfigs] : mongoConfigs;
    
    // Try multiple MongoDB connection configurations
    for (let i = 0; i < urisToTry.length; i++) {
        const currentUri = urisToTry[i];
        console.log(`🔄 Tentando conexão MongoDB ${i + 1}/${urisToTry.length}:`);
        console.log(`   URI: ${currentUri.replace(/:\/\/.*@/, '://***@')}`);
        
        try {
            const client = new MongoClient(currentUri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 10000,
                maxPoolSize: 10,
                retryWrites: true,
                w: 'majority'
            });
            
            console.log('🔌 Tentando conectar...');
            await client.connect();
            
            console.log('🔍 Testando conexão...');
            await client.db('admin').command({ ping: 1 });
            
            db = client.db(DB_NAME);
        campaignsCollection = db.collection(COLLECTION_NAME);
        usersCollection = db.collection(USERS_COLLECTION_NAME);
        sessionsCollection = db.collection(SESSIONS_COLLECTION_NAME);
        testimonialsCollection = db.collection(TESTIMONIALS_COLLECTION_NAME);
            console.log(`✅ Conectado ao MongoDB diretamente - Database: ${DB_NAME}`);
            
            // Test collection access
            try {
                const testCount = await campaignsCollection.countDocuments();
                console.log(`📊 Collection '${COLLECTION_NAME}' acessível - ${testCount} documentos`);
                
                const usersCount = await usersCollection.countDocuments();
                console.log(`📊 Collection '${USERS_COLLECTION_NAME}' acessível - ${usersCount} documentos`);
            } catch (countError) {
                console.log('⚠️ Erro ao acessar collection:', countError.message);
            }
            
            // Create indexes for better performance
            try {
                // Campaigns indexes
                await campaignsCollection.createIndex({ id: 1 }, { unique: true });
                await campaignsCollection.createIndex({ createdAt: -1 });
                await campaignsCollection.createIndex({ userAgent: 1 });
                await campaignsCollection.createIndex({ createdFrom: 1 });
                
                // Users indexes
                await usersCollection.createIndex({ email: 1 }, { unique: true });
                await usersCollection.createIndex({ whatsapp: 1 });
                await usersCollection.createIndex({ createdAt: -1 });
                await usersCollection.createIndex({ id: 1 }, { unique: true });
                
                // Testimonials indexes
                await testimonialsCollection.createIndex({ userId: 1 }, { unique: true }); // Um depoimento por usuário
                await testimonialsCollection.createIndex({ createdAt: -1 });
                await testimonialsCollection.createIndex({ stars: 1 });
                
                console.log('✅ Índices criados no MongoDB (campaigns, users e testimonials)');
            } catch (indexError) {
                console.log('⚠️ Erro ao criar índices (continuando):', indexError.message);
            }
            
            return; // Success, exit the loop
        } catch (error) {
            console.error(`❌ Falha na conexão ${i + 1}:`);
            console.error('   Erro:', error.message);
            console.error('   Código:', error.code);
            console.error('   Nome:', error.name);
            if (i === urisToTry.length - 1) {
                console.error('❌ Todas as tentativas de conexão MongoDB falharam');
                console.error('🔍 Detalhes do último erro:', error);
            }
        }
    }
    
    if (mcpMongoDB && mcpMongoDB.isConnected) {
        console.log('✅ Usando MongoDB via MCP como fallback');
        return;
    }
    
    // Continue without MongoDB - fallback to localStorage
    console.log('⚠️ Continuando sem MongoDB - usando localStorage como fallback');
}

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
let proxiesWarmedUp = false; // Flag para indicar se os proxies foram aquecidos

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

// Função para aquecer os proxies testando conectividade
async function warmUpProxies() {
    console.log('🔥 Aquecendo proxies...');
    
    for (let i = 0; i < PROXIES.length; i++) {
        const proxy = PROXIES[i];
        const proxyAgent = createProxyAgent(proxy);
        
        try {
            // Teste simples de conectividade
            await axios({
                method: 'GET',
                url: 'https://httpbin.org/ip',
                httpsAgent: proxyAgent,
                timeout: 10000
            });
            
            console.log(`✅ Proxy ${proxy.host}:${proxy.port} aquecido com sucesso`);
        } catch (error) {
            console.log(`⚠️ Proxy ${proxy.host}:${proxy.port} falhou no aquecimento:`, error.message);
            markProxyFailure(proxy);
        }
    }
    
    proxiesWarmedUp = true;
    console.log('🔥 Aquecimento de proxies concluído');
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
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://connect.facebook.net"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "https://tile.openstreetmap.org"],
            mediaSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://api.instagram.com", "https://graph.instagram.com", "https://api.openai.com", "https://api.openpix.com.br", "https://api.woovi-sandbox.com", "https://api.woovi.com", "https://tile.openstreetmap.org", "https://cdnjs.cloudflare.com", "https://www.facebook.com", "https://graph.facebook.com", "https://connect.facebook.net"],
            frameSrc: ["'self'", "https://www.facebook.com"]
        }
    }
}));

// Middleware básico
app.use(compression());
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'https://nextads.pro', 'http://nextads.pro'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
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

// ===== ROTAS OAUTH FACEBOOK (DEVEM VIR ANTES DOS ARQUIVOS ESTÁTICOS) =====

// Middleware para verificar compatibilidade com Facebook App
function checkFacebookAppCompatibility(req, res, next) {
    // Adicionar headers para melhor debugging
    res.setHeader('X-Facebook-App-ID', process.env.META_APP_ID);
    res.setHeader('X-OAuth-Redirect-URI', process.env.OAUTH_REDIRECT_URI);
    console.log('🔍 Verificando compatibilidade Facebook App - ID:', process.env.META_APP_ID);
    next();
}

// Endpoint /login/facebook → redireciona pro Facebook
app.get('/login/facebook', checkFacebookAppCompatibility, (req, res) => {
    // Verificar se o usuário está autenticado (header ou query param)
    let currentUserId = null;
    const authHeader = req.headers.authorization;
    const tokenParam = req.query.token;
    
    // Tentar token do header primeiro
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, JWT_SECRET);
            currentUserId = decoded.userId;
            console.log('✅ Usuário autenticado para OAuth (header):', currentUserId);
        } catch (error) {
            console.warn('⚠️ Token inválido no header para OAuth:', error.message);
        }
    }
    
    // Se não conseguiu pelo header, tentar pelo query param
    if (!currentUserId && tokenParam) {
        try {
            const decoded = jwt.verify(tokenParam, JWT_SECRET);
            currentUserId = decoded.userId;
            console.log('✅ Usuário autenticado para OAuth (query):', currentUserId);
        } catch (error) {
            console.warn('⚠️ Token inválido no query para OAuth:', error.message);
        }
    }
    
    // Se não há usuário autenticado, retornar erro
    if (!currentUserId) {
        return res.status(401).json({
            success: false,
            error: 'Usuário deve estar logado para conectar Meta Ads'
        });
    }
    
    // Criar state com userId
    const stateData = {
        userId: currentUserId,
        timestamp: Date.now(),
        random: Math.random().toString(36).substring(2, 15)
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    // Priorizar OAUTH_REDIRECT_URI se configurado, senão detectar ambiente
    const isDevelopment = req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1');
    
    console.log('🔍 DEBUG OAuth - Host:', req.get('host'));
    console.log('🔍 DEBUG OAuth - isDevelopment:', isDevelopment);
    console.log('🔍 DEBUG OAuth - OAUTH_REDIRECT_URI:', process.env.OAUTH_REDIRECT_URI);
    console.log('🔍 DEBUG OAuth - userId:', currentUserId);
    
    // Se OAUTH_REDIRECT_URI estiver configurado, usar sempre (produção)
    // Senão, usar detecção automática baseada no host (desenvolvimento)
    const redirectUri = process.env.OAUTH_REDIRECT_URI || 
        `${req.protocol}://${req.get('host')}/auth/facebook/callback`;
    
    console.log('🔍 DEBUG OAuth - redirectUri final:', redirectUri);
    
    // URL oficial do Meta OAuth 2.0 v21.0 com display=popup para modal
    const facebookAuthUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${process.env.META_APP_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}&` +
        `scope=email,public_profile,pages_show_list,ads_management,business_management,read_insights&` +
        `response_type=code&` +
        `display=popup&` +
        `auth_type=rerequest`;
    
    console.log('🔗 Redirecionando para OAuth 2.0 Facebook oficial (popup):', facebookAuthUrl);
    console.log('📋 Parâmetros OAuth:', {
        app_id: process.env.META_APP_ID,
        redirect_uri: redirectUri,
        state: state,
        display: 'popup'
    });
    res.redirect(facebookAuthUrl);
});

// Endpoint /auth/facebook/callback → recebe o code, troca pelo token e salva no banco
app.get('/auth/facebook/callback', async (req, res) => {
    console.log('🚀 CALLBACK FACEBOOK CHAMADO!');
    console.log('📋 Query params:', req.query);
    console.log('📋 Headers:', req.headers);
    
    try {
        const { code, state, error } = req.query;
        
        console.log('🔍 Parâmetros extraídos:', { code: !!code, state: !!state, error });
        
        if (error) {
            console.error('❌ Erro no OAuth Facebook:', error);
            const errorRedirect = process.env.OAUTH_ERROR_REDIRECT || '/integracoes.html';
            return res.redirect(`${errorRedirect}?success=false&error=${encodeURIComponent(error)}`);
        }
        
        if (!code) {
            console.error('❌ Código de autorização não recebido');
            const errorRedirect = process.env.OAUTH_ERROR_REDIRECT || '/integracoes.html';
            return res.redirect(`${errorRedirect}?success=false&error=${encodeURIComponent('Código de autorização não recebido')}`);
        }
        
        console.log('🔄 Trocando code por access_token...');
        
        // Trocar o code por um access_token usando a API oficial
        const redirectUri = process.env.OAUTH_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/facebook/callback`;
        
        const tokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: {
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                redirect_uri: redirectUri,
                code: code
            }
        });
        
        const accessToken = tokenResponse.data.access_token;
        
        if (!accessToken) {
            console.error('❌ Access token não recebido');
            const errorRedirect = process.env.OAUTH_ERROR_REDIRECT || '/integracoes.html';
            return res.redirect(`${errorRedirect}?success=false&error=${encodeURIComponent('Access token não recebido')}`);
        }
        
        console.log('✅ Access token recebido com sucesso');
        
        // Gerar token de longo prazo (60 dias)
        console.log('🔄 Gerando token de longo prazo...');
        const longTokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                fb_exchange_token: accessToken
            }
        });
        
        const longLivedToken = longTokenResponse.data.access_token;
        console.log('✅ Token de longo prazo gerado');
        
        // Obter informações do usuário
        const userResponse = await axios.get(`https://graph.facebook.com/v21.0/me`, {
            params: {
                access_token: longLivedToken,
                fields: 'id,name,email'
            }
        });
        
        const userData = userResponse.data;
        
        // Obter contas de anúncios
        const adAccountsResponse = await axios.get(`https://graph.facebook.com/v21.0/me/adaccounts`, {
            params: {
                access_token: longLivedToken,
                fields: 'id,name,account_status,currency,timezone_name,business'
            }
        });
        
        const adAccounts = adAccountsResponse.data.data || [];
        
        // Obter páginas do Facebook
        const pagesResponse = await axios.get(`https://graph.facebook.com/v21.0/me/accounts`, {
            params: {
                access_token: longLivedToken,
                fields: 'id,name,access_token,instagram_business_account'
            }
        });
        
        const pages = pagesResponse.data.data || [];
        
        console.log('✅ OAuth 2.0 Facebook concluído:', {
            user: userData.name,
            adAccounts: adAccounts.length,
            pages: pages.length
        });
        
        // Verificar se o usuário está autenticado (via token JWT no state ou session)
        let currentUserId = null;
        
        // Tentar extrair userId do state (se foi passado durante a autenticação)
        if (state) {
            try {
                const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
                currentUserId = stateData.userId;
            } catch (e) {
                console.warn('⚠️ Não foi possível extrair userId do state');
            }
        }
        
        // Se não temos userId, precisamos que o usuário esteja logado
        if (!currentUserId) {
            console.error('❌ Usuário não autenticado para integração OAuth');
            const errorRedirect = process.env.OAUTH_ERROR_REDIRECT || '/integracoes.html';
            return res.redirect(`${errorRedirect}?success=false&error=${encodeURIComponent('Usuário deve estar logado para conectar Meta Ads')}`);
        }
        
        // Salvar dados do OAuth no MongoDB
        try {
            const facebookIntegration = {
                user: {
                    id: userData.id,
                    name: userData.name,
                    email: userData.email || ''
                },
                accessToken: longLivedToken,
                tokenType: 'long_lived',
                adAccounts: adAccounts,
                pages: pages,
                connectedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            
            console.log('🔍 DEBUG - Dados a serem salvos:', {
                userId: currentUserId,
                facebookUserId: userData.id,
                facebookUserName: userData.name,
                hasAccessToken: !!longLivedToken,
                adAccountsCount: adAccounts?.length || 0,
                pagesCount: pages?.length || 0
            });
            
            // Atualizar usuário no MongoDB com dados da integração Facebook
            if (usersCollection) {
                const updateResult = await usersCollection.updateOne(
                    { id: currentUserId },
                    { 
                        $set: { 
                            'integrations.facebook': facebookIntegration,
                            updatedAt: new Date().toISOString()
                        } 
                    }
                );
                console.log('✅ Dados do Facebook salvos no MongoDB para usuário:', currentUserId);
                console.log('🔍 DEBUG - Resultado da atualização:', {
                    matchedCount: updateResult.matchedCount,
                    modifiedCount: updateResult.modifiedCount,
                    acknowledged: updateResult.acknowledged
                });
            } else {
                console.warn('⚠️ MongoDB não disponível - dados não salvos');
            }
            
        } catch (dbError) {
            console.error('❌ Erro ao salvar dados do Meta Ads no MongoDB:', dbError);
            const errorRedirect = process.env.OAUTH_ERROR_REDIRECT || '/integracoes.html';
            return res.redirect(`${errorRedirect}?success=false&error=${encodeURIComponent('Erro ao salvar dados da integração')}`);
        }
        
        // Redirecionar para página de sucesso com dados do Facebook
        const successMessage = `Facebook conectado com sucesso! Usuário: ${userData.name}, ${adAccounts.length} conta(s) de anúncios, ${pages.length} página(s).`;
        const successRedirect = process.env.OAUTH_SUCCESS_REDIRECT || '/integracoes.html';
        
        // Incluir dados essenciais do Facebook para exibição imediata
        const redirectParams = new URLSearchParams({
            oauth_success: 'true',
            message: successMessage,
            facebook_user_id: userData.id,
            facebook_user_name: userData.name,
            facebook_user_email: userData.email || '',
            ad_accounts_count: adAccounts.length,
            pages_count: pages.length,
            connected_at: new Date().toISOString()
        });
        
        console.log('🔄 Redirecionando para integracoes.html com dados do Facebook:', {
            userId: userData.id,
            userName: userData.name,
            adAccountsCount: adAccounts.length,
            pagesCount: pages.length
        });
        
        res.redirect(`${successRedirect}?${redirectParams.toString()}`);
        
    } catch (error) {
        console.error('❌ Erro no callback OAuth 2.0:', error.response?.data || error.message);
        const errorRedirect = process.env.OAUTH_ERROR_REDIRECT || '/integracoes.html';
        res.redirect(`${errorRedirect}?oauth_success=false&error=${encodeURIComponent('Falha na autenticação OAuth 2.0')}`);
    }
});

// Endpoint /auth/callback → rota de compatibilidade para redirecionamento do Facebook
// Redireciona para /auth/facebook/callback para manter compatibilidade
app.get('/auth/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        if (error) {
            console.error('❌ Erro no OAuth Facebook (callback genérico):', error);
            const errorRedirect = process.env.OAUTH_ERROR_REDIRECT || '/integracoes.html';
            return res.redirect(`${errorRedirect}?success=false&error=${encodeURIComponent(error)}`);
        }
        
        if (!code) {
            console.error('❌ Código de autorização não recebido (callback genérico)');
            const errorRedirect = process.env.OAUTH_ERROR_REDIRECT || '/integracoes.html';
            return res.redirect(`${errorRedirect}?success=false&error=${encodeURIComponent('Código de autorização não recebido')}`);
        }
        
        console.log('🔄 Trocando code por access_token (callback genérico)...');
        
        // Trocar o code por um access_token usando a API oficial
        const redirectUri = process.env.OAUTH_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/facebook/callback`;
        
        const tokenResponse = await axios.post('https://graph.facebook.com/v21.0/oauth/access_token', {
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            redirect_uri: redirectUri,
            code: code
        });
        
        const accessToken = tokenResponse.data.access_token;
        console.log('✅ Access token obtido com sucesso (callback genérico)');
        
        // Obter dados do usuário
        const userResponse = await axios.get('https://graph.facebook.com/me', {
            params: {
                access_token: accessToken,
                fields: 'id,name,email'
            }
        });
        
        const userData = userResponse.data;
        console.log('✅ Dados do usuário obtidos (callback genérico):', userData);
        
        // Obter contas de anúncios
        const adAccountsResponse = await axios.get('https://graph.facebook.com/me/adaccounts', {
            params: {
                access_token: accessToken,
                fields: 'id,name,account_status,currency'
            }
        });
        
        const adAccounts = adAccountsResponse.data.data || [];
        console.log(`✅ ${adAccounts.length} conta(s) de anúncios encontrada(s) (callback genérico)`);
        
        // Obter páginas do Facebook
        const pagesResponse = await axios.get('https://graph.facebook.com/me/accounts', {
            params: {
                access_token: accessToken,
                fields: 'id,name,access_token'
            }
        });
        
        const pages = pagesResponse.data.data || [];
        console.log(`✅ ${pages.length} página(s) encontrada(s) (callback genérico)`);
        
        // Gerar token de longo prazo (60 dias)
        console.log('🔄 Gerando token de longo prazo (callback genérico)...');
        const longTokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                fb_exchange_token: accessToken
            }
        });
        
        const longLivedToken = longTokenResponse.data.access_token;
        console.log('✅ Token de longo prazo gerado com sucesso (callback genérico)');
        
        // Aqui você salvaria no banco de dados
        // Exemplo: await saveUserOAuthData(userData, longLivedToken, adAccounts, pages);
        
        // Redirecionar para página de sucesso com dados do Facebook
        const successMessage = `Facebook conectado com sucesso! Usuário: ${userData.name}, ${adAccounts.length} conta(s) de anúncios, ${pages.length} página(s).`;
        
        const redirectParams = new URLSearchParams({
            oauth_success: 'true',
            message: successMessage,
            facebook_user_id: userData.id,
            facebook_user_name: userData.name,
            facebook_user_email: userData.email || '',
            ad_accounts_count: adAccounts.length,
            pages_count: pages.length,
            connected_at: new Date().toISOString(),
            token_type: 'long_lived'
        });
        
        res.redirect(`/integracoes.html?${redirectParams.toString()}`);
        
    } catch (error) {
        console.error('❌ Erro no callback OAuth 2.0 (callback genérico):', error.response?.data || error.message);
        res.redirect(`/integracoes.html?oauth_success=false&error=${encodeURIComponent('Falha na autenticação OAuth 2.0')}`);
    }
});

// Endpoint /auth/facebook/revoke → revoga o token do usuário
app.post('/auth/facebook/revoke', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'ID do usuário é obrigatório' 
            });
        }

        console.log('🔄 Revogando token Facebook para usuário:', userId);

        // Buscar o usuário no banco de dados
        const user = await usersCollection.findOne({ _id: userId });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Usuário não encontrado' 
            });
        }

        // Se o usuário tem um token do Facebook, tentar revogar na API do Facebook
        if (user.facebookAccessToken) {
            try {
                const revokeUrl = `https://graph.facebook.com/v21.0/me/permissions?access_token=${user.facebookAccessToken}`;
                
                console.log('🔗 Revogando token na API do Facebook...');
                const response = await axios.delete(revokeUrl);
                
                if (response.data && response.data.success) {
                    console.log('✅ Token revogado com sucesso na API do Facebook');
                } else {
                    console.log('⚠️ Resposta inesperada da API do Facebook:', response.data);
                }
            } catch (facebookError) {
                console.error('❌ Erro ao revogar token na API do Facebook:', facebookError.response?.data || facebookError.message);
                // Continuar mesmo se a revogação no Facebook falhar
            }
        }

        // Remover dados do Facebook do usuário no banco de dados
        const updateResult = await usersCollection.updateOne(
            { _id: userId },
            { 
                $unset: { 
                    facebookAccessToken: "",
                    facebookUserId: "",
                    facebookUserName: "",
                    facebookEmail: "",
                    facebookProfilePicture: "",
                    facebookConnectedAt: ""
                }
            }
        );

        if (updateResult.modifiedCount > 0) {
            console.log('✅ Dados do Facebook removidos do usuário no banco de dados');
            res.json({ 
                success: true, 
                message: 'Token revogado e dados removidos com sucesso' 
            });
        } else {
            console.log('⚠️ Nenhum dado foi modificado no banco de dados');
            res.json({ 
                success: true, 
                message: 'Token já estava revogado ou usuário não tinha dados do Facebook' 
            });
        }

    } catch (error) {
        console.error('❌ Erro ao revogar token OAuth:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor ao revogar token' 
        });
    }
});

// ===== FIM DAS ROTAS OAUTH =====

// Middleware para desabilitar cache em arquivos JS
app.use('/js', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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
                // Definir permissões corretas após salvar o arquivo
                setCorrectFilePermissions(filePath);
                
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

        // Aguardar aquecimento dos proxies se necessário
        if (!proxiesWarmedUp) {
            console.log('⏳ Aguardando aquecimento dos proxies...');
            await warmUpProxies();
        }

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

// ===== ENDPOINTS SEGUROS DO META/FACEBOOK =====

// Endpoint para trocar código por token de acesso (seguro)
app.post('/api/meta/exchange-token', async (req, res) => {
    try {
        const { code, redirectUri } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Código de autorização é obrigatório' });
        }

        // Trocar código por token usando app secret do backend
        const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
            params: {
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                redirect_uri: redirectUri || 'https://nextads.pro/auth/facebook/callback',
                code: code
            }
        });

        const { access_token, token_type, expires_in } = tokenResponse.data;

        // Obter informações do usuário
        const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
            params: {
                access_token: access_token,
                fields: 'id,name,email'
            }
        });

        // Obter permissões concedidas
        const permissionsResponse = await axios.get('https://graph.facebook.com/v18.0/me/permissions', {
            params: {
                access_token: access_token
            }
        });

        res.json({
            success: true,
            token: access_token,
            tokenType: token_type,
            expiresIn: expires_in,
            user: userResponse.data,
            permissions: permissionsResponse.data.data
        });

    } catch (error) {
        console.error('❌ Erro ao trocar token:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao trocar código por token',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint para obter Ad Accounts do usuário (seguro)
app.post('/api/meta/ad-accounts', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({ error: 'Token de acesso é obrigatório' });
        }

        // Obter Ad Accounts
        const adAccountsResponse = await axios.get('https://graph.facebook.com/v18.0/me/adaccounts', {
            params: {
                access_token: accessToken,
                fields: 'id,name,account_status,currency,timezone_name,business,amount_spent,balance,account_id'
            }
        });

        res.json({
            success: true,
            adAccounts: adAccountsResponse.data.data
        });

    } catch (error) {
        console.error('❌ Erro ao obter Ad Accounts:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao obter Ad Accounts',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint para verificar permissões do token (seguro)
app.post('/api/meta/verify-permissions', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({ error: 'Token de acesso é obrigatório' });
        }

        // Verificar permissões
        const permissionsResponse = await axios.get('https://graph.facebook.com/v18.0/me/permissions', {
            params: {
                access_token: accessToken
            }
        });

        const permissions = permissionsResponse.data.data;
        const grantedPermissions = permissions.filter(p => p.status === 'granted').map(p => p.permission);

        res.json({
            success: true,
            permissions: grantedPermissions,
            hasAdsRead: grantedPermissions.includes('ads_read'),
            hasAdsManagement: grantedPermissions.includes('ads_management'),
            hasBusinessManagement: grantedPermissions.includes('business_management')
        });

    } catch (error) {
        console.error('❌ Erro ao verificar permissões:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao verificar permissões',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint para criar campanha usando System User Token (seguro)
app.post('/api/meta/create-campaign', async (req, res) => {
    try {
        const { campaignData, adAccountId } = req.body;
        
        if (!campaignData || !adAccountId) {
            return res.status(400).json({ error: 'Dados da campanha e Ad Account ID são obrigatórios' });
        }

        // Usar System User Token para criar campanha
        const systemToken = process.env.META_SYSTEM_USER_TOKEN;
        
        if (!systemToken) {
            return res.status(500).json({ error: 'System User Token não configurado' });
        }

        // Criar campanha
        const campaignResponse = await axios.post(`https://graph.facebook.com/v18.0/${adAccountId}/campaigns`, {
            name: campaignData.name,
            objective: campaignData.objective,
            status: 'PAUSED', // Sempre criar pausada por segurança
            special_ad_categories: campaignData.special_ad_categories || []
        }, {
            params: {
                access_token: systemToken
            }
        });

        res.json({
            success: true,
            campaign: campaignResponse.data
        });

    } catch (error) {
        console.error('❌ Erro ao criar campanha:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao criar campanha',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint para listar campanhas de uma conta de anúncios (seguro)
app.post('/api/meta/campaigns', async (req, res) => {
    try {
        const { adAccountId, accessToken } = req.body;
        
        if (!adAccountId || !accessToken) {
            return res.status(400).json({ error: 'ID da conta de anúncios e token de acesso são obrigatórios' });
        }

        // Listar campanhas
        const campaignsResponse = await axios.get(`https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,status,objective,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget,budget_remaining,spend_cap'
            }
        });

        res.json({
            success: true,
            campaigns: campaignsResponse.data.data,
            paging: campaignsResponse.data.paging
        });

    } catch (error) {
        console.error('❌ Erro ao listar campanhas:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao listar campanhas',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint para obter detalhes de uma campanha específica (seguro)
app.post('/api/meta/campaign/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({ error: 'Token de acesso é obrigatório' });
        }

        // Obter detalhes da campanha
        const campaignResponse = await axios.get(`https://graph.facebook.com/v18.0/${campaignId}`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,status,objective,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget,budget_remaining,spend_cap,insights{impressions,clicks,spend,cpm,cpc,ctr,reach,frequency}'
            }
        });

        res.json({
            success: true,
            campaign: campaignResponse.data
        });

    } catch (error) {
        console.error('❌ Erro ao obter detalhes da campanha:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao obter detalhes da campanha',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint para atualizar uma campanha (seguro)
app.put('/api/meta/campaign/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { accessToken, updates } = req.body;
        
        if (!accessToken || !updates) {
            return res.status(400).json({ error: 'Token de acesso e dados de atualização são obrigatórios' });
        }

        // Atualizar campanha
        const updateResponse = await axios.post(`https://graph.facebook.com/v18.0/${campaignId}`, {
            ...updates,
            access_token: accessToken
        });

        res.json({
            success: true,
            result: updateResponse.data
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar campanha:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao atualizar campanha',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint para pausar/ativar campanha (seguro)
app.post('/api/meta/campaign/:campaignId/status', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { accessToken, status } = req.body;
        
        if (!accessToken || !status) {
            return res.status(400).json({ error: 'Token de acesso e status são obrigatórios' });
        }

        // Validar status
        const validStatuses = ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status inválido. Use: ACTIVE, PAUSED, DELETED ou ARCHIVED' });
        }

        // Atualizar status da campanha
        const statusResponse = await axios.post(`https://graph.facebook.com/v18.0/${campaignId}`, {
            status: status,
            access_token: accessToken
        });

        res.json({
            success: true,
            result: statusResponse.data
        });

    } catch (error) {
        console.error('❌ Erro ao alterar status da campanha:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao alterar status da campanha',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Endpoint para obter insights de campanhas (seguro)
app.post('/api/meta/campaigns/insights', async (req, res) => {
    try {
        const { adAccountId, accessToken, dateRange, metrics } = req.body;
        
        if (!adAccountId || !accessToken) {
            return res.status(400).json({ error: 'ID da conta de anúncios e token de acesso são obrigatórios' });
        }

        const defaultMetrics = ['impressions', 'clicks', 'spend', 'cpm', 'cpc', 'ctr', 'reach', 'frequency'];
        const requestedMetrics = metrics || defaultMetrics;

        let params = {
            access_token: accessToken,
            fields: requestedMetrics.join(','),
            level: 'campaign'
        };

        // Adicionar filtro de data se fornecido
        if (dateRange && dateRange.since && dateRange.until) {
            params.time_range = JSON.stringify({
                since: dateRange.since,
                until: dateRange.until
            });
        }

        // Obter insights
        const insightsResponse = await axios.get(`https://graph.facebook.com/v18.0/act_${adAccountId}/insights`, {
            params: params
        });

        res.json({
            success: true,
            insights: insightsResponse.data.data,
            paging: insightsResponse.data.paging
        });

    } catch (error) {
        console.error('❌ Erro ao obter insights:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao obter insights',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// API para obter municípios
app.get('/api/municipios', (req, res) => {
    try {
        console.log('🏙️ [MUNICIPIOS] Requisição recebida');
        console.log('🏙️ [MUNICIPIOS] Headers da requisição:', req.headers);
        
        // Ler arquivo com tratamento de BOM
        let rawData = fs.readFileSync(path.join(__dirname, 'municipios.json'), 'utf8');
        
        // Remover BOM se existir
        if (rawData.charCodeAt(0) === 0xFEFF) {
            rawData = rawData.slice(1);
        }
        
        // Remover caracteres invisíveis do início
        rawData = rawData.trim();
        
        const municipios = JSON.parse(rawData);
        console.log('🏙️ [MUNICIPIOS] Dados carregados:', municipios.length, 'municípios');
        
        // Desabilitar cache para debug
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        res.json(municipios);
        console.log('🏙️ [MUNICIPIOS] Resposta enviada com sucesso');
        
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
            
            // Aplicar permissões corretas ao arquivo recém-salvo
            setCorrectFilePermissions(file.path);
            
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
                    
                    // Aplicar permissões corretas ao arquivo JPG convertido
                    setCorrectFilePermissions(jpgPath);
                    
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
            correlationID: originalCorrelationID,
            useSandbox
        } = req.body;
        
        // Declarar correlationID como variável mutável
        let correlationID = originalCorrelationID;
        
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
        
        // Validação mais detalhada
        console.log('🔍 [ROUTE] Validando parâmetros...');
        console.log('💰 [ROUTE] Valor válido?', value !== undefined && value !== null && !isNaN(value) && value > 0);
        console.log('⏰ [ROUTE] Expiração válida?', expiration !== undefined && expiration !== null && !isNaN(expiration) && expiration > 0);
        
        if (!value || !expiration || isNaN(value) || isNaN(expiration) || value <= 0 || expiration <= 0) {
            console.log('❌ [ROUTE] Validação falhou: valor ou duração inválidos');
            console.log('❌ [ROUTE] Detalhes da validação:', {
                value: { valor: value, tipo: typeof value, valido: !!(value && !isNaN(value) && value > 0) },
                expiration: { valor: expiration, tipo: typeof expiration, valido: !!(expiration && !isNaN(expiration) && expiration > 0) }
            });
            return res.status(400).json({
                success: false,
                error: 'Valor e duração são obrigatórios e devem ser números válidos maiores que zero'
            });
        }
        
        // Gerar correlationID se não fornecido
        if (!correlationID || correlationID === null || correlationID === undefined || correlationID === '') {
            correlationID = `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log('🔄 [ROUTE] CorrelationID gerado automaticamente:', correlationID);
        }
        
        // Verificar se correlationID já existe nas transações pendentes
        if (pendingTransactions.has(correlationID)) {
            console.log('⚠️ [ROUTE] CorrelationID duplicado detectado:', correlationID);
            return res.status(400).json({
                success: false,
                error: 'CorrelationID já existe. Tente novamente com um ID único.',
                code: 'DUPLICATE_CORRELATION_ID'
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
        // Propagar status e mensagem reais quando disponíveis
        const statusCode = (error && error.response && error.response.status) ? error.response.status : 500;
        const errorMessage = (error && error.message) ? error.message : 'Erro interno do servidor';
        const errorDetails = {
            wooviStatus: error?.response?.status,
            wooviData: error?.response?.data,
            wooviHeaders: error?.response?.headers,
            requestUrl: error?.config?.url,
            requestData: error?.config?.data
        };
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: errorDetails
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
        console.log('📦 [SERVER] Dados recebidos:', JSON.stringify(data, null, 2));
        console.log('🔧 [SERVER] Verificando configurações Woovi...');
        console.log('🔑 [SERVER] WOOVI_CONFIG.appId:', WOOVI_CONFIG.appId ? 'Presente' : 'AUSENTE');
        console.log('🧪 [SERVER] WOOVI_CONFIG.sandboxAppId:', WOOVI_CONFIG.sandboxAppId ? 'Presente' : 'AUSENTE');
        console.log('🌐 [SERVER] WOOVI_CONFIG.baseURL:', WOOVI_CONFIG.baseURL);
        console.log('🧪 [SERVER] WOOVI_CONFIG.sandboxURL:', WOOVI_CONFIG.sandboxURL);
        
        // Determinar qual URL usar baseado no parâmetro useSandbox
        const apiURL = data.useSandbox ? WOOVI_CONFIG.sandboxURL : WOOVI_CONFIG.baseURL;
        console.log('🌐 [SERVER] Modo:', data.useSandbox ? 'SANDBOX' : 'PRODUÇÃO');
        console.log('🔗 [SERVER] URL selecionada:', apiURL);
        
        // Buscar dados do usuário baseado no campaignId
        let customerData = {};
        
        // Extrair campaignId do additionalInfo
        let campaignId = null;
        console.log('🔍 [SERVER] Verificando additionalInfo:', JSON.stringify(data.additionalInfo, null, 2));
        if (data.additionalInfo && Array.isArray(data.additionalInfo)) {
            console.log('✅ [SERVER] AdditionalInfo é um array válido com', data.additionalInfo.length, 'itens');
            const campaignInfo = data.additionalInfo.find(info => info.key === 'campaignId');
            if (campaignInfo) {
                campaignId = campaignInfo.value;
                console.log('🆔 [SERVER] CampaignId encontrado no additionalInfo:', campaignId);
            } else {
                console.log('❌ [SERVER] CampaignId NÃO encontrado no additionalInfo');
                console.log('📋 [SERVER] Chaves disponíveis:', data.additionalInfo.map(info => info.key));
            }
        } else {
            console.log('❌ [SERVER] AdditionalInfo não é um array válido ou está vazio');
        }
        
        if (campaignId && db && campaignsCollection && usersCollection) {
            try {
                console.log('🔍 [SERVER] Buscando campanha no MongoDB...');
                console.log('🔍 [SERVER] CampaignId para busca:', campaignId);
                console.log('🔍 [SERVER] Tipo do campaignId:', typeof campaignId);
                console.log('🔍 [SERVER] Conexões disponíveis - db:', !!db, 'campaignsCollection:', !!campaignsCollection, 'usersCollection:', !!usersCollection);
                
                // Buscar a campanha para obter o userId
                const campaign = await campaignsCollection.findOne({ 
                    $or: [
                        { _id: campaignId },
                        { id: campaignId },
                        { campaignId: campaignId }
                    ]
                });
                
                console.log('🔍 [SERVER] Resultado da busca da campanha:', campaign ? 'ENCONTRADA' : 'NÃO ENCONTRADA');
                if (campaign) {
                    console.log('📋 [SERVER] Dados da campanha encontrada:', {
                        _id: campaign._id,
                        id: campaign.id,
                        campaignId: campaign.campaignId,
                        userId: campaign.userId,
                        businessName: campaign.businessName
                    });
                }
                
                if (campaign && campaign.userId) {
                    console.log('✅ [SERVER] Campanha encontrada, userId:', campaign.userId);
                    console.log('🔍 [SERVER] Tipo do userId:', typeof campaign.userId);
                    
                    // Buscar dados do usuário
                    const user = await usersCollection.findOne({ 
                        $or: [
                            { _id: campaign.userId },
                            { id: campaign.userId },
                            { userId: campaign.userId }
                        ]
                    });
                    
                    console.log('🔍 [SERVER] Resultado da busca do usuário:', user ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
                    if (user) {
                        console.log('✅ [SERVER] Usuário encontrado:', {
                            _id: user._id,
                            id: user.id,
                            userId: user.userId,
                            nome: user.nome || user.name,
                            email: user.email,
                            whatsapp: user.whatsapp || user.phone
                        });
                        
                        // Preparar dados do customer
                        customerData = {
                            name: user.nome || user.name,
                            email: user.email,
                            phone: user.whatsapp || user.phone
                        };
                        
                        // Remover campos vazios
                        Object.keys(customerData).forEach(key => {
                            if (!customerData[key]) {
                                delete customerData[key];
                            }
                        });
                        
                        console.log('📋 [SERVER] Dados do customer preparados:', customerData);
                    } else {
                        console.log('⚠️ [SERVER] Usuário não encontrado para userId:', campaign.userId);
                        console.log('🔍 [SERVER] Tentando buscar todos os usuários para debug...');
                        const allUsers = await usersCollection.find({}).limit(5).toArray();
                        console.log('📊 [SERVER] Primeiros 5 usuários no banco:', allUsers.map(u => ({ _id: u._id, id: u.id, userId: u.userId, nome: u.nome || u.name })));
                    }
                } else {
                    console.log('⚠️ [SERVER] Campanha não encontrada ou sem userId para campaignId:', campaignId);
                    if (!campaign) {
                        console.log('🔍 [SERVER] Tentando buscar todas as campanhas para debug...');
                        const allCampaigns = await campaignsCollection.find({}).limit(5).toArray();
                        console.log('📊 [SERVER] Primeiras 5 campanhas no banco:', allCampaigns.map(c => ({ _id: c._id, id: c.id, campaignId: c.campaignId, userId: c.userId })));
                    }
                }
            } catch (dbError) {
                console.error('❌ [SERVER] Erro ao buscar dados do usuário:', dbError);
                console.error('❌ [SERVER] Stack trace:', dbError.stack);
                // Continuar sem dados do customer em caso de erro
            }
        } else {
            console.log('⚠️ [SERVER] Condições não atendidas:');
            console.log('   - CampaignId:', campaignId ? 'PRESENTE' : 'AUSENTE');
            console.log('   - DB:', db ? 'CONECTADO' : 'DESCONECTADO');
            console.log('   - CampaignsCollection:', campaignsCollection ? 'DISPONÍVEL' : 'INDISPONÍVEL');
            console.log('   - UsersCollection:', usersCollection ? 'DISPONÍVEL' : 'INDISPONÍVEL');
        }
        
        const chargeData = {
            correlationID: data.correlationID, // Usar sempre o correlationID fornecido pelo frontend
            value: data.value, // valor em centavos
            comment: data.comment || "Pagamento de campanha publicitária",
            expiresIn: data.expiresIn || 900, // usar expiresIn fornecido ou padrão de 15 minutos
            webhook: {
                url: WOOVI_CONFIG.webhookURL
            }
        };
        
        // Adicionar customer - priorizar dados do banco, depois dados fornecidos manualmente
        const finalCustomerData = {
            ...customerData, // Dados do banco (prioridade)
            ...(data.customerName && { name: data.customerName }),
            ...(data.customerEmail && { email: data.customerEmail }),
            ...(data.customerPhone && { phone: data.customerPhone }),
            ...(data.customerTaxID && { taxID: data.customerTaxID })
        };
        
        if (Object.keys(finalCustomerData).length > 0) {
            chargeData.customer = finalCustomerData;
            console.log('👤 [SERVER] Customer adicionado ao payload:', finalCustomerData);
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
                timeout: 60000 // 1 minuto
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
                    const apiErrorMessage = error.response.data?.message || '';
                    if (apiErrorMessage.toLowerCase().includes('correlation') || 
                        apiErrorMessage.toLowerCase().includes('duplicate') ||
                        apiErrorMessage.toLowerCase().includes('already exists')) {
                        errorMessage = `CorrelationID duplicado: ${apiErrorMessage}. Tente novamente.`;
                    } else {
                        errorMessage = `Dados inválidos: ${apiErrorMessage || 'Verifique os campos obrigatórios (value e correlationID)'}`;
                    }
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
app.post('/api/woovi-webhook', async (req, res) => {
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
                
                // Extrair campaignId do additionalInfo da transação pendente
                let campaignId = null;
                if (pendingTransaction.additionalInfo && Array.isArray(pendingTransaction.additionalInfo)) {
                    const campaignInfo = pendingTransaction.additionalInfo.find(info => info.key === 'campaignId');
                    if (campaignInfo) {
                        campaignId = campaignInfo.value;
                        console.log(`🆔 [WEBHOOK] CampaignId extraído do additionalInfo: ${campaignId}`);
                    }
                }
                
                // Armazenar o pagamento como processado
                processedPayments.set(charge.correlationID, {
                    status: 'COMPLETED',
                    paidAt: new Date().toISOString(),
                    value: charge.value,
                    event: event,
                    validatedAt: new Date().toISOString(),
                    pendingData: pendingTransaction,
                    campaignId: campaignId
                });
                
                // Atualizar currentProgress para 4 automaticamente após pagamento confirmado
                if (campaignId) {
                    try {
                        console.log(`🔄 [WEBHOOK] Atualizando currentProgress para 4 da campanha: ${campaignId}`);
                        
                        const updateResult = await db.collection('campaigns').updateOne(
                            { campaignId: campaignId },
                            { 
                                $set: { 
                                    currentProgress: 4,
                                    updatedAt: new Date(),
                                    paymentConfirmedAt: new Date(),
                                    paymentCorrelationID: charge.correlationID
                                }
                            }
                        );
                        
                        if (updateResult.matchedCount > 0) {
                            console.log(`✅ [WEBHOOK] CurrentProgress atualizado para 4 com sucesso para campanha: ${campaignId}`);
                            logTransactionAudit('CAMPAIGN_PROGRESS_UPDATED', charge.correlationID, {
                                campaignId: campaignId,
                                newProgress: 4,
                                previousProgress: 3
                            });
                            
                            // Sincronizar automaticamente com o array campaigns do usuário
                            try {
                                console.log(`🔄 [WEBHOOK] Iniciando sincronização automática para campanha: ${campaignId}`);
                                await syncCampaignToUserArray(campaignId);
                                console.log(`✅ [WEBHOOK] Sincronização automática concluída para campanha: ${campaignId}`);
                            } catch (syncError) {
                                console.error(`❌ [WEBHOOK] Erro na sincronização automática para campanha ${campaignId}:`, syncError);
                            }
                        } else {
                            console.warn(`⚠️ [WEBHOOK] Campanha não encontrada no MongoDB: ${campaignId}`);
                            logTransactionAudit('CAMPAIGN_NOT_FOUND', charge.correlationID, {
                                campaignId: campaignId
                            });
                        }
                    } catch (error) {
                        console.error(`❌ [WEBHOOK] Erro ao atualizar currentProgress da campanha ${campaignId}:`, error);
                        logTransactionAudit('CAMPAIGN_UPDATE_ERROR', charge.correlationID, {
                            campaignId: campaignId,
                            error: error.message
                        });
                    }
                } else {
                    console.warn(`⚠️ [WEBHOOK] CampaignId não encontrado no additionalInfo para correlationID: ${charge.correlationID}`);
                    logTransactionAudit('CAMPAIGN_ID_NOT_FOUND', charge.correlationID, {
                        additionalInfo: pendingTransaction.additionalInfo
                    });
                }
                
                // Remover da lista de pendentes
                pendingTransactions.delete(charge.correlationID);
                
                logTransactionAudit('PAYMENT_VALIDATED', charge.correlationID, {
                    value: charge.value,
                    event: event,
                    campaignId: campaignId
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
            
            // Extrair campaignId do additionalInfo da transação pendente
            let campaignId = null;
            if (pendingTransaction.additionalInfo && Array.isArray(pendingTransaction.additionalInfo)) {
                const campaignInfo = pendingTransaction.additionalInfo.find(info => info.key === 'campaignId');
                if (campaignInfo) {
                    campaignId = campaignInfo.value;
                    console.log(`🆔 [POLLING] CampaignId extraído do additionalInfo: ${campaignId}`);
                }
            }
            
            // Armazenar como processado
            const processedPayment = {
                status: 'COMPLETED',
                paidAt: charge.paidAt || new Date().toISOString(),
                value: charge.value,
                event: 'POLLING_CONFIRMED',
                validatedAt: new Date().toISOString(),
                pendingData: pendingTransaction,
                chargeData: charge,
                campaignId: campaignId
            };
            
            // Atualizar currentProgress para 4 automaticamente após pagamento confirmado
            if (campaignId) {
                try {
                    console.log(`🔄 [POLLING] Atualizando currentProgress para 4 da campanha: ${campaignId}`);
                    
                    const updateResult = await db.collection('campaigns').updateOne(
                        { campaignId: campaignId },
                        { 
                            $set: { 
                                currentProgress: 4,
                                updatedAt: new Date(),
                                paymentConfirmedAt: new Date(),
                                paymentCorrelationID: correlationID
                            }
                        }
                    );
                    
                    if (updateResult.matchedCount > 0) {
                        console.log(`✅ [POLLING] CurrentProgress atualizado para 4 com sucesso para campanha: ${campaignId}`);
                        logTransactionAudit('CAMPAIGN_PROGRESS_UPDATED', correlationID, {
                            campaignId: campaignId,
                            newProgress: 4,
                            previousProgress: 3,
                            method: 'polling'
                        });
                        
                        // Sincronizar automaticamente com o array campaigns do usuário
                        try {
                            console.log(`🔄 [POLLING] Iniciando sincronização automática para campanha: ${campaignId}`);
                            await syncCampaignToUserArray(campaignId);
                            console.log(`✅ [POLLING] Sincronização automática concluída para campanha: ${campaignId}`);
                        } catch (syncError) {
                            console.error(`❌ [POLLING] Erro na sincronização automática para campanha ${campaignId}:`, syncError);
                        }
                    } else {
                        console.warn(`⚠️ [POLLING] Campanha não encontrada no MongoDB: ${campaignId}`);
                        logTransactionAudit('CAMPAIGN_NOT_FOUND', correlationID, {
                            campaignId: campaignId,
                            method: 'polling'
                        });
                    }
                } catch (error) {
                    console.error(`❌ [POLLING] Erro ao atualizar currentProgress da campanha ${campaignId}:`, error);
                    logTransactionAudit('CAMPAIGN_UPDATE_ERROR', correlationID, {
                        campaignId: campaignId,
                        error: error.message,
                        method: 'polling'
                    });
                }
            } else {
                console.warn(`⚠️ [POLLING] CampaignId não encontrado no additionalInfo para correlationID: ${correlationID}`);
                logTransactionAudit('CAMPAIGN_ID_NOT_FOUND', correlationID, {
                    additionalInfo: pendingTransaction.additionalInfo,
                    method: 'polling'
                });
            }
            
            processedPayments.set(correlationID, processedPayment);
            pendingTransactions.delete(correlationID);
            
            logTransactionAudit('PAYMENT_VALIDATED', correlationID, {
                value: charge.value,
                method: 'polling',
                paidAt: charge.paidAt,
                campaignId: campaignId
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

// ==================== HELPER FUNCTIONS ====================

// Função para atualizar o array de campanhas do usuário
async function updateUserCampaignsArray(userId, campaignData) {
    try {
        console.log(`🔄 Atualizando array de campanhas para usuário ${userId}...`);
        
        // Verificar se a campanha tem currentProgress = 3 antes de adicionar ao array do usuário
        if (campaignData.currentProgress !== 3) {
            console.log(`⚠️ Campanha ${campaignData.id} não será adicionada ao array do usuário - currentProgress: ${campaignData.currentProgress} (necessário: 3)`);
            return false;
        }
        
        console.log(`✅ Campanha ${campaignData.id} qualificada para o array do usuário - currentProgress: 3`);
        
        // Preparar dados COMPLETOS da campanha para o array do usuário
        const campaignSummary = {
            id: campaignData.id,
            campaignId: campaignData.campaignId,
            name: campaignData.name,
            status: campaignData.status || 'active',
            createdAt: campaignData.createdAt,
            updatedAt: campaignData.updatedAt || new Date().toISOString(),
            completedAt: campaignData.completedAt,
            currentStep: campaignData.currentStep,
            completedSteps: campaignData.completedSteps || [],
            campaignData: campaignData.campaignData || {},
            objective: campaignData.objective,
            direction: campaignData.direction,
            creative: campaignData.creative,
            profile: campaignData.profile,
            profileData: campaignData.profileData,
            location: campaignData.location,
            gender: campaignData.gender,
            age: campaignData.age,
            duration: campaignData.duration,
            index: campaignData.index,
            siteUrl: campaignData.siteUrl,
            audience: campaignData.audience,
            markets: campaignData.markets,
            // Parâmetros UTM completos
            utm_source: campaignData.utm_source,
            utm_medium: campaignData.utm_medium,
            utm_campaign: campaignData.utm_campaign,
            utm_term: campaignData.utm_term,
            utm_content: campaignData.utm_content,
            utm: campaignData.utm || {
                utm_source: campaignData.utm_source,
                utm_medium: campaignData.utm_medium,
                utm_campaign: campaignData.utm_campaign,
                utm_term: campaignData.utm_term,
                utm_content: campaignData.utm_content
            },
            // Arquivos
            files: campaignData.files || campaignData.uploadedFiles || [],
            uploadedFiles: campaignData.uploadedFiles || campaignData.files || [],
            // Progresso
            progressSteps: campaignData.progressSteps || [],
            currentProgress: campaignData.currentProgress || 0,
            progress: campaignData.progress || campaignData.currentProgress || 0,
            // Status de conclusão
            isAbandoned: campaignData.isAbandoned || false,
            isCompleted: campaignData.isCompleted || false,
            lastSaved: campaignData.lastSaved || new Date().toISOString(),
            userId: campaignData.userId
        };

        // Tentar via MCP primeiro
        if (global.runMCP) {
            try {
                console.log('🔄 Tentando atualizar via MCP...');
                
                // Buscar usuário atual
                const getUserResult = await global.runMCP('mongodb', 'find', {
                    database: DB_NAME,
                    collection: USERS_COLLECTION_NAME,
                    query: { id: userId }
                });

                if (getUserResult && getUserResult.length > 0) {
                    const user = getUserResult[0];
                    let campaigns = user.campaigns || [];
                    
                    // Verificar se a campanha já existe no array
                    const existingIndex = campaigns.findIndex(c => c.id === campaignData.id);
                    
                    if (existingIndex >= 0) {
                        // Atualizar campanha existente
                        campaigns[existingIndex] = campaignSummary;
                        console.log('📝 Campanha existente atualizada no array');
                    } else {
                        // Adicionar nova campanha
                        campaigns.push(campaignSummary);
                        console.log('➕ Nova campanha adicionada ao array');
                    }

                    // Atualizar usuário via MCP
                    await global.runMCP('mongodb', 'updateOne', {
                        database: DB_NAME,
                        collection: USERS_COLLECTION_NAME,
                        filter: { id: userId },
                        update: { 
                            $set: { 
                                campaigns: campaigns,
                                updatedAt: new Date().toISOString()
                            } 
                        }
                    });

                    console.log('✅ Array de campanhas do usuário atualizado via MCP');
                    return true;
                }
            } catch (mcpError) {
                console.error('❌ Erro ao atualizar via MCP:', mcpError);
            }
        }

        // Fallback para MongoDB direto
        if (usersCollection) {
            console.log('🔄 Usando fallback MongoDB direto...');
            
            // Buscar usuário atual
            const user = await usersCollection.findOne({ id: userId });
            
            if (user) {
                let campaigns = user.campaigns || [];
                
                // Verificar se a campanha já existe no array
                const existingIndex = campaigns.findIndex(c => c.id === campaignData.id);
                
                if (existingIndex >= 0) {
                    // Atualizar campanha existente
                    campaigns[existingIndex] = campaignSummary;
                    console.log('📝 Campanha existente atualizada no array');
                } else {
                    // Adicionar nova campanha
                    campaigns.push(campaignSummary);
                    console.log('➕ Nova campanha adicionada ao array');
                }

                // Atualizar usuário
                await usersCollection.updateOne(
                    { id: userId },
                    { 
                        $set: { 
                            campaigns: campaigns,
                            updatedAt: new Date().toISOString()
                        } 
                    }
                );

                console.log('✅ Array de campanhas do usuário atualizado via MongoDB direto');
                return true;
            } else {
                console.log('⚠️ Usuário não encontrado:', userId);
                return false;
            }
        }

        console.log('❌ Nenhum método de atualização disponível');
        return false;

    } catch (error) {
        console.error('❌ Erro ao atualizar array de campanhas do usuário:', error);
        return false;
    }
}

// Função para sincronizar atualizações da collection campaigns com o array campaigns dos users
async function syncCampaignToUserArray(campaignId, updateData) {
    try {
        console.log(`🔄 [SYNC] Sincronizando campanha ${campaignId} com arrays de usuários...`);
        
        if (!campaignId) {
            console.log('⚠️ [SYNC] CampaignId não fornecido para sincronização');
            return false;
        }

        // Buscar a campanha atualizada na collection campaigns
        let campaign = null;
        
        // Tentar via MCP primeiro
        if (global.runMCP) {
            try {
                const mcpResult = await global.runMCP('mongodb', 'find', {
                    database: DB_NAME,
                    collection: COLLECTION_NAME,
                    query: { campaignId: campaignId }
                });
                
                if (mcpResult && mcpResult.length > 0) {
                    campaign = mcpResult[0];
                    console.log(`✅ [SYNC] Campanha encontrada via MCP: ${campaignId}`);
                }
            } catch (mcpError) {
                console.log('⚠️ [SYNC] Erro ao buscar via MCP:', mcpError.message);
            }
        }
        
        // Fallback para MongoDB direto
        if (!campaign && db && campaignsCollection) {
            try {
                campaign = await campaignsCollection.findOne({ campaignId: campaignId });
                if (campaign) {
                    console.log(`✅ [SYNC] Campanha encontrada via MongoDB direto: ${campaignId}`);
                }
            } catch (dbError) {
                console.log('⚠️ [SYNC] Erro ao buscar via MongoDB direto:', dbError.message);
            }
        }
        
        if (!campaign) {
            console.log(`❌ [SYNC] Campanha não encontrada: ${campaignId}`);
            return false;
        }

        // Verificar se a campanha tem userId
        if (!campaign.userId) {
            console.log(`⚠️ [SYNC] Campanha ${campaignId} não tem userId associado`);
            return false;
        }

        console.log(`🔍 [SYNC] Sincronizando campanha ${campaignId} para usuário ${campaign.userId}`);

        // Preparar dados atualizados da campanha para o array do usuário
        const campaignSummary = {
            id: campaign.id,
            campaignId: campaign.campaignId,
            name: campaign.name,
            status: campaign.status || 'active',
            createdAt: campaign.createdAt,
            updatedAt: campaign.updatedAt || new Date().toISOString(),
            completedAt: campaign.completedAt,
            currentStep: campaign.currentStep,
            completedSteps: campaign.completedSteps || [],
            campaignData: campaign.campaignData || {},
            objective: campaign.objective,
            direction: campaign.direction,
            creative: campaign.creative,
            profile: campaign.profile,
            profileData: campaign.profileData,
            location: campaign.location,
            gender: campaign.gender,
            age: campaign.age,
            duration: campaign.duration,
            index: campaign.index,
            siteUrl: campaign.siteUrl,
            // Garantir que audiência/mercados sejam preservados mesmo quando salvos em campaignData
            audience: campaign.audience || (campaign.campaignData && campaign.campaignData.audience) || (campaign.targetAudience && campaign.targetAudience.audience) || campaign.publico,
            markets: campaign.markets || (campaign.campaignData && campaign.campaignData.markets) || (campaign.targetAudience && campaign.targetAudience.markets) || campaign.selectedMarkets,
            utm_source: campaign.utm_source,
            utm_medium: campaign.utm_medium,
            utm_campaign: campaign.utm_campaign,
            utm_term: campaign.utm_term,
            utm_content: campaign.utm_content,
            utm: campaign.utm || {
                utm_source: campaign.utm_source,
                utm_medium: campaign.utm_medium,
                utm_campaign: campaign.utm_campaign,
                utm_term: campaign.utm_term,
                utm_content: campaign.utm_content
            },
            files: campaign.files || campaign.uploadedFiles || [],
            uploadedFiles: campaign.uploadedFiles || campaign.files || [],
            progressSteps: campaign.progressSteps || [],
            currentProgress: campaign.currentProgress || 0,
            progress: campaign.progress || campaign.currentProgress || 0,
            isAbandoned: campaign.isAbandoned || false,
            isCompleted: campaign.isCompleted || false,
            lastSaved: campaign.lastSaved || new Date().toISOString(),
            userId: campaign.userId,
            // Adicionar campos específicos de pagamento se existirem
            paymentConfirmedAt: campaign.paymentConfirmedAt,
            paymentCorrelationID: campaign.paymentCorrelationID
        };

        // Tentar atualizar via MCP primeiro
        if (global.runMCP) {
            try {
                console.log('🔄 [SYNC] Tentando sincronizar via MCP...');
                
                // Buscar usuário atual
                const getUserResult = await global.runMCP('mongodb', 'find', {
                    database: DB_NAME,
                    collection: USERS_COLLECTION_NAME,
                    query: { id: campaign.userId }
                });

                if (getUserResult && getUserResult.length > 0) {
                    const user = getUserResult[0];
                    let campaigns = user.campaigns || [];
                    
                    // Verificar se a campanha já existe no array
                    const existingIndex = campaigns.findIndex(c => 
                        c.id === campaign.id || c.campaignId === campaign.campaignId
                    );
                    
                    if (existingIndex >= 0) {
                        // Atualizar campanha existente
                        campaigns[existingIndex] = campaignSummary;
                        console.log(`✅ [SYNC] Campanha ${campaignId} atualizada no array do usuário ${campaign.userId}`);
                    } else {
                        // Adicionar nova campanha (caso não exista ainda)
                        campaigns.push(campaignSummary);
                        console.log(`➕ [SYNC] Campanha ${campaignId} adicionada ao array do usuário ${campaign.userId}`);
                    }

                    // Atualizar usuário via MCP
                    await global.runMCP('mongodb', 'updateOne', {
                        database: DB_NAME,
                        collection: USERS_COLLECTION_NAME,
                        filter: { id: campaign.userId },
                        update: { 
                            $set: { 
                                campaigns: campaigns,
                                updatedAt: new Date().toISOString()
                            } 
                        }
                    });

                    console.log(`✅ [SYNC] Array de campanhas sincronizado via MCP para usuário ${campaign.userId}`);
                    return true;
                }
            } catch (mcpError) {
                console.log('⚠️ [SYNC] Erro ao sincronizar via MCP:', mcpError.message);
            }
        }
        
        // Fallback para MongoDB direto
        if (db && usersCollection) {
            try {
                console.log('🔄 [SYNC] Tentando sincronizar via MongoDB direto...');
                
                // Buscar usuário
                const user = await usersCollection.findOne({ id: campaign.userId });
                
                if (user) {
                    let campaigns = user.campaigns || [];
                    
                    // Verificar se a campanha já existe no array
                    const existingIndex = campaigns.findIndex(c => 
                        c.id === campaign.id || c.campaignId === campaign.campaignId
                    );
                    
                    if (existingIndex >= 0) {
                        // Atualizar campanha existente
                        campaigns[existingIndex] = campaignSummary;
                        console.log(`✅ [SYNC] Campanha ${campaignId} atualizada no array do usuário ${campaign.userId}`);
                    } else {
                        // Adicionar nova campanha (caso não exista ainda)
                        campaigns.push(campaignSummary);
                        console.log(`➕ [SYNC] Campanha ${campaignId} adicionada ao array do usuário ${campaign.userId}`);
                    }

                    // Atualizar usuário
                    await usersCollection.updateOne(
                        { id: campaign.userId },
                        { 
                            $set: { 
                                campaigns: campaigns,
                                updatedAt: new Date().toISOString()
                            } 
                        }
                    );

                    console.log(`✅ [SYNC] Array de campanhas sincronizado via MongoDB direto para usuário ${campaign.userId}`);
                    return true;
                } else {
                    console.log(`⚠️ [SYNC] Usuário não encontrado: ${campaign.userId}`);
                    return false;
                }
            } catch (dbError) {
                console.log('⚠️ [SYNC] Erro ao sincronizar via MongoDB direto:', dbError.message);
            }
        }

        console.log('❌ [SYNC] Nenhum método de sincronização disponível');
        return false;

    } catch (error) {
        console.error(`❌ [SYNC] Erro ao sincronizar campanha ${campaignId}:`, error);
        return false;
    }
}

// ==================== CAMPAIGN API ROUTES ====================

// Get all campaigns
app.get('/api/campaigns', async (req, res) => {
    try {
        console.log('📊 Buscando campanhas...');
        
        // Use MCP directly via global runMCP
        try {
            console.log('🔧 Getting campaigns via MCP');
            const result = await global.runMCP('mcp.config.usrlocalmcp.MongoDB', 'query', {
                collection: 'campaigns',
                filter: {},
                limit: 1000,
                sort: { createdAt: -1 } // Ordenar por data de criação (mais recente primeiro)
            });
            console.log('✅ Resultado MCP:', result);
            
            // Extract campaigns from MCP result
            const campaigns = result?.data || [];
            console.log(`✅ Campanhas encontradas (MCP): ${campaigns.length}`);
            return res.json({ campaigns });
        } catch (mcpError) {
            console.log('⚠️ MCP failed:', mcpError.message);
            
            // Fallback to direct MongoDB
            if (db) {
                try {
                    const collection = db.collection('campaigns');
                    const campaigns = await collection.find({}).sort({ createdAt: -1 }).limit(1000).toArray();
                    console.log(`✅ Campanhas encontradas (MongoDB direto): ${campaigns.length}`);
                    return res.json({ campaigns });
                } catch (mongoError) {
                    console.error('❌ MongoDB direto falhou:', mongoError);
                }
            }
            
            return res.status(500).json({ error: 'Erro ao buscar campanhas', details: mcpError.message });
        }
    } catch (error) {
        console.error('Erro ao buscar campanhas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Create new campaign
app.post('/api/campaigns', async (req, res) => {
    try {
        console.log('📝 [DEBUG] POST /api/campaigns - Request body:', JSON.stringify(req.body, null, 2));
        
        // Extrair userId do token de autenticação se disponível
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId;
                console.log('✅ [CAMPAIGN] UserId extraído do token:', userId);
            } catch (tokenError) {
                console.log('⚠️ [CAMPAIGN] Token inválido ou expirado, tentando usar userId do body');
            }
        }
        
        // Se não conseguiu extrair do token, usar o userId do body se disponível
        if (!userId && req.body.userId) {
            userId = req.body.userId;
            console.log('✅ [CAMPAIGN] UserId extraído do body:', userId);
        }
        
        // Remover campos desnecessários do body incluindo _id (imutável no MongoDB)
        const { updatedAt, sessionId, _id, __v, ...cleanBody } = req.body;
        
        // Garantir que o campo 'id' personalizado seja gerado se não existir
        const campaignId = cleanBody.campaignId || cleanBody.id || `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const campaign = {
            ...cleanBody,
            id: campaignId,
            campaignId: campaignId,
            userId: userId, // Adicionar userId se disponível
            createdAt: new Date().toISOString()
        };
        
        console.log('📝 [DEBUG] Creating campaign after cleanup:', JSON.stringify(campaign, null, 2));
        
        // Use MCP directly via global runMCP
        if (typeof global.runMCP === 'function') {
            try {
                console.log('🔧 Creating campaign via MCP');
                const result = await global.runMCP('mcp.config.usrlocalmcp.MongoDB', 'insert', {
                    collection: 'campaigns',
                    documents: [campaign]
                });
                console.log('✅ Campaign created via MCP:', result);
                
                // Nota: Array de campanhas do usuário será atualizado apenas quando currentProgress = 3 (payment-generated)
                
                return res.json({ success: true, result, campaign, source: 'mongodb-mcp' });
            } catch (mcpError) {
                console.log('⚠️ MCP failed:', mcpError.message);
            }
        }
        
        // Fallback: use MongoDB directly when MCP not available
        console.log('⚠️ MCP not available, using MongoDB fallback');
        
        // Check if direct MongoDB connection is available
        if (!db) {
            console.log('❌ MongoDB direct connection not available - using mock response');
            // Return mock success response for development
            const mockResult = {
                acknowledged: true,
                insertedId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            console.log('✅ Campaign created via mock:', mockResult);
            return res.json({ success: true, result: mockResult, campaign, source: 'mock' });
        }
        
        try {
            const collection = db.collection('campaigns');
            
            // Verificar se a campanha já existe (apenas se o ID foi fornecido no body original)
            let existingCampaign = null;
            if (cleanBody.id || cleanBody.campaignId) {
                existingCampaign = await collection.findOne({ id: campaign.id });
            }
            
            if (existingCampaign) {
                // Atualizar campanha existente, preservando createdAt e removendo updatedAt/sessionId
                const updateData = {
                    ...campaign,
                    createdAt: existingCampaign.createdAt, // Preservar data de criação original
                };
                
                // Remover campos desnecessários
                delete updateData.updatedAt;
                delete updateData.sessionId;
                
                const result = await collection.replaceOne(
                    { id: campaign.id },
                    updateData
                );
                console.log('✅ Campaign updated via MongoDB direct:', result);
                
                // Atualizar array de campanhas do usuário automaticamente
                if (userId) {
                    await updateUserCampaignsArray(userId, updateData);
                }
                
                return res.json({ success: true, result, campaign: updateData, source: 'mongodb-direct-update' });
            } else {
                // Criar nova campanha (campos desnecessários já foram removidos)
                const result = await collection.insertOne(campaign);
                console.log('✅ Campaign created via MongoDB direct:', result);
                
                // Nota: Array de campanhas do usuário será atualizado apenas quando currentProgress = 3 (payment-generated)
                
                return res.json({ success: true, result, campaign, source: 'mongodb-direct-create' });
            }
        } catch (mongoError) {
            console.error('❌ MongoDB Fallback Error:', mongoError);
            
            // Se for erro de autenticação, usar mock response
            if (mongoError.code === 13 || mongoError.codeName === 'Unauthorized') {
                console.log('⚠️ MongoDB sem permissão - usando mock response');
                const mockResult = {
                    acknowledged: true,
                    insertedId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                console.log('✅ Campaign created via mock (auth fallback):', mockResult);
                return res.json({ success: true, result: mockResult, campaign, source: 'mock-auth-fallback' });
            }
            
            return res.status(500).json({ error: 'MongoDB operation failed', details: mongoError.message });
        }
    } catch (error) {
        console.error('❌ [DEBUG] Error in POST /api/campaigns:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            name: error.name,
            fullError: error
        });
        
        if (error.code === 11000) {
            // Duplicate key error
            res.status(409).json({ error: 'Campanha com este ID já existe' });
        } else {
            console.error('❌ [DEBUG] Sending 500 error response');
            res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
        }
    }
});

// Update campaign
app.put('/api/campaigns/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('🔄 [CAMPAIGN UPDATE] Recebendo atualização para ID:', id);
        console.log('🔄 [CAMPAIGN UPDATE] Dados recebidos:', JSON.stringify(req.body, null, 2));
        
        // Verificar se o ID parece ser um correlationID do PIX (contém "pix_")
        if (id.includes('pix_')) {
            console.warn('⚠️ [CAMPAIGN UPDATE] ATENÇÃO: ID parece ser correlationID do PIX, não campaignId!');
            console.warn('⚠️ [CAMPAIGN UPDATE] ID recebido:', id);
            return res.status(400).json({ 
                error: 'ID inválido: parece ser correlationID do PIX, não campaignId',
                receivedId: id,
                hint: 'Use o campaignId correto, não o correlationID do pagamento'
            });
        }
        
        // Desabilitar MCP temporariamente para evitar inconsistências
        // MCP está causando falhas e fallback inconsistente
        
        // Fallback to direct MongoDB
        if (!campaignsCollection) {
            console.error('❌ [CAMPAIGN UPDATE] MongoDB não disponível');
            return res.json({ error: 'MongoDB não disponível', fallback: true });
        }
        
        // Primeiro, verificar se a campanha existe
        const existingCampaign = await campaignsCollection.findOne({ id: id });
        if (!existingCampaign) {
            console.warn('⚠️ [CAMPAIGN UPDATE] Campanha não encontrada com ID:', id);
            
            // Tentar buscar por outros campos possíveis
            const alternativeSearch = await campaignsCollection.findOne({
                $or: [
                    { campaignId: id },
                    { _id: id }
                ]
            });
            
            if (alternativeSearch) {
                console.log('✅ [CAMPAIGN UPDATE] Campanha encontrada com busca alternativa:', alternativeSearch.id);
            } else {
                console.error('❌ [CAMPAIGN UPDATE] Campanha não encontrada em nenhuma busca');
                return res.status(404).json({ error: 'Campanha não encontrada', searchedId: id });
            }
        } else {
            console.log('✅ [CAMPAIGN UPDATE] Campanha encontrada:', existingCampaign.id);
        }
        
        // Buscar dados existentes para fazer merge correto
        const existingData = existingCampaign || await campaignsCollection.findOne({ id: id });
        
        console.log('🔍 [DEBUG] Dados existentes COMPLETOS:', JSON.stringify(existingData, null, 2));
        console.log('📥 [DEBUG] Dados recebidos na requisição:', JSON.stringify(req.body, null, 2));
        
        // PRESERVAR EXPLICITAMENTE os campos críticos
        const criticalFields = {
            objective: existingData?.campaignData?.objective,
            direction: existingData?.campaignData?.direction,
            creative: existingData?.campaignData?.creative,
            profile: existingData?.campaignData?.profile,
            ageGroup: existingData?.campaignData?.ageGroup,
            age: existingData?.campaignData?.age
        };
        
        console.log('🔒 [PRESERVE] Campos críticos preservados:', JSON.stringify(criticalFields, null, 2));
        
        // Construir dados de atualização preservando TUDO
        const updateData = {
            ...existingData,  // Começar com TODOS os dados existentes
            ...req.body,      // Aplicar apenas as mudanças necessárias
            updatedAt: new Date().toISOString(),
            lastUpdateSource: 'api_put_fixed'
        };
        
        // Garantir que campaignData preserve os campos críticos
        if (updateData.campaignData) {
            updateData.campaignData = {
                ...existingData?.campaignData,  // Dados existentes primeiro
                ...criticalFields,              // Garantir preservação explícita
                ...req.body.campaignData        // Aplicar novos dados por último
            };
        }
        
        // Garantir que progressSteps seja merged corretamente
        if (updateData.progressSteps && existingData?.progressSteps) {
            updateData.progressSteps = {
                ...existingData.progressSteps,
                ...req.body.progressSteps
            };
        }
        
        // Remover _id para evitar conflitos no MongoDB
        delete updateData._id;
        
        console.log('💾 [FINAL] Dados finais para salvar:', JSON.stringify(updateData, null, 2));
        console.log('✅ [VERIFY] Objective final:', updateData.campaignData?.objective);
        console.log('✅ [VERIFY] Direction final:', updateData.campaignData?.direction);
        console.log('✅ [VERIFY] Creative final:', updateData.campaignData?.creative);
        console.log('✅ [VERIFY] Profile final:', updateData.campaignData?.profile);
        
        const result = await campaignsCollection.replaceOne(
            { id: id },
            updateData
        );
        
        console.log('✅ [CAMPAIGN UPDATE] Resultado da atualização:', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            campaignId: id
        });
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }
        
        // Atualizar array de campanhas do usuário após modificação
        if (updateData.userId && result.modifiedCount > 0) {
            console.log('🔄 [USER CAMPAIGNS] Atualizando array de campanhas do usuário:', updateData.userId);
            try {
                await updateUserCampaignsArray(updateData.userId, updateData);
                console.log('✅ [USER CAMPAIGNS] Array de campanhas atualizado com sucesso');
            } catch (updateError) {
                console.error('❌ [USER CAMPAIGNS] Erro ao atualizar array de campanhas:', updateError);
                // Não falhar a requisição por causa disso, apenas logar o erro
            }
        }
        
        // Sincronizar automaticamente com o array campaigns do usuário usando a nova função
        if (result.modifiedCount > 0) {
            try {
                console.log(`🔄 [SYNC] Iniciando sincronização automática para campanha: ${id}`);
                await syncCampaignToUserArray(id);
                console.log(`✅ [SYNC] Sincronização automática concluída para campanha: ${id}`);
            } catch (syncError) {
                console.error(`❌ [SYNC] Erro na sincronização automática para campanha ${id}:`, syncError);
            }
        }
        
        res.json({ success: true, modified: result.modifiedCount, campaignId: id });
    } catch (error) {
        console.error('❌ [CAMPAIGN UPDATE] Erro ao atualizar campanha:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Sync specific campaign between collections
app.post('/api/campaigns/:id/sync', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 [MANUAL SYNC] Iniciando sincronização manual para campanha: ${id}`);
        
        // Executar sincronização
        const syncResult = await syncCampaignToUserArray(id);
        
        if (syncResult) {
            console.log(`✅ [MANUAL SYNC] Sincronização manual concluída para campanha: ${id}`);
            res.json({ 
                success: true, 
                message: `Campanha ${id} sincronizada com sucesso`,
                campaignId: id 
            });
        } else {
            console.log(`❌ [MANUAL SYNC] Falha na sincronização manual para campanha: ${id}`);
            res.status(500).json({ 
                error: 'Falha na sincronização',
                campaignId: id 
            });
        }
    } catch (error) {
        console.error(`❌ [MANUAL SYNC] Erro na sincronização manual para campanha ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message 
        });
    }
});

// Sync all campaigns between collections
app.post('/api/campaigns/sync-all', async (req, res) => {
    try {
        console.log('🔄 [SYNC ALL] Iniciando sincronização de todas as campanhas...');
        
        let campaigns = [];
        
        // Buscar todas as campanhas
        if (global.runMCP) {
            try {
                const mcpResult = await global.runMCP('mongodb', 'find', {
                    database: DB_NAME,
                    collection: COLLECTION_NAME,
                    query: {}
                });
                campaigns = mcpResult || [];
            } catch (mcpError) {
                console.log('⚠️ [SYNC ALL] Erro ao buscar via MCP:', mcpError.message);
            }
        }
        
        if (campaigns.length === 0 && campaignsCollection) {
            campaigns = await campaignsCollection.find({}).toArray();
        }
        
        if (campaigns.length === 0) {
            return res.json({ 
                success: true, 
                message: 'Nenhuma campanha encontrada para sincronizar',
                synced: 0,
                failed: 0 
            });
        }
        
        let syncedCount = 0;
        let failedCount = 0;
        
        // Sincronizar cada campanha
        for (const campaign of campaigns) {
            try {
                const syncResult = await syncCampaignToUserArray(campaign.campaignId || campaign.id);
                if (syncResult) {
                    syncedCount++;
                } else {
                    failedCount++;
                }
            } catch (error) {
                console.error(`❌ [SYNC ALL] Erro ao sincronizar campanha ${campaign.campaignId || campaign.id}:`, error);
                failedCount++;
            }
        }
        
        console.log(`✅ [SYNC ALL] Sincronização concluída: ${syncedCount} sucesso, ${failedCount} falhas`);
        
        res.json({ 
            success: true, 
            message: `Sincronização concluída: ${syncedCount} campanhas sincronizadas, ${failedCount} falhas`,
            total: campaigns.length,
            synced: syncedCount,
            failed: failedCount 
        });
        
    } catch (error) {
        console.error('❌ [SYNC ALL] Erro na sincronização geral:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message 
        });
    }
});

// Delete campaign
app.delete('/api/campaigns/:id', async (req, res) => {
    try {
        if (!campaignsCollection) {
            return res.json({ error: 'MongoDB não disponível', fallback: true });
        }
        
        const { id } = req.params;
        const result = await campaignsCollection.deleteOne({ id: id });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }
        
        res.json({ success: true, deleted: result.deletedCount });
    } catch (error) {
        console.error('Erro ao deletar campanha:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Sync localStorage data to MongoDB
app.post('/api/sync', async (req, res) => {
    try {
        const { campaigns } = req.body;
        
        if (!Array.isArray(campaigns)) {
            return res.status(400).json({ error: 'Dados inválidos' });
        }
        
        let syncedCount = 0;
        let errorCount = 0;
        
        // Try direct MongoDB connection first
        if (campaignsCollection) {
            for (const campaign of campaigns) {
                try {
                    await campaignsCollection.updateOne(
                        { id: campaign.id },
                        { 
                            $set: {
                                ...campaign,
                                syncedAt: new Date(),
                                updatedAt: new Date()
                            }
                        },
                        { upsert: true }
                    );
                    syncedCount++;
                    
                    // Sincronizar automaticamente com o array campaigns do usuário se a campanha tem campaignId
                    if (campaign.campaignId) {
                        try {
                            console.log(`🔄 [SYNC] Iniciando sincronização automática para campanha: ${campaign.campaignId}`);
                            await syncCampaignToUserArray(campaign.campaignId);
                            console.log(`✅ [SYNC] Sincronização automática concluída para campanha: ${campaign.campaignId}`);
                        } catch (syncError) {
                            console.error(`❌ [SYNC] Erro na sincronização automática para campanha ${campaign.campaignId}:`, syncError);
                        }
                    }
                } catch (error) {
                    console.error(`Erro ao sincronizar campanha ${campaign.id}:`, error);
                    errorCount++;
                }
            }
        }
        // Fallback to MCP MongoDB
        // else if (mcpMongoDB) {
        //     for (const campaign of campaigns) {
        //         try {
        //             await mcpMongoDB.upsertCampaign({
        //                 ...campaign,
        //                 syncedAt: new Date().toISOString()
        //             });
        //             syncedCount++;
        //         } catch (error) {
        //             console.error(`Erro ao sincronizar campanha via MCP ${campaign.id}:`, error);
        //             errorCount++;
        //         }
        //     }
        // }
        else {
            return res.json({ error: 'MongoDB não disponível', fallback: true });
        }
        
        res.json({ 
            success: true, 
            synced: syncedCount, 
            errors: errorCount,
            total: campaigns.length
        });
    } catch (error) {
        console.error('Erro na sincronização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    // Considerar MongoDB disponível se temos conexão direta OU MCP
    const mongoAvailable = !!campaignsCollection; // || (mcpMongoDB && mcpMongoDB.isConnected);
    res.json({ 
        status: 'ok', 
        mongodb: mongoAvailable,
        connectionType: campaignsCollection ? 'direct' : 'none', // (mcpMongoDB ? 'mcp' : 'none'),
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint temporário para verificar configurações OAuth
app.get('/api/debug-oauth', (req, res) => {
    try {
        const debugInfo = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            oauth_config: {
                meta_app_id: process.env.META_APP_ID || 'NOT_SET',
                meta_app_secret_exists: !!process.env.META_APP_SECRET,
                meta_app_secret_length: process.env.META_APP_SECRET ? process.env.META_APP_SECRET.length : 0,
                meta_app_secret_first_chars: process.env.META_APP_SECRET ? process.env.META_APP_SECRET.substring(0, 4) + '...' : 'NOT_SET',
                oauth_redirect_uri: process.env.OAUTH_REDIRECT_URI || 'NOT_SET',
                oauth_success_redirect: process.env.OAUTH_SUCCESS_REDIRECT || 'NOT_SET'
            },
            server_info: {
                port: process.env.PORT || 'NOT_SET',
                node_version: process.version,
                platform: process.platform
            }
        };
        
        res.json(debugInfo);
    } catch (error) {
        res.status(500).json({ 
            error: 'Erro ao obter informações de debug',
            message: error.message 
        });
    }
});

// MCP endpoint for frontend calls
app.post('/api/mcp', async (req, res) => {
    try {
        const { server_name, tool_name, args } = req.body;
        
        if (!server_name || !tool_name) {
            return res.status(400).json({ error: 'server_name and tool_name are required' });
        }
        
        console.log(`🔧 MCP API Call: ${server_name}.${tool_name}`, args);
        
        // For MongoDB MCP calls, use the MCP directly
        if (server_name === 'mcp.config.usrlocalmcp.MongoDB') {
            // Use the global MCP function available in Trae AI environment
            if (typeof global.runMCP === 'function') {
                const result = await global.runMCP(server_name, tool_name, args || {});
                return res.json(result);
            } else {
                // Fallback: use MongoDB directly when MCP not available
                console.log('⚠️ MCP not available, using MongoDB fallback');
                
                // Check if direct MongoDB connection is available
    if (!db) {
        console.log('❌ MongoDB direct connection not available - using mock response');
        // Return mock success response for development
        const mockResult = {
            success: true,
            result: { acknowledged: true, insertedId: `mock_${Date.now()}` },
            source: 'mock'
        };
        return res.json(mockResult);
    }
                
                try {
                    if (tool_name === 'insert') {
                        const collection = db.collection(args.collection || 'campaigns');
                        const result = await collection.insertMany(args.documents || []);
                        return res.json({
                            acknowledged: result.acknowledged,
                            insertedCount: result.insertedCount,
                            insertedIds: result.insertedIds
                        });
                    } else if (tool_name === 'query') {
                        const collection = db.collection(args.collection || 'campaigns');
                        const result = await collection.find(args.filter || {}).limit(args.limit || 100).toArray();
                        return res.json(result);
                    } else if (tool_name === 'update') {
                        const collection = db.collection(args.collection || 'campaigns');
                        const result = await collection.updateMany(args.filter || {}, args.update || {}, { upsert: args.upsert || false });
                        return res.json({
                            acknowledged: result.acknowledged,
                            matchedCount: result.matchedCount,
                            modifiedCount: result.modifiedCount,
                            upsertedCount: result.upsertedCount
                        });
                    } else {
                        return res.status(501).json({ error: `MongoDB operation ${tool_name} not implemented` });
                    }
                } catch (mongoError) {
                    console.error('❌ MongoDB Fallback Error:', mongoError);
                    return res.status(500).json({ error: 'MongoDB operation failed', details: mongoError.message });
                }
            }
        }
        
        // For other MCP servers, return error for now
        return res.status(501).json({ error: `MCP server ${server_name} not implemented` });
        
    } catch (error) {
        console.error('❌ MCP API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== END CAMPAIGN API ROUTES ====================

// ==================== USER API ROUTES ====================

// Rota para cadastro de usuários
app.post('/api/users', async (req, res) => {
    try {
        const { name, email, whatsapp, password } = req.body;
        
        // Validação básica dos campos obrigatórios
        if (!name || !email || !whatsapp || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Todos os campos são obrigatórios: name, email, whatsapp, password' 
            });
        }
        
        // Validação do email (sem revelar detalhes específicos)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(401).json({ 
                success: false, 
                error: 'Email ou senha incorretos' 
            });
        }
        
        // Validação do WhatsApp (deve conter +55 e ter pelo menos 13 dígitos)
        const cleanWhatsapp = whatsapp.replace(/\D/g, '');
        if (!whatsapp.includes('+55') || cleanWhatsapp.length < 13) {
            return res.status(400).json({ 
                success: false, 
                error: 'Numero invalido' 
            });
        }
        
        // Hash da senha antes de salvar
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Criar objeto do usuário
        const user = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            whatsapp: whatsapp.trim(),
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active'
        };
        
        console.log('📝 Tentando criar usuário:', { id: user.id, email: user.email, whatsapp: user.whatsapp });
        
        // Verificar se MongoDB está disponível
        if (!db || !usersCollection) {
            console.log('❌ MongoDB não disponível - usando resposta mock');
            return res.json({ 
                success: true, 
                result: { acknowledged: true, insertedId: user.id },
                user: { ...user, password: undefined }, // Não retornar senha
                source: 'mock' 
            });
        }
        
        try {
            // Verificar se email já existe
            const existingUser = await usersCollection.findOne({ email: user.email });
            if (existingUser) {
                return res.status(409).json({ 
                    success: false, 
                    error: 'Email já cadastrado' 
                });
            }
            
            // Inserir usuário no MongoDB
            const result = await usersCollection.insertOne(user);
            
            console.log('✅ Usuário criado com sucesso:', result.insertedId);
            
            // Retornar sucesso sem a senha
            res.json({ 
                success: true, 
                result: { acknowledged: result.acknowledged, insertedId: result.insertedId },
                user: { ...user, password: undefined },
                source: 'mongodb' 
            });
            
        } catch (mongoError) {
            console.error('❌ Erro ao salvar usuário no MongoDB:', mongoError);
            
            // Se for erro de duplicação de email
            if (mongoError.code === 11000) {
                return res.status(409).json({ 
                    success: false, 
                    error: 'Email já cadastrado' 
                });
            }
            
            return res.status(500).json({ 
                success: false, 
                error: 'Erro interno do servidor' 
            });
        }
        
    } catch (error) {
        console.error('❌ Erro na rota de cadastro de usuários:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// Rota para listar usuários (opcional - para testes)
app.get('/api/users', async (req, res) => {
    try {
        if (!db || !usersCollection) {
            return res.json({ 
                success: true, 
                users: [], 
                source: 'mock' 
            });
        }
        
        const users = await usersCollection.find({}, { 
            projection: { password: 0 } // Não retornar senhas
        }).sort({ createdAt: -1 }).limit(50).toArray();
        
        res.json({ 
            success: true, 
            users: users,
            count: users.length,
            source: 'mongodb' 
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// Rota para buscar campanhas de um usuário específico
app.get('/api/users/:userId/campaigns', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🔍 [API] Buscando campanhas do array do usuário: ${userId}`);

        if (!db || !usersCollection) {
            console.log('⚠️ [API] Banco de dados não conectado, retornando array vazio');
            return res.json([]); // Retorna array vazio diretamente
        }

        console.log('✅ [API] Conexão com banco disponível, buscando usuário...');

        // Buscar o usuário na collection users
        const user = await usersCollection.findOne({
            $or: [
                { id: userId },
                { _id: userId },
                { userId: userId },
                { user_id: userId }
            ]
        });

        if (!user) {
            console.log(`❌ [API] Usuário ${userId} não encontrado`);
            return res.json([]);
        }

        // Retornar campanhas do array campaigns do usuário
        let campaigns = user.campaigns || [];
        console.log(`📊 [API] Campanhas no array do usuário ${userId}:`, campaigns.length);

        if (campaigns.length > 0) {
            console.log('📋 [API] Primeiras campanhas do array:', campaigns.slice(0, 2).map(c => ({
                id: c.id || c._id,
                name: c.name,
                status: c.status,
                currentProgress: c.currentProgress
            })));
        } else {
            // Fallback: buscar diretamente na collection 'campaigns' quando array do usuário está vazio
            console.log('⚠️ [API] Array de campanhas do usuário vazio. Buscando na collection campaigns por userId...');
            try {
                const campaignsCollection = db.collection('campaigns');
                const found = await campaignsCollection.find({
                    $or: [
                        { userId: userId },
                        { user_id: userId },
                        { ownerId: userId }
                    ]
                }).sort({ createdAt: -1 }).limit(100).toArray();

                console.log(`✅ [API] Campanhas encontradas diretamente na collection: ${found.length}`);

                // Mapear para um resumo compatível com o array do usuário
                campaigns = found.map(campaign => ({
                    id: campaign.id || campaign._id,
                    campaignId: campaign.campaignId || campaign.id || campaign._id,
                    name: campaign.name,
                    status: campaign.status || 'active',
                    createdAt: campaign.createdAt,
                    updatedAt: campaign.updatedAt || new Date().toISOString(),
                    completedAt: campaign.completedAt,
                    currentStep: campaign.currentStep,
                    completedSteps: campaign.completedSteps || [],
                    campaignData: campaign.campaignData || {},
                    objective: campaign.objective || (campaign.campaignData && campaign.campaignData.objective),
                    direction: campaign.direction || (campaign.campaignData && campaign.campaignData.direction),
                    creative: campaign.creative,
                    profile: campaign.profile,
                    profileData: campaign.profileData,
                    location: campaign.location || (campaign.campaignData && campaign.campaignData.location),
                    gender: campaign.gender || (campaign.campaignData && campaign.campaignData.gender),
                    age: campaign.age || (campaign.campaignData && (campaign.campaignData.age || campaign.campaignData.ageRange)),
                    duration: campaign.duration || (campaign.campaignData && campaign.campaignData.duration),
                    index: campaign.index,
                    siteUrl: campaign.siteUrl || (campaign.campaignData && (campaign.campaignData.siteUrl || campaign.campaignData.url || campaign.campaignData.websiteUrl)),
                    audience: campaign.audience || (campaign.campaignData && campaign.campaignData.audience) || (campaign.targetAudience && campaign.targetAudience.audience) || campaign.publico,
                    markets: campaign.markets || (campaign.campaignData && campaign.campaignData.markets) || (campaign.targetAudience && campaign.targetAudience.markets) || campaign.selectedMarkets,
                    utm: campaign.utm || {
                        utm_source: campaign.utm_source,
                        utm_medium: campaign.utm_medium,
                        utm_campaign: campaign.utm_campaign,
                        utm_term: campaign.utm_term,
                        utm_content: campaign.utm_content
                    },
                    files: campaign.files || campaign.uploadedFiles || [],
                    uploadedFiles: campaign.uploadedFiles || campaign.files || [],
                    progressSteps: campaign.progressSteps || [],
                    currentProgress: campaign.currentProgress || 0,
                    progress: campaign.progress || campaign.currentProgress || 0,
                    isAbandoned: campaign.isAbandoned || false,
                    isCompleted: campaign.isCompleted || false,
                    lastSaved: campaign.lastSaved || new Date().toISOString(),
                    userId: campaign.userId,
                    paymentConfirmedAt: campaign.paymentConfirmedAt,
                    paymentCorrelationID: campaign.paymentCorrelationID
                }));
            } catch (fallbackErr) {
                console.log('❌ [API] Erro no fallback de campanhas por userId:', fallbackErr.message);
            }
        }

        // Sempre retorna array, mesmo se vazio
        res.json(campaigns);

    } catch (error) {
        console.error('❌ [API] Erro ao buscar campanhas do usuário:', error);
        // Em caso de erro, retorna array vazio em vez de erro 500
        res.json([]);
    }
});

// Rota para login de usuários
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, senha, rememberMe = false } = req.body;
        const userPassword = password || senha;
        
        // Validação básica dos campos obrigatórios
        if (!email || !userPassword) {
            return res.status(401).json({ 
                success: false, 
                error: 'Email ou senha incorretos' 
            });
        }
        
        // Função para normalizar telefone (remove tudo exceto números)
        function normalizePhone(phone) {
            const cleaned = phone.replace(/\D/g, '');
            // Se começar com 55, remove o código do país
            if (cleaned.startsWith('55') && cleaned.length >= 12) {
                return cleaned.substring(2);
            }
            return cleaned;
        }
        
        // Função para verificar se é um telefone válido (DDD + 8 ou 9 dígitos)
        function isValidPhone(phone) {
            const normalized = normalizePhone(phone);
            return /^\d{10,11}$/.test(normalized);
        }
        
        const loginField = email.toLowerCase().trim();
        console.log('🔐 Tentativa de login:', { loginField, rememberMe });
        
        // Verificar se MongoDB está disponível
        if (!db || !usersCollection) {
            console.log('❌ MongoDB não disponível - login negado');
            return res.status(503).json({ 
                success: false, 
                error: 'Serviço temporariamente indisponível' 
            });
        }
        
        try {
            let user = null;
            
            // Verificar se é email ou telefone
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (emailRegex.test(loginField)) {
                // Buscar por email
                user = await usersCollection.findOne({ 
                    email: loginField 
                });
            } else if (isValidPhone(loginField)) {
                // Buscar por telefone normalizado
                const normalizedInput = normalizePhone(loginField);
                
                // Buscar usuários e comparar telefones normalizados
                const allUsers = await usersCollection.find({}).toArray();
                user = allUsers.find(u => {
                    if (u.whatsapp) {
                        const normalizedUserPhone = normalizePhone(u.whatsapp);
                        return normalizedUserPhone === normalizedInput;
                    }
                    return false;
                });
            }
            
            if (!user) {
                console.log('❌ Usuário não encontrado:', loginField);
                return res.status(401).json({ 
                    success: false, 
                    error: 'Email ou senha incorretos' 
                });
            }
            
            // Verificar senha usando bcrypt
            const isPasswordValid = await bcrypt.compare(userPassword, user.password);
            if (!isPasswordValid) {
                console.log('❌ Senha incorreta para:', loginField);
                return res.status(401).json({ 
                    success: false, 
                    error: 'Email ou senha incorretos' 
                });
            }
            
            console.log('✅ Login bem-sucedido:', user.email || user.whatsapp);
            
            // Generate device fingerprint and tokens
            const deviceFingerprint = generateDeviceFingerprint(req);
            const { accessToken, refreshToken } = generateTokens(user.id, deviceFingerprint, rememberMe);
            
            // Store session in database
            await storeSession(user.id, deviceFingerprint, refreshToken, rememberMe);
            
            // Retornar sucesso com tokens
            res.json({ 
                success: true, 
                message: 'Login realizado com sucesso',
                user: { 
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    whatsapp: user.whatsapp,
                    createdAt: user.createdAt
                },
                accessToken,
                refreshToken
            });
            
        } catch (mongoError) {
            console.error('❌ Erro ao buscar usuário no MongoDB:', mongoError);
            return res.status(500).json({ 
                success: false, 
                error: 'Erro interno do servidor' 
            });
        }
        
    } catch (error) {
        console.error('❌ Erro na rota de login:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// ==================== SESSION MANAGEMENT FUNCTIONS ====================

// Generate device fingerprint
function generateDeviceFingerprint(req) {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    
    const fingerprint = crypto.createHash('sha256')
        .update(userAgent + acceptLanguage + acceptEncoding + ip)
        .digest('hex');
    
    return fingerprint;
}

// Generate tokens
function generateTokens(userId, deviceFingerprint, rememberMe = false) {
    const payload = {
        userId,
        deviceFingerprint,
        type: 'access'
    };
    
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    
    const refreshPayload = {
        userId,
        deviceFingerprint,
        type: 'refresh'
    };
    
    const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, { 
        expiresIn: rememberMe ? REFRESH_TOKEN_EXPIRY : '1d' 
    });
    
    return { accessToken, refreshToken };
}

// Verify token middleware
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log('🔐 Verificando token:', { 
        hasAuthHeader: !!authHeader, 
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : null
    });
    
    if (!token) {
        console.log('❌ Token não fornecido');
        return res.status(401).json({ success: false, error: 'Token de acesso requerido' });
    }
    
    if (invalidatedTokens.has(token)) {
        return res.status(401).json({ success: false, error: 'Token inválido' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const deviceFingerprint = generateDeviceFingerprint(req);
        
        if (decoded.deviceFingerprint !== deviceFingerprint) {
            return res.status(401).json({ 
                success: false, 
                error: 'Dispositivo não reconhecido. Faça login novamente.' 
            });
        }
        
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, error: 'Token expirado' });
        }
        return res.status(401).json({ success: false, error: 'Token inválido' });
    }
}

// Store session in database
async function storeSession(userId, deviceFingerprint, refreshToken, rememberMe = false) {
    try {
        const sessionData = {
            userId,
            deviceFingerprint,
            refreshToken,
            rememberMe,
            createdAt: new Date(),
            lastActivity: new Date(),
            expiresAt: new Date(Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000))
        };
        
        await sessionsCollection.insertOne(sessionData);
        activeSessions.set(refreshToken, sessionData);
        
        return sessionData;
    } catch (error) {
        console.error('Erro ao armazenar sessão:', error);
        throw error;
    }
}

// Invalidate session
async function invalidateSession(refreshToken) {
    try {
        await sessionsCollection.deleteOne({ refreshToken });
        activeSessions.delete(refreshToken);
    } catch (error) {
        console.error('Erro ao invalidar sessão:', error);
    }
}

// Clean expired sessions
async function cleanExpiredSessions() {
    try {
        const now = new Date();
        await sessionsCollection.deleteMany({ expiresAt: { $lt: now } });
        
        // Clean memory cache
        for (const [token, session] of activeSessions.entries()) {
            if (session.expiresAt < now) {
                activeSessions.delete(token);
            }
        }
    } catch (error) {
        console.error('Erro ao limpar sessões expiradas:', error);
    }
}

// Run cleanup every hour
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

// ==================== AUTH API ROUTES ====================

// Refresh token endpoint
app.post('/api/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(401).json({ success: false, error: 'Refresh token requerido' });
        }
        
        // Check if session exists
        const session = await sessionsCollection.findOne({ refreshToken });
        if (!session) {
            return res.status(401).json({ success: false, error: 'Sessão inválida' });
        }
        
        // Check if session expired
        if (session.expiresAt < new Date()) {
            await invalidateSession(refreshToken);
            return res.status(401).json({ success: false, error: 'Sessão expirada' });
        }
        
        try {
            const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
            const deviceFingerprint = generateDeviceFingerprint(req);
            
            if (decoded.deviceFingerprint !== deviceFingerprint) {
                await invalidateSession(refreshToken);
                return res.status(401).json({ 
                    success: false, 
                    error: 'Dispositivo não reconhecido. Faça login novamente.' 
                });
            }
            
            // Generate new tokens
            const { accessToken, refreshToken: newRefreshToken } = generateTokens(
                decoded.userId, 
                deviceFingerprint, 
                session.rememberMe
            );
            
            // Update session with new refresh token
            await sessionsCollection.updateOne(
                { refreshToken },
                { 
                    $set: { 
                        refreshToken: newRefreshToken,
                        lastActivity: new Date()
                    }
                }
            );
            
            // Update memory cache
            if (activeSessions.has(refreshToken)) {
                const sessionData = activeSessions.get(refreshToken);
                sessionData.refreshToken = newRefreshToken;
                sessionData.lastActivity = new Date();
                activeSessions.delete(refreshToken);
                activeSessions.set(newRefreshToken, sessionData);
            }
            
            res.json({
                success: true,
                accessToken,
                refreshToken: newRefreshToken
            });
            
        } catch (error) {
            await invalidateSession(refreshToken);
            return res.status(401).json({ success: false, error: 'Refresh token inválido' });
        }
        
    } catch (error) {
        console.error('Erro ao renovar token:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Logout endpoint
app.post('/api/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const authHeader = req.headers.authorization;
        const accessToken = authHeader && authHeader.split(' ')[1];
        
        // Invalidate access token
        if (accessToken) {
            invalidatedTokens.add(accessToken);
        }
        
        // Invalidate refresh token and session
        if (refreshToken) {
            await invalidateSession(refreshToken);
        }
        
        res.json({ success: true, message: 'Logout realizado com sucesso' });
        
    } catch (error) {
        console.error('Erro no logout:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Check if user has used service (has campaigns)
app.get('/api/user/has-used-service', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Verificar se o usuário tem campanhas
        const userCampaigns = await campaignsCollection.countDocuments({ 
            userAgent: { $regex: userId, $options: 'i' } 
        });
        
        res.json({ 
            success: true, 
            hasUsedService: userCampaigns > 0,
            campaignCount: userCampaigns
        });
        
    } catch (error) {
        console.error('Erro ao verificar uso do serviço:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Get user integrations
app.get('/api/user/integrations', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('🔍 DEBUG - Buscando integrações para usuário:', userId);
        
        // Buscar dados de integração do usuário
        const user = await usersCollection.findOne(
            { id: userId },
            { projection: { integrations: 1 } }
        );
        
        console.log('🔍 DEBUG - Usuário encontrado:', {
            found: !!user,
            hasIntegrations: !!(user?.integrations),
            hasFacebook: !!(user?.integrations?.facebook),
            facebookData: user?.integrations?.facebook ? {
                hasUser: !!(user.integrations.facebook.user),
                userName: user.integrations.facebook.user?.name,
                hasAccessToken: !!(user.integrations.facebook.accessToken),
                connectedAt: user.integrations.facebook.connectedAt
            } : null
        });
        
        if (!user || !user.integrations) {
            console.log('🔍 DEBUG - Nenhuma integração encontrada para o usuário');
            return res.json({
                success: true,
                facebook: null,
                instagram: null
            });
        }
        
        // Retornar dados de integração (sem o access token por segurança)
        const integrations = {
            success: true
        };
        
        if (user.integrations.facebook) {
            integrations.facebook = {
                connected: true,
                user: {
                    id: user.integrations.facebook.user?.id,
                    name: user.integrations.facebook.user?.name,
                    email: user.integrations.facebook.user?.email
                },
                adAccounts: user.integrations.facebook.adAccounts || [],
                pages: user.integrations.facebook.pages || [],
                connectedAt: user.integrations.facebook.connectedAt
            };
        } else {
            integrations.facebook = null;
        }
        
        // Instagram pode ser adicionado futuramente
        integrations.instagram = null;
        
        res.json(integrations);
        
    } catch (error) {
        console.error('Erro ao buscar integrações do usuário:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Validate session endpoint
app.get('/api/validate-session', verifyToken, async (req, res) => {
    try {
        const user = await usersCollection.findOne(
            { id: req.user.userId },
            { projection: { password: 0 } }
        );
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'Usuário não encontrado' });
        }
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                whatsapp: user.whatsapp,
                createdAt: user.createdAt
            }
        });
        
    } catch (error) {
        console.error('Erro ao validar sessão:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Update user profile (name and password)
app.put('/api/user/update', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, password } = req.body;
        
        console.log('🔄 Atualizando usuário:', { userId, name, hasPassword: !!password });
        
        // Validações
        if (!name || name.trim().length < 2) {
            console.log('❌ Validação falhou: nome inválido');
            return res.status(400).json({ 
                success: false, 
                error: 'Nome deve ter pelo menos 2 caracteres' 
            });
        }
        
        if (password && password.length < 6) {
            console.log('❌ Validação falhou: senha muito curta');
            return res.status(400).json({ 
                success: false, 
                error: 'Senha deve ter pelo menos 6 caracteres' 
            });
        }
        
        // Preparar dados para atualização
        const updateData = {
            name: name.trim(),
            updatedAt: new Date()
        };
        
        // Se uma nova senha foi fornecida, criptografá-la
        if (password) {
            const saltRounds = 10;
            updateData.password = await bcrypt.hash(password, saltRounds);
            console.log('🔐 Senha criptografada e adicionada aos dados de atualização');
        }
        
        console.log('📝 Dados para atualização:', { ...updateData, password: updateData.password ? '[HASH]' : undefined });
        
        // Atualizar usuário no banco
        const result = await usersCollection.updateOne(
            { id: userId },
            { $set: updateData }
        );
        
        console.log('📊 Resultado da atualização:', { 
            matchedCount: result.matchedCount, 
            modifiedCount: result.modifiedCount,
            acknowledged: result.acknowledged 
        });
        
        if (result.matchedCount === 0) {
            console.log('❌ Usuário não encontrado no banco');
            return res.status(404).json({ 
                success: false, 
                error: 'Usuário não encontrado' 
            });
        }
        
        // Buscar dados atualizados do usuário (sem a senha)
        const updatedUser = await usersCollection.findOne(
            { id: userId },
            { projection: { password: 0 } }
        );
        
        res.json({ 
            success: true, 
            message: 'Perfil atualizado com sucesso',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                whatsapp: updatedUser.whatsapp,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt
            }
        });
        
    } catch (error) {
        console.error('Erro ao atualizar perfil do usuário:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// ==================== END AUTH API ROUTES ====================

// ==================== END USER API ROUTES ====================

// ==================== TESTIMONIALS API ROUTES ====================

// Get all testimonials with pagination
app.get('/api/testimonials', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Verificar se o usuário está autenticado
        let currentUserId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                currentUserId = decoded.userId;
            } catch (error) {
                // Token inválido, continuar como usuário não autenticado
                currentUserId = null;
            }
        }
        
        // Buscar todos os testimonials primeiro
        const allTestimonials = await testimonialsCollection
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        
        // Normalizar o campo isPublic garantindo a regra: público somente com 4+ estrelas
        for (const testimonial of allTestimonials) {
            const starsNum = Number(testimonial.stars) || 0;
            const shouldBePublic = starsNum >= 4;

            // Atualizar quando o campo não existe, está com tipo incorreto ou diverge da regra
            if (!testimonial.hasOwnProperty('isPublic') || typeof testimonial.isPublic !== 'boolean' || testimonial.isPublic !== shouldBePublic) {
                await testimonialsCollection.updateOne(
                    { _id: testimonial._id },
                    { $set: { isPublic: shouldBePublic } }
                );
                testimonial.isPublic = shouldBePublic; // manter objeto em memória consistente
            }
        }
        
        // Filtrar testimonials baseado na regra de visibilidade
        const filteredTestimonials = allTestimonials.filter(testimonial => {
            const isPublic = testimonial.isPublic === true; // garantir booleano estrito
            // Se é público, sempre mostrar
            if (isPublic) {
                return true;
            }

            // Se é privado (menos de 4 estrelas), só mostrar se for do próprio usuário
            return currentUserId && testimonial.userId === currentUserId;
        });
        
        // Aplicar paginação nos testimonials filtrados
        const paginatedTestimonials = filteredTestimonials.slice(skip, skip + limit);
        
        // Buscar informações dos usuários para cada depoimento
        const testimonialsWithUsers = await Promise.all(
            paginatedTestimonials.map(async (testimonial) => {
                const user = await usersCollection.findOne(
                    { id: testimonial.userId },
                    { projection: { name: 1, email: 1 } }
                );
                
                return {
                    ...testimonial,
                    userName: user ? user.name : 'Usuário Anônimo',
                    userEmail: user ? user.email : null,
                    isOwnReview: currentUserId === testimonial.userId
                };
            })
        );
        
        const totalFilteredTestimonials = filteredTestimonials.length;
        
        res.json({ 
            success: true, 
            testimonials: testimonialsWithUsers,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalFilteredTestimonials / limit),
                totalTestimonials: totalFilteredTestimonials,
                hasNextPage: page < Math.ceil(totalFilteredTestimonials / limit),
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Erro ao buscar depoimentos:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Check user testimonial eligibility
app.get('/api/testimonials/eligibility', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Buscar usuário na collection users
        const user = await usersCollection.findOne({ id: userId });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Usuário não encontrado' 
            });
        }
        
        // Contar campanhas com progresso 4 no array campaigns do usuário
        const campaigns = user.campaigns || [];
        const paidCampaigns = campaigns.filter(campaign => {
            return campaign.currentProgress === 4 || campaign.progress === 4;
        });
        
        // Contar quantos depoimentos o usuário já fez
        const existingTestimonials = await testimonialsCollection.countDocuments({ userId });
        
        // Calcular quantas avaliações ainda pode fazer
        const maxTestimonials = paidCampaigns.length;
        const remainingTestimonials = Math.max(0, maxTestimonials - existingTestimonials);
        
        console.log(`🔍 [TESTIMONIAL ELIGIBILITY] Usuário ${userId}:`);
        console.log(`- Campanhas com progresso 4: ${paidCampaigns.length}`);
        console.log(`- Depoimentos já feitos: ${existingTestimonials}`);
        console.log(`- Depoimentos restantes: ${remainingTestimonials}`);
        
        res.json({
            success: true,
            eligibility: {
                canSubmit: remainingTestimonials > 0,
                paidCampaigns: paidCampaigns.length,
                existingTestimonials: existingTestimonials,
                remainingTestimonials: remainingTestimonials,
                maxTestimonials: maxTestimonials,
                message: remainingTestimonials > 0 
                    ? `Você pode fazer ${remainingTestimonials} avaliação${remainingTestimonials > 1 ? 'ões' : ''}.`
                    : paidCampaigns.length === 0 
                        ? 'Você não pode avaliar pois não tem pedido pago.'
                        : 'Você já utilizou todas as suas avaliações disponíveis.'
            }
        });
        
    } catch (error) {
        console.error('Erro ao verificar elegibilidade para depoimentos:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Add new testimonial (requires authentication)
app.post('/api/testimonials', verifyToken, async (req, res) => {
    try {
        const { stars, text } = req.body;
        const userId = req.user.userId;
        
        // Validações
        if (!stars || !text) {
            return res.status(400).json({ 
                success: false, 
                error: 'Estrelas e texto são obrigatórios' 
            });
        }
        
        if (stars < 1 || stars > 5) {
            return res.status(400).json({ 
                success: false, 
                error: 'Avaliação deve ser entre 1 e 5 estrelas' 
            });
        }
        
        if (text.length > 200) {
            return res.status(400).json({ 
                success: false, 
                error: 'Texto deve ter no máximo 200 caracteres' 
            });
        }
        
        // Buscar usuário na collection users
        const user = await usersCollection.findOne({ id: userId });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Usuário não encontrado' 
            });
        }
        
        // Verificar campanhas com progresso 4 no array campaigns do usuário
        const campaigns = user.campaigns || [];
        const paidCampaigns = campaigns.filter(campaign => {
            return campaign.currentProgress === 4 || campaign.progress === 4;
        });
        
        if (paidCampaigns.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Você não pode avaliar pois não tem pedido pago' 
            });
        }
        
        // Verificar quantos depoimentos o usuário já fez
        const existingTestimonials = await testimonialsCollection.countDocuments({ userId });
        
        if (existingTestimonials >= paidCampaigns.length) {
            return res.status(400).json({ 
                success: false, 
                error: 'Você já utilizou todas as suas avaliações disponíveis' 
            });
        }
        
        // Criar o depoimento
        const testimonial = {
            userId,
            stars: parseInt(stars),
            text: text.trim(),
            isPublic: parseInt(stars) >= 4, // Avaliações abaixo de 4 estrelas são privadas
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await testimonialsCollection.insertOne(testimonial);
        
        if (result.insertedId) {
            // Buscar informações do usuário para retornar
            const user = await usersCollection.findOne(
                { id: userId },
                { projection: { name: 1, email: 1 } }
            );
            
            const testimonialWithUser = {
                ...testimonial,
                _id: result.insertedId,
                userName: user ? user.name : 'Usuário Anônimo',
                userEmail: user ? user.email : null
            };
            
            res.json({ 
                success: true, 
                message: 'Depoimento adicionado com sucesso',
                testimonial: testimonialWithUser
            });
        } else {
            res.status(500).json({ success: false, error: 'Erro ao salvar depoimento' });
        }
        
    } catch (error) {
        console.error('Erro ao adicionar depoimento:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Update testimonial (requires authentication)
app.put('/api/testimonials', verifyToken, async (req, res) => {
    try {
        const { stars, text } = req.body;
        const userId = req.user.userId;
        
        // Validações
        if (!stars || !text) {
            return res.status(400).json({ 
                success: false, 
                error: 'Estrelas e texto são obrigatórios' 
            });
        }
        
        if (stars < 1 || stars > 5) {
            return res.status(400).json({ 
                success: false, 
                error: 'Avaliação deve ser entre 1 e 5 estrelas' 
            });
        }
        
        if (text.length > 200) {
            return res.status(400).json({ 
                success: false, 
                error: 'Texto deve ter no máximo 200 caracteres' 
            });
        }
        
        // Atualizar o depoimento
        const result = await testimonialsCollection.updateOne(
            { userId },
            { 
                $set: {
                    stars: parseInt(stars),
                    text: text.trim(),
                    isPublic: parseInt(stars) >= 4, // Atualizar visibilidade baseada nas estrelas
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Depoimento não encontrado' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Depoimento atualizado com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao atualizar depoimento:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Delete testimonial (requires authentication)
app.delete('/api/testimonials', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const result = await testimonialsCollection.deleteOne({ userId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Depoimento não encontrado' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Depoimento removido com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao remover depoimento:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// ==================== END TESTIMONIALS API ROUTES ====================

// ========================================
// ENDPOINTS OAUTH 2.0 OFICIAL META/FACEBOOK
// ========================================

// Endpoint de teste para verificar configurações do Facebook App
app.get('/test/facebook-config', async (req, res) => {
    try {
        // Testar se o App ID é válido
        const appResponse = await axios.get(`https://graph.facebook.com/v21.0/${process.env.META_APP_ID}?access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`);
        
        res.json({
            success: true,
            appId: process.env.META_APP_ID,
            appData: appResponse.data,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            message: 'Configurações do Facebook App estão corretas'
        });
    } catch (error) {
        res.json({
            success: false,
            appId: process.env.META_APP_ID,
            error: error.response?.data || error.message,
            message: 'Erro nas configurações do Facebook App'
        });
    }
});

// Endpoint para verificar status detalhado do Facebook App
app.get('/test/facebook-status', async (req, res) => {
    try {
        // Verificar informações básicas do app
        const appResponse = await axios.get(`https://graph.facebook.com/v21.0/${process.env.META_APP_ID}?fields=id,name,category,link,privacy_policy_url,terms_of_service_url&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`);
        
        res.json({
            success: true,
            appInfo: appResponse.data,
            recommendations: [
                "Verifique se o App está em modo Development no Facebook Developers Console",
                "Adicione usuários de teste se necessário",
                "Configure Privacy Policy URL se ainda não foi feito",
                "Verifique se as permissões solicitadas estão corretas"
            ],
            troubleshooting: {
                error_message: "Login do Facebook está indisponível",
                possible_causes: [
                    "App em modo Live sem aprovação das permissões",
                    "Usuário não é admin/developer/tester do app",
                    "App passando por revisão do Facebook",
                    "Configurações de domínio incorretas"
                ],
                solutions: [
                    "Colocar o App em modo Development",
                    "Adicionar usuário como tester do app",
                    "Aguardar conclusão da revisão",
                    "Verificar URLs de redirecionamento"
                ]
            }
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.response?.data || error.message,
            message: 'Erro ao verificar status do Facebook App'
        });
    }
});

// Endpoint para testar se dados do OAuth estão sendo salvos no MongoDB
app.get('/test/oauth-mongodb', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!usersCollection) {
            return res.json({
                success: false,
                error: 'MongoDB não disponível',
                message: 'Conexão com MongoDB não estabelecida'
            });
        }
        
        // Buscar dados do usuário no MongoDB
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        
        if (!user) {
            return res.json({
                success: false,
                error: 'Usuário não encontrado',
                message: 'Usuário não existe no MongoDB'
            });
        }
        
        // Verificar se há dados de integração do Facebook
        const facebookIntegration = user.integrations?.facebook;
        
        res.json({
            success: true,
            userId: userId,
            userEmail: user.email,
            hasIntegrations: !!user.integrations,
            hasFacebookIntegration: !!facebookIntegration,
            facebookData: facebookIntegration ? {
                connected: facebookIntegration.connected,
                userId: facebookIntegration.user?.id,
                userName: facebookIntegration.user?.name,
                hasAccessToken: !!facebookIntegration.accessToken,
                hasLongLivedToken: !!facebookIntegration.longLivedAccessToken,
                adAccountsCount: facebookIntegration.adAccounts?.length || 0,
                pagesCount: facebookIntegration.pages?.length || 0,
                connectedAt: facebookIntegration.connectedAt
            } : null,
            rawIntegrations: user.integrations,
            message: facebookIntegration ? 
                'Dados do OAuth Facebook encontrados no MongoDB' : 
                'Nenhum dado do OAuth Facebook encontrado no MongoDB'
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar dados do OAuth no MongoDB:', error);
        res.json({
            success: false,
            error: error.message,
            message: 'Erro ao verificar dados do OAuth no MongoDB'
        });
    }
});

// Rota 404 - deve ser a última rota
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Start server
async function startServer() {
    // Connect to MongoDB first
    await connectToMongoDB();
    
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
        console.log(`📁 Arquivos estáticos servidos de: ${path.join(__dirname, 'public')}`);
        console.log(`📤 Uploads salvos em: ${path.join(__dirname, 'uploads')}`);
        console.log(`💳 Woovi PIX integrado e funcionando`);
        console.log(`🗄️ MongoDB: ${campaignsCollection ? 'Conectado' : 'Desconectado (usando localStorage)'}`);
        
        // Testar conectividade com Evolution API
        testEvolutionAPI();
        
        // Aquecer proxies para Instagram
        warmUpProxies().catch(error => {
            console.error('❌ Erro ao aquecer proxies:', error.message);
        });
    });
}

startServer().catch(console.error);

module.exports = app;