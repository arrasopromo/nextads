/**
 * Sistema de Sincronização de Autenticação Global
 * Garante que o estado de login seja consistente em todas as páginas
 */

class AuthSync {
    constructor() {
        this.sessionManager = null;
        this.isInitialized = false;
    }

    /**
     * Inicializa o sistema de sincronização de autenticação
     */
    async init() {
        if (this.isInitialized) return;
        
        console.log('🔄 Inicializando AuthSync...');
        
        // Verificar se está na página de integrações
        const isIntegrationsPage = window.location.pathname.includes('integracoes.html');
        
        // Aguardar o SessionManager estar disponível
        await this.waitForSessionManager();
        
        // Configurar listeners para mudanças no localStorage
        this.setupStorageListener();
        
        // Verificar estado inicial apenas se não for a página de integrações
        if (!isIntegrationsPage) {
            await this.checkAuthState();
        } else {
            console.log('🔧 Página de integrações detectada - pulando verificação automática de autenticação');
        }
        
        this.isInitialized = true;
        console.log('✅ AuthSync inicializado com sucesso');
    }

    /**
     * Aguarda o SessionManager estar disponível
     */
    async waitForSessionManager() {
        return new Promise((resolve) => {
            const checkSessionManager = () => {
                if (typeof window.sessionManager !== 'undefined' && window.sessionManager) {
                    this.sessionManager = window.sessionManager;
                    console.log('📦 SessionManager encontrado');
                    resolve();
                } else {
                    console.log('⏳ Aguardando SessionManager...');
                    setTimeout(checkSessionManager, 100);
                }
            };
            checkSessionManager();
        });
    }

