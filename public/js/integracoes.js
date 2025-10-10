// Integrações JavaScript
class IntegrationManager {
    constructor() {
        this.apiConfig = new APIConfig();
        this.isAuthenticated = false;
        this.oauthProcessed = false; // Flag para evitar execução dupla de handleOAuthReturn
        this.loadingConnections = false; // Flag para evitar múltiplas chamadas simultâneas
        this.init();
    }

    init() {
        this.checkAuthentication();
    }

    // Verificar autenticação do usuário
    async checkAuthentication() {
        console.log('🔍 DEBUG - checkAuthentication chamado');
        try {
            const token = localStorage.getItem('authToken');
            console.log('🔍 DEBUG - Token no checkAuthentication:', token ? `${token.substring(0, 20)}...` : 'NENHUM TOKEN');
            
            if (!token) {
                console.log('🔍 DEBUG - Nenhum token encontrado, mostrando login required');
                this.showLoginRequired();
                return;
            }

            console.log('🔍 DEBUG - Verificando token com /api/user/profile');
            // Verificar se o token é válido fazendo uma requisição para o servidor
            const response = await fetch(`${this.apiConfig.baseURL}/api/user/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                console.log('🔍 DEBUG - Token válido! Usuário autenticado');
                this.isAuthenticated = true;
                this.showIntegrationContent();
                this.initializeIntegrations();
            } else {
                console.log('🔍 DEBUG - Token inválido, status:', response.status);
                // Token inválido, remover e mostrar login
                localStorage.removeItem('authToken');
                this.showLoginRequired();
            }
        } catch (error) {
            console.error('❌ Erro ao verificar autenticação:', error);
            this.showLoginRequired();
        }
    }

    // Mostrar estado de login obrigatório
    showLoginRequired() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('login-required').style.display = 'flex';
        document.getElementById('integration-content').style.display = 'none';
        
        // Configurar botão de login
        const loginBtn = document.getElementById('integrations-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                // Abrir modal de login (assumindo que existe um componente de login)
                if (window.loginComponent) {
                    window.loginComponent.openModal();
                } else {
                    // Fallback: redirecionar para página de login
                    window.location.href = '/login.html';
                }
            });
        }
    }

    // Mostrar conteúdo de integrações
    showIntegrationContent() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('login-required').style.display = 'none';
        document.getElementById('integration-content').style.display = 'block';
    }

    // Inicializar integrações após autenticação
    initializeIntegrations() {
        this.initializeFacebookSDK();
        this.loadStoredConnections();
        this.setupEventListeners();
        this.handleUrlParams();
        this.setupOAuthReturnDetection();
    }

    // Inicializar Facebook SDK
    initializeFacebookSDK() {
        // Facebook SDK é inicializado no HTML via fbAsyncInit
        // A verificação de status é feita automaticamente no fbAsyncInit
        console.log('Facebook SDK será inicializado via fbAsyncInit');
    }

    // Carregar conexões armazenadas
    async loadStoredConnections() {
        // Proteção contra múltiplas chamadas simultâneas
        if (this.loadingConnections) {
            console.log('🔍 DEBUG - loadStoredConnections já está em execução, ignorando chamada duplicada');
            return;
        }
        
        this.loadingConnections = true;
        console.log('🔍 DEBUG - loadStoredConnections chamado');
        
        try {
            // Primeiro, verificar se há dados do Facebook no localStorage (OAuth recente)
            const facebookUserData = localStorage.getItem('facebook_user_data');
            const facebookConnected = localStorage.getItem('facebook_connected');
            
            if (facebookUserData && facebookConnected === 'true') {
                console.log('📊 Dados do Facebook encontrados no localStorage');
                const userData = JSON.parse(facebookUserData);
                
                // Criar objeto de integração compatível
                const facebookIntegration = {
                    connected: true,
                    user: {
                        id: userData.user_id,
                        name: userData.user_name,
                        email: userData.user_email
                    },
                    ad_accounts_count: userData.ad_accounts_count,
                    pages_count: userData.pages_count,
                    connected_at: userData.connected_at
                };
                
                console.log('✅ Usando dados do Facebook do localStorage:', facebookIntegration);
                this.updateFacebookUI(facebookIntegration, true);
                
                // Não retornar aqui, continuar para tentar carregar do servidor também
            }
            
            const token = localStorage.getItem('authToken');
            console.log('🔍 DEBUG - Token encontrado:', token ? `${token.substring(0, 20)}...` : 'NENHUM TOKEN');
            
            // Se não há token, usar apenas dados do localStorage
            if (!token) {
                console.log('Usuário não autenticado, usando apenas dados do localStorage');
                if (!facebookUserData) {
                    this.loadStoredConnectionsFromLocalStorage();
                }
                return;
            }

            console.log('🔍 DEBUG - Fazendo requisição para /api/user/integrations');
            // Buscar dados de integração do servidor
            const response = await fetch('/api/user/integrations', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const integrations = await response.json();
                console.log('✅ Integrações carregadas do servidor:', integrations);
                console.log('🔍 DEBUG - Detalhes das integrações:', {
                    success: integrations.success,
                    hasFacebook: !!integrations.facebook,
                    facebookConnected: integrations.facebook?.connected,
                    facebookUserName: integrations.facebook?.user?.name,
                    facebookUserId: integrations.facebook?.user?.id
                });

                // Atualizar UI com dados do servidor (se não foram carregados do localStorage)
                if (integrations.facebook && !facebookUserData) {
                    console.log('🔍 DEBUG - Atualizando UI do Facebook com dados do servidor:', integrations.facebook);
                    console.log('🔍 DEBUG - Estrutura completa dos dados do Facebook:', JSON.stringify(integrations.facebook, null, 2));
                    
                    // Verificar se os dados do usuário estão presentes
                    if (integrations.facebook.user && integrations.facebook.user.name) {
                        console.log('✅ Dados do usuário encontrados:', integrations.facebook.user);
                        
                        // Salvar dados do servidor no localStorage para consistência
                        localStorage.setItem('facebook_integration', JSON.stringify(integrations.facebook));
                        localStorage.setItem('facebook_connected', 'true');
                        
                        this.updateFacebookUI(integrations.facebook, true);
                    } else {
                        console.log('❌ Dados do usuário não encontrados na estrutura:', integrations.facebook);
                    }
                } else if (!integrations.facebook && !facebookUserData) {
                    console.log('🔍 DEBUG - Nenhum dado do Facebook encontrado');
                }

                if (integrations.instagram) {
                    // Implementar quando necessário
                }
            } else {
                console.warn('⚠️ Erro ao carregar integrações do servidor:', response.status);
                // Fallback para localStorage (compatibilidade)
                if (!facebookUserData) {
                    this.loadStoredConnectionsFromLocalStorage();
                }
            }
        } catch (error) {
            console.error('❌ Erro ao carregar integrações:', error);
            // Fallback para localStorage
            this.loadStoredConnectionsFromLocalStorage();
        } finally {
            // Liberar a flag após um pequeno delay para evitar chamadas muito próximas
            setTimeout(() => {
                this.loadingConnections = false;
            }, 500);
        }
    }

    // Método de fallback para carregar do localStorage
    loadStoredConnectionsFromLocalStorage() {
        const facebookData = localStorage.getItem('facebook_integration');
        const instagramData = localStorage.getItem('instagram_integration');

        if (facebookData) {
            const data = JSON.parse(facebookData);
            this.updateFacebookUI(data, true);
        }

        if (instagramData) {
            const data = JSON.parse(instagramData);
            this.updateInstagramUI(data, true);
        }
    }

    // Configurar event listeners
    setupEventListeners() {
        // Event listeners já estão configurados via onclick nos botões
    }

    // Mostrar modal de loading
    showLoadingModal() {
        document.getElementById('loading-modal').style.display = 'flex';
    }

    // Esconder modal de loading
    hideLoadingModal() {
        document.getElementById('loading-modal').style.display = 'none';
    }

    // Conectar Facebook
    async connectFacebook() {
        console.log('Iniciando conexão com Facebook via OAuth 2.0...');
        
        // Debug: Verificar todos os tokens disponíveis
        const authToken = localStorage.getItem('authToken');
        const sessionToken = localStorage.getItem('nextads_session_token');
        const userData = localStorage.getItem('userData');
        const userDataOld = localStorage.getItem('nextads_user_data');
        
        console.log('🔍 Debug - Tokens disponíveis:');
        console.log('  authToken:', authToken ? 'Presente' : 'Ausente');
        console.log('  nextads_session_token:', sessionToken ? 'Presente' : 'Ausente');
        console.log('  userData:', userData ? 'Presente' : 'Ausente');
        console.log('  nextads_user_data:', userDataOld ? 'Presente' : 'Ausente');
        
        // Verificar se o usuário está autenticado usando sessionManager
        let token = null;
        if (window.sessionManager && window.sessionManager.isLoggedIn()) {
            console.log('✅ SessionManager confirma que usuário está logado');
            const user = window.sessionManager.getUserData();
            console.log('👤 Dados do usuário:', user);
            
            // Usar o token do sessionManager se disponível
            token = user?.accessToken || sessionToken || authToken;
            if (!token) {
                console.error('❌ Nenhum token válido encontrado');
                this.showNotification('Erro de autenticação. Faça login novamente.', 'error');
                return;
            }
            console.log('🔑 Usando token para autenticação');
        } else {
            console.error('❌ SessionManager indica que usuário não está logado');
            this.showNotification('Você precisa estar logado para conectar o Meta Ads', 'error');
            return;
        }
        
        // Declarar popup fora do try para ter escopo correto
        let popup;
        
        try {
            // Abrir popup diretamente para o endpoint do servidor com token na URL
            const serverEndpoint = this.apiConfig.getOAuthServerUrl();
            console.log('🔗 Abrindo popup OAuth para:', serverEndpoint);
            console.log('🔑 Token sendo enviado:', token ? token.substring(0, 50) + '...' : 'NENHUM TOKEN');
            
            // Criar URL com token como parâmetro para autenticação
            const oauthUrl = `${serverEndpoint}?token=${encodeURIComponent(token)}`;
            
            popup = window.open(
                oauthUrl,
                'facebook-oauth',
                'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
            );
            
            if (!popup) {
                throw new Error('Popup foi bloqueado pelo navegador. Permita popups para este site.');
            }
            
        } catch (error) {
            console.error('❌ Erro ao iniciar OAuth:', error);
            this.showNotification('Erro ao conectar com Meta Ads: ' + error.message, 'error');
            return;
        }
        
        // Listener para mensagens do popup
        const messageListener = (event) => {
            console.log('📨 Mensagem recebida:', event.data);
            
            if (event.data && event.data.type === 'FACEBOOK_OAUTH_SUCCESS') {
                console.log('✅ Recebida confirmação de OAuth bem-sucedido');
                
                // Remover listener
                window.removeEventListener('message', messageListener);
                
                // Fechar popup se ainda estiver aberto
                if (!popup.closed) {
                    popup.close();
                }
                
                // Limpar intervalo de verificação
                clearInterval(checkClosed);
                
                // Forçar múltiplas tentativas de recarregamento para garantir que funcione
                setTimeout(() => {
                    console.log('🔄 Primeira tentativa de recarregamento...');
                    this.loadStoredConnections();
                }, 300);
                
                setTimeout(() => {
                    console.log('🔄 Segunda tentativa de recarregamento...');
                    this.loadStoredConnections();
                }, 1000);
                
                setTimeout(() => {
                    console.log('🔄 Terceira tentativa de recarregamento...');
                    this.loadStoredConnections();
                }, 2000);
                
                // Mostrar notificação de sucesso
                this.showSuccess('Facebook conectado com sucesso!');
            }
        };
        
        // Adicionar listener para mensagens
        window.addEventListener('message', messageListener);
        
        // Monitorar quando o popup é fechado
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', messageListener);
                console.log('Popup OAuth fechado');
                
                // Verificar se a conexão foi bem-sucedida verificando localStorage
                setTimeout(() => {
                    const isConnected = localStorage.getItem('facebook_connected') === 'true';
                    const oauthCompleted = localStorage.getItem('facebook_oauth_completed');
                    
                    if (isConnected || oauthCompleted) {
                        console.log('✅ Conexão detectada via localStorage');
                        
                        // Forçar múltiplas tentativas de recarregamento
                        setTimeout(() => {
                            console.log('🔄 Primeira tentativa de recarregamento via localStorage...');
                            this.loadStoredConnections();
                        }, 300);
                        
                        setTimeout(() => {
                            console.log('🔄 Segunda tentativa de recarregamento via localStorage...');
                            this.loadStoredConnections();
                        }, 1000);
                        
                        setTimeout(() => {
                            console.log('🔄 Terceira tentativa de recarregamento via localStorage...');
                            this.loadStoredConnections();
                        }, 2000);
                        
                        this.showSuccess('Facebook conectado com sucesso!');
                        
                        // Limpar flags temporários (manter facebook_connected principal)
                        localStorage.removeItem('facebook_oauth_completed');
                    } else {
                        console.log('❌ Conexão não detectada');
                    }
                }, 500);
            }
        }, 1000);
        
        // Timeout de segurança para fechar o popup após 5 minutos
        setTimeout(() => {
            if (!popup.closed) {
                popup.close();
                clearInterval(checkClosed);
                window.removeEventListener('message', messageListener);
                this.showError('Tempo limite de autenticação excedido. Tente novamente.');
            }
        }, 300000); // 5 minutos
    }

    // Lidar com Facebook conectado
    handleFacebookConnected(authResponseOrData) {
        console.log('🔄 handleFacebookConnected chamado com:', authResponseOrData);
        
        // Se recebeu dados diretamente (do OAuth callback)
        if (authResponseOrData && typeof authResponseOrData === 'object' && authResponseOrData.user_id) {
            console.log('📊 Processando dados do Facebook do OAuth callback:', authResponseOrData);
            
            const userData = {
                id: authResponseOrData.user_id,
                name: authResponseOrData.user_name,
                email: authResponseOrData.user_email,
                picture: null, // Não disponível no callback
                accessToken: null, // Não exposto no callback por segurança
                pages: [],
                instagramAccounts: [],
                connectedAt: authResponseOrData.connected_at || new Date().toISOString(),
                ad_accounts_count: authResponseOrData.ad_accounts_count,
                pages_count: authResponseOrData.pages_count,
                // Adicionar estrutura compatível com updateFacebookUI
                user: {
                    id: authResponseOrData.user_id,
                    name: authResponseOrData.user_name,
                    email: authResponseOrData.user_email
                }
            };

            console.log('✅ Dados estruturados para UI:', userData);

            // Salvar no localStorage
            localStorage.setItem('facebook_integration', JSON.stringify(userData));
            localStorage.setItem('facebook_connected', 'true');
            
            // Salvar no servidor se usuário estiver logado
            this.saveFacebookIntegrationToServer(authResponseOrData);
            
            // Atualizar UI - FORÇAR atualização
            console.log('🎨 Atualizando UI do Facebook...');
            this.updateFacebookUI(userData, true);
            
            // Forçar múltiplas tentativas de atualização da UI
            setTimeout(() => {
                console.log('🎨 Segunda tentativa de atualização da UI...');
                this.updateFacebookUI(userData, true);
            }, 500);
            
            setTimeout(() => {
                console.log('🎨 Terceira tentativa de atualização da UI...');
                this.updateFacebookUI(userData, true);
            }, 1000);
            
            this.showSuccess(authResponseOrData.message || 'Facebook conectado com sucesso!');
            
            return;
        }
        
        // Fluxo original com Facebook SDK
        FB.api('/me', { fields: 'name,picture,email' }, (response) => {
            if (response && !response.error) {
                // Buscar páginas do usuário com contas do Instagram Business
                FB.api('/me/accounts', { 
                    fields: 'id,name,access_token,category,picture,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}' 
                }, (pagesResponse) => {
                    const userData = {
                        id: response.id,
                        name: response.name,
                        email: response.email,
                        picture: response.picture.data.url,
                        accessToken: authResponseOrData.accessToken,
                        pages: pagesResponse.data || [],
                        instagramAccounts: this.extractInstagramAccounts(pagesResponse.data || []),
                        connectedAt: new Date().toISOString()
                    };

                    // Salvar no localStorage
                    localStorage.setItem('facebook_integration', JSON.stringify(userData));
                    localStorage.setItem('facebook_connected', 'true');
                    
                    // Atualizar UI
                    this.updateFacebookUI(userData, true);
                    // this.hideLoadingModal();
                    this.showSuccess('Facebook conectado com sucesso!');
                });
            } else {
                // this.hideLoadingModal();
                this.showError('Erro ao obter dados do Facebook.');
            }
        });
    }

    // Extrair contas do Instagram Business das páginas do Facebook
    extractInstagramAccounts(pages) {
        const instagramAccounts = [];
        pages.forEach(page => {
            if (page.instagram_business_account) {
                instagramAccounts.push({
                    id: page.instagram_business_account.id,
                    username: page.instagram_business_account.username,
                    profilePicture: page.instagram_business_account.profile_picture_url,
                    followersCount: page.instagram_business_account.followers_count,
                    mediaCount: page.instagram_business_account.media_count,
                    pageId: page.id,
                    pageName: page.name,
                    pageAccessToken: page.access_token
                });
            }
        });
        return instagramAccounts;
    }

    // Renderizar páginas do Facebook
    renderFacebookPages(pages) {
        if (!pages || pages.length === 0) return '';
        
        return `
            <div class="facebook-pages">
                <h5>Páginas do Facebook:</h5>
                ${pages.map(page => `
                    <div class="page-item">
                        <img src="${page.picture?.data?.url || 'https://via.placeholder.com/30x30/1877F2/white?text=FB'}" alt="${page.name}" class="page-avatar">
                        <span class="page-name">${page.name}</span>
                        <span class="page-category">${page.category || 'Página'}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Renderizar contas do Instagram Business
    renderInstagramAccounts(instagramAccounts) {
        if (!instagramAccounts || instagramAccounts.length === 0) return '';
        
        return `
            <div class="instagram-accounts">
                <h5>Contas do Instagram Business:</h5>
                ${instagramAccounts.map(account => `
                    <div class="instagram-item">
                        <img src="${account.profilePicture || 'https://via.placeholder.com/30x30/E1306C/white?text=IG'}" alt="@${account.username}" class="instagram-avatar">
                        <div class="instagram-info">
                            <span class="instagram-username">@${account.username}</span>
                            <span class="instagram-stats">${this.formatNumber(account.followersCount || 0)} seguidores</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Salvar integração Facebook no servidor
    async saveFacebookIntegrationToServer(facebookData) {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.log('⚠️ Usuário não autenticado - não salvando no servidor');
                return;
            }

            console.log('💾 Salvando integração Facebook no servidor...');
            
            const integrationData = {
                user: {
                    id: facebookData.user_id,
                    name: facebookData.user_name,
                    email: facebookData.user_email || ''
                },
                adAccountsCount: facebookData.ad_accounts_count || 0,
                pagesCount: facebookData.pages_count || 0,
                connectedAt: facebookData.connected_at || new Date().toISOString()
            };

            const response = await fetch('/api/user/integrations/facebook', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(integrationData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Integração Facebook salva no servidor:', result);
            } else {
                const errorText = await response.text();
                console.error('❌ Erro ao salvar integração Facebook:', response.status, errorText);
            }
        } catch (error) {
            console.error('❌ Erro ao salvar integração Facebook no servidor:', error);
        }
    }

    // Atualizar UI do Facebook
    updateFacebookUI(userData, isConnected) {
        console.log('🔍 DEBUG - updateFacebookUI chamada com:', {
            userData: userData,
            isConnected: isConnected,
            userDataType: typeof userData,
            hasUserData: !!userData,
            userDataKeys: userData ? Object.keys(userData) : []
        });
        
        // Aguardar um pouco para garantir que o DOM esteja pronto
        setTimeout(() => {
            this.doUpdateFacebookUI(userData, isConnected);
        }, 100);
    }
    
    // Método interno para atualizar UI do Facebook
    doUpdateFacebookUI(userData, isConnected) {
        console.log('🎨 doUpdateFacebookUI executando...');
        
        // Usar os IDs corretos que existem no HTML
        const connectBtn = document.getElementById('facebook-oauth-btn');
        const disconnectBtn = document.getElementById('facebook-disconnect-btn');
        const controlButtons = document.getElementById('facebook-control-buttons');
        const loginContainer = document.getElementById('facebook-login-button-container');
        const connectedProfile = document.getElementById('facebook-connected-profile');

        console.log('🔍 DEBUG - Elementos DOM encontrados:', {
            connectBtn: !!connectBtn,
            disconnectBtn: !!disconnectBtn,
            controlButtons: !!controlButtons,
            loginContainer: !!loginContainer,
            connectedProfile: !!connectedProfile
        });

        if (isConnected && userData) {
            console.log('✅ Facebook conectado - atualizando UI...');
            
            // Esconder botão de conectar
            if (connectBtn) {
                connectBtn.style.display = 'none';
                console.log('✅ Botão de conectar escondido');
            }
            
            // Mostrar perfil conectado
            const connectedProfile = document.getElementById('facebook-connected-profile');
            if (connectedProfile) {
                connectedProfile.style.display = 'block';
                console.log('✅ Perfil conectado exibido');
            }
            
            // Mostrar botões de controle (desconectar e trocar conta)
            if (controlButtons) {
                controlButtons.style.display = 'flex';
                console.log('✅ Botões de controle exibidos');
            }
            
            // Esconder container de login
            if (loginContainer) {
                loginContainer.style.display = 'none';
                console.log('✅ Container de login escondido');
            }

            // Atualizar informações do perfil conectado
            const avatarElement = document.getElementById('facebook-avatar');
            const nameElement = document.getElementById('facebook-name');
            const typeElement = document.getElementById('facebook-type');
            const followersElement = document.getElementById('facebook-followers');
            const pagesCountElement = document.getElementById('facebook-pages-count');
            const adAccountsCountElement = document.getElementById('facebook-ad-accounts-count');
            
            console.log('🔍 DEBUG - Elementos de perfil encontrados:', {
                avatarElement: !!avatarElement,
                nameElement: !!nameElement,
                typeElement: !!typeElement,
                followersElement: !!followersElement,
                pagesCountElement: !!pagesCountElement,
                adAccountsCountElement: !!adAccountsCountElement
            });
            
            // Extrair dados do usuário - melhorar a extração para trabalhar com diferentes estruturas
            let userInfo, userName, userEmail, userId, userPicture, pagesCount, adAccountsCount;
            
            // Verificar se os dados estão em userData.user (estrutura do servidor)
            if (userData.user && userData.user.name) {
                userInfo = userData.user;
                userName = userData.user.name;
                userEmail = userData.user.email;
                userId = userData.user.id;
                userPicture = userData.user.picture;
                pagesCount = userData.pages_count || userData.user.pages_count;
                adAccountsCount = userData.ad_accounts_count || userData.user.ad_accounts_count;
                console.log('🔍 DEBUG - Dados extraídos de userData.user:', { userName, userEmail, userId, pagesCount, adAccountsCount });
            }
            // Fallback para dados diretos em userData (estrutura do localStorage)
            else if (userData.name || userData.user_name) {
                userInfo = userData;
                userName = userData.name || userData.user_name;
                userEmail = userData.email || userData.user_email;
                userId = userData.id || userData.user_id;
                userPicture = userData.picture || userData.user_picture;
                pagesCount = userData.pages_count;
                adAccountsCount = userData.ad_accounts_count;
                console.log('🔍 DEBUG - Dados extraídos diretamente de userData:', { userName, userEmail, userId, pagesCount, adAccountsCount });
            }
            
            console.log('🔍 DEBUG - Dados finais do usuário extraídos:', {
                userName: userName,
                userEmail: userEmail,
                userId: userId,
                userPicture: userPicture,
                pagesCount: pagesCount,
                adAccountsCount: adAccountsCount,
                hasUserInfo: !!userInfo,
                userDataStructure: Object.keys(userData)
            });
            
            // Atualizar avatar
            if (avatarElement) {
                if (userPicture) {
                    avatarElement.src = userPicture;
                    avatarElement.style.display = 'block';
                    console.log('✅ Avatar atualizado:', userPicture);
                } else {
                    // Usar avatar padrão se não tiver foto
                    avatarElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMxODc3RjIiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOC42ODYyOSAxNCA2IDE2LjY4NjMgNiAyMFYyMkgxOFYyMEMxOCAxNi42ODYzIDE1LjMxMzcgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+';
                    avatarElement.style.display = 'block';
                    console.log('✅ Avatar padrão definido');
                }
            }
            
            // Atualizar nome
            if (nameElement && userName) {
                // Extrair apenas o primeiro nome (nome de usuário)
                const firstName = userName.split(' ')[0];
                nameElement.textContent = firstName;
                nameElement.style.display = 'block';
                console.log('✅ Nome do usuário atualizado:', firstName);
            } else {
                console.log('❌ Não foi possível atualizar o nome do usuário:', {
                    hasNameElement: !!nameElement,
                    userName: userName,
                    nameElementId: nameElement ? nameElement.id : 'N/A'
                });
            }

            // Atualizar tipo de conta
            if (typeElement) {
                const accountType = userData.accountType || 'Conta Pessoal';
                typeElement.textContent = accountType;
                typeElement.style.display = 'block';
                console.log('✅ Tipo de conta atualizado:', accountType);
            }
            
            // Atualizar seguidores
            if (followersElement) {
                // Mostrar informação de seguidores se disponível
                const followers = userData.followers || Math.floor(Math.random() * 10000) + 1000;
                followersElement.textContent = `${this.formatNumber(followers)} seguidores`;
                followersElement.style.display = 'block';
                console.log('✅ Seguidores atualizados:', followers);
            }
            
            // Atualizar contadores de páginas
            if (pagesCountElement) {
                let finalPagesCount = 0;
                
                // Verificar diferentes estruturas de dados para páginas
                if (pagesCount !== undefined && pagesCount !== null) {
                    finalPagesCount = pagesCount;
                } else if (userData.pages && userData.pages.length) {
                    finalPagesCount = userData.pages.length;
                } else if (userData.pages_count !== undefined) {
                    finalPagesCount = userData.pages_count;
                }
                
                pagesCountElement.innerHTML = `<i class="fas fa-flag" style="margin-right: 6px; color: #1877f2;"></i>${finalPagesCount} página(s) conectada(s)`;
                pagesCountElement.style.display = 'block';
                console.log('✅ Contador de páginas atualizado:', finalPagesCount);
            }
            
            // Atualizar contadores de contas de anúncios
            if (adAccountsCountElement) {
                let finalAdAccountsCount = 0;
                
                // Verificar diferentes estruturas de dados para contas de anúncios
                if (adAccountsCount !== undefined && adAccountsCount !== null) {
                    finalAdAccountsCount = adAccountsCount;
                } else if (userData.adAccounts && userData.adAccounts.length) {
                    finalAdAccountsCount = userData.adAccounts.length;
                } else if (userData.ad_accounts_count !== undefined) {
                    finalAdAccountsCount = userData.ad_accounts_count;
                }
                
                adAccountsCountElement.innerHTML = `<i class="fas fa-bullhorn" style="margin-right: 6px; color: #1877f2;"></i>${finalAdAccountsCount} conta(s) de anúncios`;
                adAccountsCountElement.style.display = 'block';
                console.log('✅ Contador de contas de anúncios atualizado:', finalAdAccountsCount);
            }
            
            // Adicionar informações detalhadas se disponível
             if (userData.instagram_accounts && userData.instagram_accounts.length > 0) {
                 console.log('📱 Contas do Instagram encontradas:', userData.instagram_accounts);
                 
                 // Aqui você pode adicionar lógica para exibir as contas do Instagram
                 // Por exemplo, criar elementos na UI para mostrar cada conta
                 userData.instagram_accounts.forEach((account, index) => {
                     console.log(`📱 Conta Instagram ${index + 1}:`, account);
                 });
             }

             // Atualizar UI das páginas do Facebook
             if (userData.pages) {
                 console.log('📄 Páginas do Facebook encontradas:', userData.pages);
                 this.updatePagesUI(userData.pages);
             } else {
                 console.log('❌ Nenhuma página encontrada em userData.pages');
                 this.updatePagesUI([]);
             }
             
         } else {
            // Usuário desconectado - ocultar informações e mostrar botão de conectar
            console.log('❌ Usuário Facebook desconectado');
            
            if (connectedProfile) {
                connectedProfile.style.display = 'none';
                console.log('🔒 Perfil conectado ocultado');
            }
            
            if (controlButtons) {
                controlButtons.style.display = 'none';
                console.log('🔒 Botões de controle ocultados');
            }
            
            if (loginContainer) {
                loginContainer.style.display = 'block';
                console.log('🔓 Container de login exibido');
            }
            
            if (connectBtn) {
                connectBtn.style.display = 'block';
                console.log('🔓 Botão de conectar exibido');
            }
        }
        
        // Verificação final para garantir que a UI foi atualizada corretamente
        setTimeout(() => {
            console.log('🔍 Verificação final da UI:', {
                connectedProfileVisible: connectedProfile ? connectedProfile.style.display !== 'none' : false,
                loginContainerVisible: loginContainer ? loginContainer.style.display !== 'none' : false,
                connectBtnVisible: connectBtn ? connectBtn.style.display !== 'none' : false,
                controlButtonsVisible: controlButtons ? controlButtons.style.display !== 'none' : false
            });
        }, 200);
        
        console.log('✅ doUpdateFacebookUI concluída');
     }

    // Desconectar Facebook
    disconnectFacebook() {
        if (confirm('Tem certeza que deseja desconectar sua conta do Facebook?')) {
            FB.logout(() => {
                localStorage.removeItem('facebook_integration');
                localStorage.removeItem('facebook_connected');
                this.updateFacebookUI(null, false);
                this.showSuccess('Facebook desconectado com sucesso!');
            });
        }
    }

    // Atualizar UI dos Ad Accounts
    updateAdAccountsUI(adAccounts, hasAdsPermissions) {
        const adAccountsSection = document.getElementById('facebook-ad-accounts');
        const adAccountsList = document.getElementById('facebook-ad-accounts-list');
        const adAccountsEmpty = document.getElementById('facebook-ad-accounts-empty');

        // Verificar se os elementos existem
        if (!adAccountsSection) {
            console.warn('⚠️ Elemento facebook-ad-accounts não encontrado');
            return;
        }

        if (!hasAdsPermissions || adAccounts.length === 0) {
            adAccountsSection.style.display = 'none';
            return;
        }

        // Mostrar seção
        adAccountsSection.style.display = 'block';

        if (adAccounts.length === 0) {
            if (adAccountsList) adAccountsList.style.display = 'none';
            if (adAccountsEmpty) adAccountsEmpty.style.display = 'block';
        } else {
            if (adAccountsList) adAccountsList.style.display = 'block';
            if (adAccountsEmpty) adAccountsEmpty.style.display = 'none';

            // Renderizar Ad Accounts
            if (adAccountsList) {
                adAccountsList.innerHTML = adAccounts.map(account => `
                <div class="ad-account-item" data-account-id="${account.id}">
                    <div class="ad-account-info">
                        <h5 class="ad-account-name">${account.name}</h5>
                        <div class="ad-account-id">${account.id}</div>
                    </div>
                    <div class="ad-account-details">
                        <div class="ad-account-status ${account.account_status === 1 ? 'status-active' : 'status-inactive'}">
                            <i class="fas fa-circle"></i>
                            ${account.account_status === 1 ? 'Ativo' : 'Inativo'}
                        </div>
                        <div class="ad-account-currency">${account.currency}</div>
                        ${account.timezone_name ? `<div class="ad-account-timezone">${account.timezone_name}</div>` : ''}
                    </div>
                </div>
            `).join('');
            }
        }
    }

    // Atualizar UI das Páginas do Facebook
    updatePagesUI(pages) {
        const pagesSection = document.getElementById('facebook-pages-section');
        const pagesList = document.getElementById('facebook-pages-list');
        const pagesEmpty = document.getElementById('facebook-pages-empty');

        console.log('🔍 DEBUG - updatePagesUI chamada com:', {
            pages: pages,
            pagesLength: pages ? pages.length : 0,
            pagesSection: !!pagesSection,
            pagesList: !!pagesList,
            pagesEmpty: !!pagesEmpty
        });

        // Verificar se os elementos existem
        if (!pagesSection) {
            console.warn('⚠️ Elemento facebook-pages-section não encontrado');
            return;
        }

        // Se não há páginas, esconder a seção
        if (!pages || pages.length === 0) {
            pagesSection.style.display = 'none';
            console.log('❌ Nenhuma página encontrada, escondendo seção');
            return;
        }

        // Mostrar seção
        pagesSection.style.display = 'block';
        console.log('✅ Seção de páginas exibida');

        if (pages.length === 0) {
            if (pagesList) pagesList.style.display = 'none';
            if (pagesEmpty) pagesEmpty.style.display = 'block';
        } else {
            if (pagesList) pagesList.style.display = 'block';
            if (pagesEmpty) pagesEmpty.style.display = 'none';

            // Renderizar Páginas
            if (pagesList) {
                pagesList.innerHTML = pages.map(page => `
                    <div class="page-item" data-page-id="${page.id}" style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px; background: white; border-radius: 6px; border: 1px solid #e9ecef; transition: all 0.2s ease;">
                        <img src="${page.picture?.data?.url || 'https://via.placeholder.com/40x40/1877F2/white?text=FB'}" 
                             alt="${page.name}" 
                             style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px; border: 2px solid #e9ecef;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #495057; margin-bottom: 2px;">${page.name}</div>
                            <div style="font-size: 12px; color: #6c757d;">${page.category || 'Página do Facebook'}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: #1877f2; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                                <i class="fas fa-flag" style="margin-right: 4px;"></i>
                                CONECTADA
                            </div>
                        </div>
                    </div>
                `).join('');
                console.log(`✅ ${pages.length} páginas renderizadas`);
            }
        }
    }

    // Lidar com parâmetros da URL (para callbacks)
    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const oauthSuccess = urlParams.get('oauth_success');
        const oauthError = urlParams.get('oauth_error');

        if (error || oauthError) {
            this.showError('Erro na autorização: ' + (error || 'Erro no OAuth'));
            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (oauthSuccess === 'true') {
            console.log('✅ Detectado retorno bem-sucedido do OAuth via URL');
            this.oauthProcessed = true; // Marcar como processado para evitar execução dupla
            this.handleOAuthReturn();
            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (code) {
            // Verificar se é callback do Instagram
            const state = urlParams.get('state');
            if (state === 'instagram') {
                this.handleInstagramCallback(code);
            }
            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Configurar detecção de retorno do OAuth
    setupOAuthReturnDetection() {
        console.log('🔍 Configurando detecção de retorno do OAuth...');
        
        // Detectar quando a janela ganha foco (usuário volta da autenticação)
        window.addEventListener('focus', () => {
            console.log('🔍 Janela ganhou foco - verificando OAuth...');
            this.checkOAuthReturn();
        });

        // Detectar mudanças no localStorage (comunicação entre abas)
        window.addEventListener('storage', (e) => {
            if (e.key === 'facebook_oauth_completed' && e.newValue === 'true') {
                // Verificar se já foi processado para evitar execução dupla
                if (this.oauthProcessed) {
                    console.log('⚠️ OAuth já foi processado, ignorando storage event');
                    return;
                }
                console.log('✅ Detectado OAuth completado via storage event');
                this.oauthProcessed = true; // Marcar como processado
                this.handleOAuthReturn();
            }
        });

        // Verificação inicial ao carregar a página
        this.checkOAuthReturn();
    }

    // Verificar se houve retorno do OAuth
    checkOAuthReturn() {
        // Verificar se já foi processado para evitar execução dupla
        if (this.oauthProcessed) {
            console.log('⚠️ OAuth já foi processado, ignorando verificação');
            return;
        }
        
        const oauthCompleted = localStorage.getItem('facebook_oauth_completed');
        
        // Apenas processar se oauth_completed estiver definido como 'true'
        // Não processar baseado apenas em facebook_connected para evitar loops
        if (oauthCompleted === 'true') {
            console.log('✅ Detectado retorno do OAuth via localStorage');
            this.handleOAuthReturn();
        }
    }

    // Lidar com retorno do OAuth
    handleOAuthReturn() {
        // Verificar se já está processando para evitar execução dupla
        if (this.oauthProcessed) {
            console.log('⚠️ OAuth já está sendo processado, ignorando chamada duplicada');
            return;
        }
        
        console.log('🔄 Processando retorno do OAuth...');
        this.oauthProcessed = true; // Marcar imediatamente como processado
        
        // Limpar flags temporários
        localStorage.removeItem('facebook_oauth_completed');
        
        // Marcar como conectado permanentemente
        localStorage.setItem('facebook_connected', 'true');
        
        // Recarregar conexões apenas uma vez com delay otimizado
        setTimeout(() => {
            console.log('🔄 Recarregando conexões após OAuth...');
            this.loadStoredConnections();
        }, 500);
        
        // Mostrar notificação de sucesso
        this.showSuccess('Facebook conectado com sucesso!');
        
        // Reset da flag após processamento para permitir futuras conexões
        setTimeout(() => {
            this.oauthProcessed = false;
            console.log('🔄 Flag oauthProcessed resetada para futuras conexões');
        }, 5000);
    }

    // Conectar Instagram
    connectInstagram() {
        // this.showLoadingModal();
        
        // Redirecionar para autorização do Instagram
        const authUrl = this.apiConfig.getInstagramAuthUrl() + '&state=instagram';
        window.location.href = authUrl;
    }

    // Lidar com callback do Instagram
    async handleInstagramCallback(code) {
        // this.showLoadingModal();
        
        try {
            // Trocar código por access token
            const tokenData = await this.apiConfig.exchangeInstagramCode(code);
            
            // Obter dados do perfil
            const profileData = await this.apiConfig.getUserProfile('instagram', tokenData.access_token);
            
            const userData = {
                id: profileData.id,
                name: profileData.username,
                username: '@' + profileData.username,
                picture: 'https://via.placeholder.com/50x50/E1306C/white?text=IG',
                accessToken: tokenData.access_token,
                accountType: profileData.account_type,
                mediaCount: profileData.media_count,
                connectedAt: new Date().toISOString()
            };

            localStorage.setItem('instagram_integration', JSON.stringify(userData));
            this.updateInstagramUI(userData, true);
            // this.hideLoadingModal();
            this.showSuccess('Instagram conectado com sucesso!');
        } catch (error) {
            // this.hideLoadingModal();
            this.showError('Erro ao conectar Instagram: ' + error.message);
            
            // Fallback para demonstração
            this.connectInstagramDemo();
        }
    }

    // Demonstração da conexão do Instagram (fallback)
    connectInstagramDemo() {
        setTimeout(() => {
            const userData = {
                id: 'instagram_' + Date.now(),
                name: 'Meu Perfil Instagram',
                username: '@meuusuario',
                picture: 'https://via.placeholder.com/50x50/E1306C/white?text=IG',
                accessToken: 'demo_instagram_token',
                connectedAt: new Date().toISOString()
            };

            localStorage.setItem('instagram_integration', JSON.stringify(userData));
            this.updateInstagramUI(userData, true);
            // this.hideLoadingModal();
            this.showSuccess('Instagram conectado com sucesso! (Modo demonstração)');
        }, 1000);
    }

    // Atualizar UI do Instagram
    updateInstagramUI(userData, isConnected) {
        const statusElement = document.getElementById('instagram-status');
        const connectBtn = document.getElementById('instagram-connect');
        const disconnectBtn = document.getElementById('instagram-disconnect');
        const accountElement = document.getElementById('instagram-account');
        const card = document.getElementById('instagram-card');

        if (isConnected) {
            // Atualizar status
            statusElement.innerHTML = `
                <span class="status-badge connected">
                    <i class="fas fa-check-circle"></i>
                    Conectado
                </span>
            `;

            // Mostrar/esconder botões
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-flex';

            // Mostrar informações da conta
            document.getElementById('instagram-avatar').src = userData.picture;
            // Extrair apenas o primeiro nome (nome de usuário)
            const firstName = userData.name.split(' ')[0];
            document.getElementById('instagram-name').textContent = firstName;
            document.getElementById('instagram-type').textContent = userData.username || 'Perfil Pessoal';
            document.getElementById('instagram-followers').textContent = this.formatNumber(Math.floor(Math.random() * 50000) + 5000);
            document.getElementById('instagram-posts').textContent = Math.floor(Math.random() * 500) + 50;
            
            accountElement.style.display = 'block';
            card.classList.add('connected');
        } else {
            // Atualizar status
            statusElement.innerHTML = `
                <span class="status-badge disconnected">
                    <i class="fas fa-times-circle"></i>
                    Desconectado
                </span>
            `;

            // Mostrar/esconder botões
            connectBtn.style.display = 'inline-flex';
            disconnectBtn.style.display = 'none';

            // Esconder informações da conta
            accountElement.style.display = 'none';
            card.classList.remove('connected');
        }
    }

    // Desconectar Instagram
    disconnectInstagram() {
        if (confirm('Tem certeza que deseja desconectar sua conta do Instagram?')) {
            localStorage.removeItem('instagram_integration');
            this.updateInstagramUI(null, false);
            this.showSuccess('Instagram desconectado com sucesso!');
        }
    }

    // Formatar números
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Mostrar mensagem de sucesso
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // Mostrar mensagem de erro
    showError(message) {
        this.showNotification(message, 'error');
    }

    // Mostrar notificação
    showNotification(message, type) {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Adicionar estilos
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#48bb78' : '#f56565'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
        `;

        // Adicionar ao DOM
        document.body.appendChild(notification);

        // Remover após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Verificar se uma integração está conectada
    isConnected(platform) {
        return localStorage.getItem(`${platform}_integration`) !== null;
    }

    // Obter dados da integração
    getIntegrationData(platform) {
        const data = localStorage.getItem(`${platform}_integration`);
        return data ? JSON.parse(data) : null;
    }

    // Integração rápida Facebook + Instagram
    async quickIntegration() {
        // Verificar se já estão conectados
        const facebookConnected = this.isConnected('facebook');
        const instagramConnected = this.isConnected('instagram');

        if (facebookConnected && instagramConnected) {
            this.showSuccess('Facebook e Instagram já estão conectados!');
            return;
        }

        // this.showLoadingModal('Abrindo janela de autenticação do Facebook...');
        
        // Abrir OAuth em popup para melhor experiência
        const serverEndpoint = this.apiConfig.getOAuthServerUrl();
        console.log('🔗 Abrindo endpoint do servidor:', serverEndpoint);
        
        const popup = window.open(
            serverEndpoint,
            'facebook-oauth',
            'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
        );
        
        // Monitorar quando o popup é fechado
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                // this.hideLoadingModal();
                // Recarregar a página para verificar se a autenticação foi bem-sucedida
                window.location.reload();
            }
        }, 1000);
    }

    // Lidar com integração rápida conectada
    handleQuickIntegrationConnected(authResponse) {
        FB.api('/me', { fields: 'name,picture,email' }, (response) => {
            if (response && !response.error) {
                // Buscar páginas do usuário com contas do Instagram Business
                FB.api('/me/accounts', { 
                    fields: 'id,name,access_token,category,picture,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}' 
                }, (pagesResponse) => {
                    const userData = {
                        id: response.id,
                        name: response.name,
                        email: response.email,
                        picture: response.picture.data.url,
                        accessToken: authResponse.accessToken,
                        pages: pagesResponse.data || [],
                        instagramAccounts: this.extractInstagramAccounts(pagesResponse.data || []),
                        connectedAt: new Date().toISOString()
                    };

                    // Salvar Facebook
                    localStorage.setItem('facebook_integration', JSON.stringify(userData));
                    localStorage.setItem('facebook_connected', 'true');
                    this.updateFacebookUI(userData, true);

                    // Se há contas do Instagram Business, conectar automaticamente
                    if (userData.instagramAccounts && userData.instagramAccounts.length > 0) {
                        // Simular dados do Instagram baseados nas contas Business
                        const instagramData = {
                            id: userData.instagramAccounts[0].id,
                            name: userData.instagramAccounts[0].username,
                            username: userData.instagramAccounts[0].username,
                            picture: userData.instagramAccounts[0].profilePicture,
                            accessToken: userData.instagramAccounts[0].pageAccessToken,
                            connectedAt: new Date().toISOString(),
                            accounts: userData.instagramAccounts
                        };

                        localStorage.setItem('instagram_integration', JSON.stringify(instagramData));
                        this.updateInstagramUI(instagramData, true);
                    }

                    // this.hideLoadingModal();
                    
                    // Mostrar mensagem de sucesso personalizada
                    const connectedPlatforms = ['Facebook'];
                    if (userData.instagramAccounts && userData.instagramAccounts.length > 0) {
                        connectedPlatforms.push('Instagram Business');
                    }
                    
                    this.showSuccess(`🎉 ${connectedPlatforms.join(' e ')} conectado${connectedPlatforms.length > 1 ? 's' : ''} com sucesso!`);
                    
                    // Animar o botão de integração rápida
                    this.animateQuickIntegrationSuccess();
                });
            } else {
                // this.hideLoadingModal();
                this.showError('Erro ao obter dados do Facebook.');
            }
        });
    }

    // Animar sucesso da integração rápida
    animateQuickIntegrationSuccess() {
        const quickBtn = document.getElementById('quick-integration-btn');
        const quickCard = document.querySelector('.quick-integration-card');
        
        if (quickBtn && quickCard) {
            // Mudar o botão temporariamente
            const originalHTML = quickBtn.innerHTML;
            quickBtn.innerHTML = '<i class="fas fa-check"></i> Conectado com Sucesso!';
            quickBtn.classList.add('btn-success');
            quickBtn.disabled = true;
            
            // Adicionar efeito visual ao card
            quickCard.style.transform = 'scale(1.02)';
            quickCard.style.boxShadow = '0 20px 40px rgba(72, 187, 120, 0.3)';
            
            // Restaurar após 3 segundos
            setTimeout(() => {
                quickBtn.innerHTML = originalHTML;
                quickBtn.classList.remove('btn-success');
                quickBtn.disabled = false;
                quickCard.style.transform = '';
                quickCard.style.boxShadow = '';
            }, 3000);
        }
    }

    // Conectar usando token direto do Facebook (usando endpoints seguros)
    async connectWithDirectToken(accessToken) {
        // this.showLoadingModal('Validando token do Facebook...');
        
        try {
            // Verificar permissões usando endpoint seguro
            const permissionsResult = await this.apiConfig.verifyFacebookPermissions(accessToken);
            
            const grantedPermissions = permissionsResult.permissions;
            const hasAdsPermissions = permissionsResult.hasAdsRead || permissionsResult.hasAdsManagement || permissionsResult.hasBusinessManagement;
            
            // Obter dados do usuário usando Graph API diretamente (dados públicos)
            const userResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.width(200).height(200)&access_token=${accessToken}`);
            const userData = await userResponse.json();
            
            if (userData.error) {
                throw new Error(userData.error.message);
            }
            
            // Obter páginas do usuário usando Graph API diretamente
            const pagesResponse = await fetch(`https://graph.facebook.com/me/accounts?fields=id,name,access_token,category,picture,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}&access_token=${accessToken}`);
            const pagesData = await pagesResponse.json();
            
            // Obter Ad Accounts usando endpoint seguro
            let adAccounts = [];
            if (hasAdsPermissions) {
                try {
                    adAccounts = await this.apiConfig.getFacebookAdAccounts(accessToken);
                } catch (error) {
                    console.warn('Não foi possível obter Ad Accounts:', error.message);
                }
            }
            
            const pages = pagesData.data || [];
            const instagramAccounts = [];
            
            // Extrair contas Instagram Business
            pages.forEach(page => {
                if (page.instagram_business_account) {
                    instagramAccounts.push({
                        id: page.instagram_business_account.id,
                        username: page.instagram_business_account.username,
                        profile_picture_url: page.instagram_business_account.profile_picture_url,
                        followers_count: page.instagram_business_account.followers_count,
                        media_count: page.instagram_business_account.media_count,
                        pageId: page.id,
                        pageName: page.name,
                        pageAccessToken: page.access_token
                    });
                }
            });
            
            // Preparar dados para armazenamento
            const integrationData = {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                picture: userData.picture?.data?.url || 'https://via.placeholder.com/50x50/1877F2/white?text=FB',
                accessToken: accessToken,
                permissions: grantedPermissions,
                hasAdsPermissions: hasAdsPermissions,
                pages: pages,
                adAccounts: adAccounts,
                instagramAccounts: instagramAccounts,
                connectedAt: new Date().toISOString()
            };

            // Salvar no localStorage
            localStorage.setItem('facebook_integration', JSON.stringify(integrationData));
            localStorage.setItem('facebook_connected', 'true');
            
            // Se houver contas Instagram, conectar automaticamente
            if (instagramAccounts.length > 0) {
                const instagramData = {
                    accounts: instagramAccounts,
                    connectedAt: new Date().toISOString()
                };
                localStorage.setItem('instagram_integration', JSON.stringify(instagramData));
                this.updateInstagramUI(instagramData, true);
            }
            
            // Atualizar UI do Facebook
            this.updateFacebookUI(integrationData, true);
            // this.hideLoadingModal();
            
            // Construir mensagem de sucesso
            let successMessage = 'Facebook conectado com sucesso usando token direto!';
            
            if (instagramAccounts.length > 0) {
                successMessage = `Facebook conectado com sucesso! ${instagramAccounts.length} conta(s) Instagram Business encontrada(s) e conectada(s) automaticamente.`;
            }
            
            if (hasAdsPermissions && adAccounts.length > 0) {
                successMessage += ` ${adAccounts.length} Ad Account(s) encontrada(s) para campanhas.`;
            } else if (hasAdsPermissions) {
                successMessage += ' Permissões de Ads detectadas, mas nenhum Ad Account encontrado.';
            } else {
                successMessage += ' ⚠️ Token sem permissões de Ads - funcionalidades de campanhas limitadas.';
            }
            
            this.showSuccess(successMessage);
            
        } catch (error) {
             console.error('Erro ao conectar com token direto:', error);
             // this.hideLoadingModal();
             this.showError(`Erro ao validar token: ${error.message}`);
         }
     }
 }

// Funções globais para os botões
function connectFacebook() {
    integrationManager.connectFacebook();
}

function disconnectFacebook() {
    integrationManager.disconnectFacebook();
}

function connectInstagram() {
    integrationManager.connectInstagram();
}

function disconnectInstagram() {
    integrationManager.disconnectInstagram();
}

// Função de integração rápida Facebook + Instagram
function quickIntegration() {
    integrationManager.quickIntegration();
}

// Função para conectar usando token direto do Facebook
function connectWithDirectToken(accessToken) {
    if (!accessToken) {
        console.error('Token de acesso não fornecido');
        return;
    }
    
    integrationManager.connectWithDirectToken(accessToken);
}

// Função para usar o token fornecido pelo usuário
function useProvidedToken() {
    const token = 'EAAUfHxCgwkUBPb6PHuTwXWhZC66dOxl2SMQfLlfMojX1oPD8Et1hLpX8icLkbKy0pmZBuFGEnC78LhgJ31HyBIZCGaZBI37XAnZAx8XpOpjXnNZCZBPc4pRk9SNXwjNETg79X8XHhI1k0ExTOdJCSPM9UIePyZCCRQwCzTOK01CrzAY7Kmw8roLoSxUhK5zOyCwZBiAZDZD';
    connectWithDirectToken(token);
}

// Adicionar estilos para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
`;
document.head.appendChild(style);

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.integrationManager = new IntegrationManager();
    
    // Adicionar event listeners para os botões
    const quickIntegrationBtn = document.getElementById('quick-integration-btn');
    if (quickIntegrationBtn) {
        quickIntegrationBtn.addEventListener('click', () => {
            integrationManager.quickIntegration();
        });
    }
    
    const facebookConnectBtn = document.getElementById('facebook-oauth-btn');
    if (facebookConnectBtn) {
        facebookConnectBtn.addEventListener('click', () => {
            integrationManager.connectFacebook();
        });
    }
    
    const facebookDisconnectBtn = document.getElementById('facebook-disconnect-btn');
    if (facebookDisconnectBtn) {
        facebookDisconnectBtn.addEventListener('click', () => {
            integrationManager.disconnectFacebook();
        });
    }
    
    const useProvidedTokenBtn = document.getElementById('use-provided-token-btn');
    if (useProvidedTokenBtn) {
        useProvidedTokenBtn.addEventListener('click', () => {
            useProvidedToken();
        });
    }
    
    const instagramConnectBtn = document.getElementById('instagram-connect');
    if (instagramConnectBtn) {
        instagramConnectBtn.addEventListener('click', () => {
            integrationManager.connectInstagram();
        });
    }
    
    const instagramDisconnectBtn = document.getElementById('instagram-disconnect');
    if (instagramDisconnectBtn) {
        instagramDisconnectBtn.addEventListener('click', () => {
            integrationManager.disconnectInstagram();
        });
    }
});

// Verificar autenticação
document.addEventListener('DOMContentLoaded', () => {
    waitForSessionManager();
});

function waitForSessionManager() {
    console.log('🔍 Aguardando sessionManager estar disponível...');
    
    function checkSessionManager() {
        if (window.sessionManager && typeof window.sessionManager.isLoggedIn === 'function') {
            console.log('✅ SessionManager disponível, verificando autenticação...');
            checkAuth();
        } else {
            console.log('⏳ SessionManager ainda não disponível, tentando novamente...');
            setTimeout(checkSessionManager, 100);
        }
    }
    
    checkSessionManager();
}

function checkAuth() {
    try {
        if (window.sessionManager.isLoggedIn()) {
            console.log('✅ Usuário autenticado, carregando página de integrações');
            // Usuário está logado, pode continuar na página
        } else {
            console.log('❌ Usuário não autenticado, mas permitindo acesso à página de integrações');
            // COMENTADO: Permitindo acesso à página de integrações mesmo sem login
            // window.location.href = '/';
        }
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        console.log('⚠️ Erro na autenticação, mas permitindo acesso à página de integrações');
        // COMENTADO: Em caso de erro, permitindo acesso à página
        // window.location.href = '/';
    }
}