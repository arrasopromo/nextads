/**
 * Sistema de Gerenciamento de Sessão
 * Implementa timeouts, rotatividade de tokens e logout automático
 */
console.log('📁 session-manager.js carregado');
class SessionManager {
    constructor() {
        this.IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hora para logout
        this.IDLE_CHECK_INTERVAL = 30 * 1000; // 30 segundos
        this.IDLE_WARNING_TIME = 60 * 1000; // 1 minuto para começar validação
        this.ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 horas
        this.ACCESS_TOKEN_LIFETIME = 60 * 60 * 1000; // 1 hora
        this.REFRESH_TOKEN_LIFETIME = 30 * 24 * 60 * 60 * 1000; // 30 dias
        
        // Configuração de API baseada no ambiente
        this.API_BASE_URL = this.getApiBaseUrl();
        
        this.idleTimer = null;
        this.absoluteTimer = null;
        this.tokenRefreshTimer = null;
        this.lastActivity = Date.now();
        this.sessionStartTime = Date.now();
    }
    
    getApiBaseUrl() {
        // Usar sempre caminho relativo ao origin atual
        return '';
    }
    
    init() {
        console.log('🔄 Inicializando SessionManager...');
        
        // Verificar se há uma sessão ativa
        const user = this.getStoredUser();
        if (user) {
            console.log('👤 Usuário encontrado, iniciando sessão');
            this.startSession();
        }
        
        this.setupActivityListeners();
        this.validateSession();
    }
    
    setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.updateActivity();
            }, true);
        });
        
        // Detectar quando a aba fica inativa
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseTimers();
            } else {
                this.resumeTimers();
            }
        });
        
        // Comentado: O evento beforeunload estava causando logout ao atualizar a página
        // Mesmo quando o usuário não marcava "lembrar-me", a sessão deve persistir durante a navegação
        // O logout automático deve acontecer apenas por timeout ou ação explícita do usuário
        /*
        window.addEventListener('beforeunload', () => {
            const user = this.getStoredUser();
            if (user && !user.rememberMe) {
                this.logout(false); // Logout silencioso
            }
        });
        */
    }
    
    startSession() {
        this.lastActivity = Date.now();
        this.sessionStartTime = Date.now();
        
        console.log('🚀 Iniciando sessão...');
        console.log(`⏰ Timeout de inatividade: ${this.IDLE_TIMEOUT / 1000} segundos`);
        console.log(`⏰ Timeout absoluto: ${this.ABSOLUTE_TIMEOUT / (1000 * 60 * 60)} horas`);
        
        // Iniciar timer de inatividade
        this.resetIdleTimer();
        
        // Iniciar timer absoluto
        this.resetAbsoluteTimer();
        
        // Iniciar rotatividade de tokens
        this.scheduleTokenRefresh();
        
        console.log('✅ Sessão iniciada com timeouts configurados');
    }
    
    updateActivity() {
        const now = Date.now();
        this.lastActivity = now;
        this.resetIdleTimer();
    }
    
    resetIdleTimer() {
        if (this.idleTimer) {
            clearInterval(this.idleTimer);
        }
        
        // Verificar inatividade a cada 30 segundos, mas só começar após 1 minuto
        this.idleTimer = setInterval(() => {
            const timeSinceLastActivity = Date.now() - this.lastActivity;
            
            // Só começar a validar após 1 minuto de inatividade
            if (timeSinceLastActivity >= this.IDLE_WARNING_TIME) {
                // Fazer logout após 1 hora de inatividade
                if (timeSinceLastActivity >= this.IDLE_TIMEOUT) {
                    this.handleIdleTimeout();
                }
            }
        }, this.IDLE_CHECK_INTERVAL);
    }
    
    resetAbsoluteTimer() {
        if (this.absoluteTimer) {
            clearTimeout(this.absoluteTimer);
        }
        
        const timeRemaining = this.ABSOLUTE_TIMEOUT - (Date.now() - this.sessionStartTime);
        
        if (timeRemaining > 0) {
            this.absoluteTimer = setTimeout(() => {
                this.handleAbsoluteTimeout();
            }, timeRemaining);
        } else {
            this.handleAbsoluteTimeout();
        }
    }
    
    scheduleTokenRefresh() {
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
        }
        
        // Renovar token 5 minutos antes de expirar
        const refreshTime = this.ACCESS_TOKEN_LIFETIME - (5 * 60 * 1000);
        
        this.tokenRefreshTimer = setTimeout(() => {
            this.refreshAccessToken();
        }, refreshTime);
    }
    
    async refreshAccessToken() {
        try {
            const user = this.getStoredUser();
            if (!user || !user.refreshToken) {
                this.logout();
                return;
            }
            
            const response = await fetch(`${this.API_BASE_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refreshToken: user.refreshToken
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Atualizar tokens
                user.accessToken = data.accessToken;
                user.refreshToken = data.refreshToken;
                user.tokenExpiry = Date.now() + this.ACCESS_TOKEN_LIFETIME;
                
                this.storeUser(user);
                
                // Agendar próxima renovação
                this.scheduleTokenRefresh();
                
                console.log('Token renovado com sucesso');
            } else {
                console.log('Falha na renovação do token:', data.error);
                this.logout();
            }
        } catch (error) {
            console.error('Erro ao renovar token:', error);
            this.logout();
        }
    }
    
    handleIdleTimeout() {
        const timeSinceLastActivity = Date.now() - this.lastActivity;
        console.log(`⚠️ TIMEOUT DE INATIVIDADE ACIONADO! Tempo desde última atividade: ${timeSinceLastActivity}ms (${timeSinceLastActivity / 1000}s)`);
        console.log('Sessão expirada por inatividade');
        this.logout(true, 'Sua sessão expirou por inatividade.');
    }
    
    handleAbsoluteTimeout() {
        console.log('Sessão expirada por tempo absoluto');
        this.logout(true, 'Sua sessão expirou. Faça login novamente.');
    }
    
    async logout(showMessage = true, message = 'Você foi desconectado.') {
        try {
            // Invalidar tokens no servidor
            const user = this.getStoredUser();
            if (user && user.refreshToken) {
                await fetch(`${this.API_BASE_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.accessToken}`
                    },
                    body: JSON.stringify({
                        refreshToken: user.refreshToken
                    })
                });
            }
        } catch (error) {
            console.error('Erro ao invalidar tokens no servidor:', error);
        }
        
        // Limpar timers
        this.clearAllTimers();
        
        // Limpar dados locais
        this.clearStoredData();
        
        // Mostrar mensagem se necessário
        if (showMessage) {
            alert(message);
        }
        
        // Redirecionar para login
        window.location.href = '/';
    }
    
    async validateSession() {
        console.log('🔍 validateSession() iniciado');
        const user = this.getStoredUser();
        console.log('👤 getStoredUser() retornou:', user);
        if (!user) {
            console.log('❌ Nenhum usuário encontrado no localStorage');
            return false;
        }
        
        // Verificar se o token expirou
        // TEMPORARIAMENTE COMENTADO PARA EVITAR LOGOUT AUTOMÁTICO
        /*
        if (user.tokenExpiry && Date.now() > user.tokenExpiry) {
            await this.refreshAccessToken();
            return this.getStoredUser() !== null;
        }
        */
        
        // Verificar timeout absoluto
        if (user.sessionStart && (Date.now() - user.sessionStart) > this.ABSOLUTE_TIMEOUT) {
            this.handleAbsoluteTimeout();
            return false;
        }
        
        // Verificar dispositivo (desabilitado temporariamente)
        // A verificação de dispositivo pode estar causando logout desnecessário
        // Comentado até resolver o problema de fingerprint inconsistente
        /*
        const currentFingerprint = this.getDeviceFingerprint();
        if (user.deviceFingerprint && user.deviceFingerprint !== currentFingerprint) {
            console.log('🔒 Dispositivo diferente detectado:', {
                stored: user.deviceFingerprint,
                current: currentFingerprint
            });
            this.logout(true, 'Detectado login em dispositivo diferente. Faça login novamente.');
            return false;
        }
        */
        
        // Se chegou até aqui, a sessão é válida
        // Reiniciar os timers para manter a sessão ativa
        this.startSession();
        console.log('✅ validateSession() retornando true');
        return true;
    }
    
    getUserData() {
        return this.getStoredUser();
    }
    
    isLoggedIn() {
        const user = this.getStoredUser();
        return user !== null;
    }
    
    pauseTimers() {
        if (this.idleTimer) {
            clearInterval(this.idleTimer);
        }
    }
    
    resumeTimers() {
        this.resetIdleTimer();
    }
    
    // Método para notificar CampaignTracker sobre login
    notifyCampaignTrackerLogin(userData) {
        console.log('🔔 Notificando CampaignTracker sobre login:', userData);
        
        // Verificar se existe CampaignTracker ativo
        if (window.campaignCreator && window.campaignCreator.campaignTracker) {
            const tracker = window.campaignCreator.campaignTracker;
            console.log('📊 CampaignTracker encontrado, atualizando userId');
            
            // Usar o método updateUserId do CampaignTracker
            if (typeof tracker.updateUserId === 'function') {
                tracker.updateUserId(userData.userId).then(() => {
                    console.log('💾 UserId atualizado e campanha salva com sucesso');
                }).catch(error => {
                    console.error('❌ Erro ao atualizar userId na campanha:', error);
                });
            } else {
                console.error('❌ Método updateUserId não encontrado no CampaignTracker');
            }
        } else {
            console.log('⚠️ CampaignTracker não encontrado');
        }
    }
    
    clearAllTimers() {
        if (this.idleTimer) clearInterval(this.idleTimer);
        if (this.absoluteTimer) clearTimeout(this.absoluteTimer);
        if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
    }
    
    getStoredUser() {
        try {
            // Ler de 'userData' ou fallback para 'nextads_user_data'
            const userData = localStorage.getItem('userData') || localStorage.getItem('nextads_user_data');
            if (userData) {
                const user = JSON.parse(userData);
                // Garantir que firstName esteja sempre disponível
                if (user.name && !user.firstName) {
                    user.firstName = user.name.split(' ')[0];
                }
                // Se estava apenas em nextads_user_data, espelhar para userData
                if (!localStorage.getItem('userData')) {
                    try {
                        localStorage.setItem('userData', JSON.stringify(user));
                    } catch (e) {
                        console.warn('⚠️ Não foi possível espelhar userData:', e);
                    }
                }
                return user;
            }
            return null;
        } catch (error) {
            console.error('Erro ao recuperar dados do usuário:', error);
            return null;
        }
    }
    
    storeUser(user) {
        try {
            const dataStr = JSON.stringify(user);
            localStorage.setItem('userData', dataStr);
            // Espelhar para convenções do LoginComponent
            localStorage.setItem('nextads_user_data', dataStr);
            if (user && user.accessToken) {
                localStorage.setItem('nextads_session_token', user.accessToken);
            }
        } catch (error) {
            console.error('Erro ao armazenar dados do usuário:', error);
        }
    }
    
    clearStoredData() {
        localStorage.removeItem('userData');
        localStorage.removeItem('nextads_user_data');
        localStorage.removeItem('nextads_session_token');
        sessionStorage.clear();
    }
    
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            fingerprint: this.getDeviceFingerprint()
        };
    }
    
    getDeviceFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            canvas.toDataURL()
        ].join('|');
        
        // Simples hash
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return hash.toString();
    }
    
    // Método para login com configuração de sessão
    async login(credentials, rememberMe = false) {
        console.log('🔐 INICIANDO LOGIN - Dados recebidos:', {
            email: credentials.email,
            rememberMe: rememberMe,
            API_BASE_URL: this.API_BASE_URL
        });
        
        try {
            console.log('📡 Fazendo requisição para:', `${this.API_BASE_URL}/api/login`);
            console.log('📦 Payload da requisição:', {
                ...credentials,
                password: '[OCULTO]', // Não mostrar senha nos logs
                rememberMe
            });
            
            const response = await fetch(`${this.API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...credentials,
                    rememberMe
                })
            });
            
            console.log('📨 Resposta recebida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                url: response.url
            });
            
            // Verificar se a resposta é um erro 502 ou similar
            if (response.status === 502 || response.status === 503 || response.status === 504) {
                console.error('🚨 ERRO DE SERVIDOR - Serviço indisponível:', {
                    status: response.status,
                    statusText: response.statusText
                });
                return { 
                    success: false, 
                    error: '🚨 SERVIDOR TEMPORARIAMENTE FORA DO AR\n\nO servidor está passando por manutenção.\nTente novamente em alguns minutos.\n\nSe o problema persistir, entre em contato conosco.',
                    errorType: 'SERVER_ERROR',
                    statusCode: response.status
                };
            }
            
            // Verificar se a resposta é HTML (erro de proxy/nginx)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                console.error('🚨 ERRO DE PROXY - Resposta HTML recebida em vez de JSON');
                const htmlText = await response.text();
                console.error('📄 Conteúdo HTML recebido:', htmlText.substring(0, 200) + '...');
                
                return { 
                    success: false, 
                    error: 'Erro de configuração do servidor. Entre em contato com o suporte.',
                    errorType: 'PROXY_ERROR',
                    statusCode: response.status
                };
            }
            
            let data;
            try {
                data = await response.json();
                console.log('📄 Dados da resposta:', data);
            } catch (jsonError) {
                console.error('💥 ERRO AO PARSEAR JSON:', jsonError);
                console.error('📄 Resposta raw:', await response.text());
                
                return { 
                    success: false, 
                    error: 'Resposta inválida do servidor. Tente novamente.',
                    errorType: 'JSON_PARSE_ERROR',
                    statusCode: response.status
                };
            }
            
            if (response.ok && data.success) {
                console.log('✅ Login bem-sucedido! Dados do usuário:', data.user);
                
                const user = {
                    ...data.user,
                    userId: data.user.id, // Mapear id para userId para compatibilidade
                    firstName: data.user.name ? data.user.name.split(' ')[0] : 'Usuário', // Extrair primeiro nome
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    tokenExpiry: Date.now() + this.ACCESS_TOKEN_LIFETIME,
                    sessionStart: Date.now(),
                    deviceFingerprint: this.getDeviceFingerprint(),
                    rememberMe
                };
                
                console.log('💾 Armazenando dados do usuário:', user);
                this.storeUser(user);
                
                console.log('🚀 Iniciando sessão...');
                this.startSession();
                
                // Notificar CampaignTracker sobre o login
                console.log('🔔 Notificando CampaignTracker...');
                this.notifyCampaignTrackerLogin(user);
                
                // Disparar evento de login para fechar modal automaticamente
                console.log('📡 Disparando evento nextadsLogin...');
                if (window.loginComponent && typeof window.loginComponent.triggerLoginEvent === 'function') {
                    window.loginComponent.triggerLoginEvent(user);
                } else {
                    // Fallback: disparar evento diretamente
                    window.dispatchEvent(new CustomEvent('nextadsLogin', {
                        detail: { userData: user }
                    }));
                }
                
                console.log('✅ LOGIN CONCLUÍDO COM SUCESSO!');
                return { success: true, user };
            } else {
                console.error('❌ Login falhou:', {
                    status: response.status,
                    error: data.error || 'Erro no login',
                    data: data
                });
                return { 
                    success: false, 
                    error: data.error || 'Erro no login',
                    errorType: 'LOGIN_FAILED',
                    statusCode: response.status
                };
            }
        } catch (error) {
            console.error('💥 ERRO CRÍTICO NO LOGIN:', error);
            console.error('Stack trace:', error.stack);
            console.error('Detalhes do erro:', {
                name: error.name,
                message: error.message,
                cause: error.cause
            });
            
            // Verificar se é erro de rede
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return { 
                    success: false, 
                    error: 'Erro de conexão. Verifique sua internet e tente novamente.',
                    errorType: 'NETWORK_ERROR'
                };
            }
            
            // Verificar se é erro de timeout
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                return { 
                    success: false, 
                    error: 'Timeout na conexão. Tente novamente.',
                    errorType: 'TIMEOUT_ERROR'
                };
            }
            
            return { 
                success: false, 
                error: 'Erro de conexão: ' + error.message,
                errorType: 'UNKNOWN_ERROR'
            };
        }
    }

    async register(userData) {
        console.log('📝 INICIANDO REGISTRO - Dados recebidos:', {
            email: userData.email,
            name: userData.name,
            whatsapp: userData.whatsapp,
            API_BASE_URL: this.API_BASE_URL
        });
        
        try {
            console.log('📡 Fazendo requisição de registro para:', `${this.API_BASE_URL}/api/users`);
            
            const response = await fetch(`${this.API_BASE_URL}/api/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData),
                timeout: 10000 // 10 segundos de timeout
            });
            
            console.log('📨 Resposta do registro recebida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                url: response.url
            });

            // Verificar se é erro 502 (servidor fora do ar)
            if (response.status === 502) {
                console.error('🚨 SERVIDOR FORA DO AR - Erro 502');
                return { 
                    success: false, 
                    error: '🚨 SERVIDOR TEMPORARIAMENTE FORA DO AR\n\nO servidor está passando por manutenção.\nTente novamente em alguns minutos.\n\nSe o problema persistir, entre em contato conosco.',
                    errorType: 'SERVER_DOWN'
                };
            }

            // Verificar se é erro de proxy/gateway
            if (response.status >= 502 && response.status <= 504) {
                console.error('🚨 ERRO DE SERVIDOR - Status:', response.status);
                return { 
                    success: false, 
                    error: '🚨 SERVIDOR INDISPONÍVEL\n\nProblema de conectividade com o servidor.\nTente novamente em alguns minutos.',
                    errorType: 'SERVER_ERROR'
                };
            }
            
            const data = await response.json();
            console.log('📄 Dados da resposta do registro:', data);
            
            if (response.ok && data.success) {
                console.log('✅ Registro bem-sucedido! Iniciando login automático...');
                
                // Aguardar um pouco para garantir que o usuário foi salvo no banco
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fazer login automático após registro bem-sucedido
                console.log('🔐 Tentando login automático com:', {
                    email: userData.email,
                    API_BASE_URL: this.API_BASE_URL
                });
                
                const loginResult = await this.login({
                    email: userData.email,
                    password: userData.password
                }, false); // rememberMe = false por padrão
                
                if (loginResult.success) {
                    console.log('✅ LOGIN AUTOMÁTICO REALIZADO COM SUCESSO!');
                    console.log('👤 Usuário logado:', loginResult.user);
                    return { success: true, user: loginResult.user, autoLogin: true };
                } else {
                    console.warn('⚠️ Registro OK, mas login automático falhou:', loginResult.error);
                    console.warn('🔍 Detalhes do erro de login:', loginResult);
                    return { success: true, user: data.user, autoLogin: false, loginError: loginResult.error };
                }
            } else {
                console.error('❌ Registro falhou:', {
                    status: response.status,
                    error: data.error || 'Erro no cadastro',
                    data: data
                });
                return { success: false, error: data.error || 'Erro no cadastro' };
            }
        } catch (error) {
            console.error('💥 ERRO CRÍTICO NO REGISTRO:', error);
            console.error('Stack trace:', error.stack);
            console.error('Detalhes do erro:', {
                name: error.name,
                message: error.message,
                cause: error.cause
            });
            
            // Verificar se é erro de rede/conectividade
            if (error.message.includes('Failed to fetch') || 
                error.message.includes('NetworkError') ||
                error.message.includes('ERR_NETWORK') ||
                error.message.includes('ERR_INTERNET_DISCONNECTED') ||
                error.message.includes('502') ||
                error.message.includes('Bad Gateway')) {
                return { 
                    success: false, 
                    error: '🚨 SERVIDOR TEMPORARIAMENTE FORA DO AR\n\nO servidor está passando por manutenção.\nTente novamente em alguns minutos.\n\nSe o problema persistir, entre em contato conosco.',
                    errorType: 'NETWORK_ERROR'
                };
            }
            
            return { success: false, error: 'Erro de conexão: ' + error.message };
        }
    }
}

// Instanciar o gerenciador de sessão
const sessionManager = new SessionManager();
console.log('✅ SessionManager criado:', sessionManager);

// Inicializar o gerenciador de sessão
sessionManager.init();
console.log('🔄 SessionManager inicializado');

// Exportar para uso global
window.sessionManager = sessionManager;
console.log('🌐 window.sessionManager definido:', typeof window.sessionManager);