    /**
     * Configura listener para mudanças no localStorage
     */
    setupStorageListener() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'userData') {
                console.log('🔄 Mudança detectada no userData, atualizando interface...');
                this.checkAuthState();
            }
        });

        // Listener para mudanças na mesma aba
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            const event = new Event('localStorageChange');
            event.key = key;
            event.newValue = value;
            window.dispatchEvent(event);
            originalSetItem.apply(this, arguments);
        };

        window.addEventListener('localStorageChange', (e) => {
            if (e.key === 'userData') {
                console.log('🔄 Mudança local detectada no userData, atualizando interface...');
                setTimeout(() => this.checkAuthState(), 100);
            }
        });
    }

    /**
     * Verifica o estado atual de autenticação e atualiza a interface
     */
    async checkAuthState() {
        try {
            if (!this.sessionManager) {
                console.log('❌ SessionManager não disponível');
                return;
            }

            const isValid = await this.sessionManager.validateSession();
            console.log('🔍 Estado de autenticação:', isValid);

            if (isValid) {
                const userData = this.sessionManager.getUserData();
                if (userData) {
                    console.log('👤 Usuário logado:', userData);
                    this.updateUserInterface(userData);
                } else {
                    console.log('❌ Dados do usuário não encontrados');
                    this.updateUserInterface(null);
                }
            } else {
                console.log('❌ Sessão inválida');
                this.updateUserInterface(null);
            }
        } catch (error) {
            console.error('❌ Erro ao verificar estado de autenticação:', error);
            this.updateUserInterface(null);
        }
    }

    /**
     * Atualiza a interface do usuário baseada no estado de autenticação
     */
    updateUserInterface(userData) {
        console.log('🎨 Atualizando interface do usuário via AuthSync:', userData);

        // Usar o LoginComponent se estiver disponível
        if (window.loginComponent && window.loginComponent.sessionManager) {
            console.log('🔄 Delegando atualização para LoginComponent');
            window.loginComponent.updateUI(userData);
            
            // Dispara evento de sincronização se necessário
            if (userData && userData !== window.loginComponent.currentUser) {
                window.loginComponent.triggerLoginEvent(userData);
            } else if (!userData && window.loginComponent.currentUser) {
                window.loginComponent.triggerLogoutEvent();
            }
            return;
        }

        // Fallback para o sistema antigo (compatibilidade)
        console.log('⚠️ LoginComponent não disponível, usando sistema legado');
        
        // Elementos de login desktop
        const loginBtnDesktop = document.getElementById('loginBtnDesktop');
        const userBtnDesktop = document.getElementById('userBtnDesktop');
        const userDropdownDesktop = document.getElementById('userDropdownDesktop');
        const userNameBtnDesktop = document.getElementById('userNameBtnDesktop');

        // Elementos de login mobile
        const loginBtnMobile = document.getElementById('loginBtnMobile');
        const userBtnMobile = document.getElementById('userBtnMobile');
        const userDropdownMobile = document.getElementById('userDropdownMobile');
        const userNameBtnMobile = document.getElementById('userNameBtnMobile');

        // Elementos principais (para compatibilidade com páginas que usam o sistema antigo)
        const mainLoginBtn = document.getElementById('loginBtn');
        const mainUserDropdown = document.getElementById('userDropdown');
        const mainUserName = document.getElementById('userName');

        if (userData && userData.firstName) {
            // Usuário logado - mostrar botão com nome do usuário
            const firstName = userData.firstName;

            // Desktop
            if (loginBtnDesktop) loginBtnDesktop.style.display = 'none';
            if (userBtnDesktop) {
                userBtnDesktop.style.display = 'flex';
                if (userNameBtnDesktop) userNameBtnDesktop.textContent = firstName;
            }
            if (userDropdownDesktop) {
                userDropdownDesktop.style.display = 'none'; // Inicialmente minimizado
            }

            // Mobile
            if (loginBtnMobile) loginBtnMobile.style.display = 'none';
            if (userBtnMobile) {
                userBtnMobile.style.display = 'flex';
                if (userNameBtnMobile) userNameBtnMobile.textContent = firstName;
            }
            if (userDropdownMobile) {
                userDropdownMobile.style.display = 'none'; // Inicialmente minimizado
            }

            // Elementos principais (compatibilidade)
            if (mainLoginBtn) mainLoginBtn.style.display = 'none';
            if (mainUserDropdown) {
                mainUserDropdown.style.display = 'none'; // Inicialmente minimizado
                if (mainUserName) mainUserName.textContent = firstName;
            }

            console.log('✅ Interface atualizada para usuário logado:', firstName);
        } else {
            // Usuário não logado - mostrar botões de login
            console.log('🚪 Mostrando botões de login');

            // Desktop
            if (loginBtnDesktop) loginBtnDesktop.style.display = 'flex';
            if (userBtnDesktop) userBtnDesktop.style.display = 'none';
            if (userDropdownDesktop) userDropdownDesktop.style.display = 'none';

            // Mobile
            if (loginBtnMobile) loginBtnMobile.style.display = 'flex';
            if (userBtnMobile) userBtnMobile.style.display = 'none';
            if (userDropdownMobile) userDropdownMobile.style.display = 'none';

            // Elementos principais (compatibilidade)
            if (mainLoginBtn) mainLoginBtn.style.display = 'flex';
            if (mainUserDropdown) mainUserDropdown.style.display = 'none';

            console.log('✅ Interface atualizada para usuário não logado');
        }

        // Configurar event listeners se ainda não foram configurados
        this.setupEventListeners();
    }

    /**
     * Configura event listeners para os elementos de interface
     */
    setupEventListeners() {
        // Evitar configurar múltiplas vezes
        if (this.listenersConfigured) return;

        // REMOVIDO: Event listeners dos botões de login foram movidos para LoginComponent
        // para evitar conflitos e duplicação

        // Links de logout
        const logoutLinks = document.querySelectorAll('[data-action="logout"]');
        logoutLinks.forEach(link => {
            if (!link.hasAttribute('data-listener')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
                link.setAttribute('data-listener', 'true');
            }
        });

        // Links "Minha Conta"
        const accountLinks = document.querySelectorAll('[data-action="account"]');
        accountLinks.forEach(link => {
            if (!link.hasAttribute('data-listener')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.goToAccount();
                });
                link.setAttribute('data-listener', 'true');
            }
        });

        this.listenersConfigured = true;
    }

    /**
     * Abre o modal de login
     */
    openLoginModal() {
        console.log('🔓 Abrindo modal de login...');
        if (typeof openLoginModal === 'function') {
            openLoginModal();
        } else {
            console.log('❌ Função openLoginModal não encontrada');
        }
    }

    /**
     * Realiza logout do usuário
     */
    async logout() {
        console.log('🚪 Realizando logout...');
        try {
            if (this.sessionManager) {
                await this.sessionManager.logout();
            } else {
                // Fallback para limpeza manual
                localStorage.removeItem('userData');
                localStorage.removeItem('authToken');
                localStorage.removeItem('userName');
            }
            
            // Atualizar interface
            this.updateUserInterface(null);
            
            // Recarregar página se necessário
            if (window.location.pathname.includes('minhas-campanhas.html')) {
                window.location.reload();
            }
            
            console.log('✅ Logout realizado com sucesso');
        } catch (error) {
            console.error('❌ Erro durante logout:', error);
        }
    }

    /**
     * Navega para a página da conta
     */
    goToAccount() {
        console.log('👤 Navegando para página da conta...');
        window.location.href = './minha-conta.html';
    }
}

// Criar instância global
const authSync = new AuthSync();

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => authSync.init());
} else {
    authSync.init();
}

// Exportar para uso global
window.authSync = authSync;