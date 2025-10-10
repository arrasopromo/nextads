/**
 * Componente de Login Reutilizável
 * Sistema unificado de autenticação para todas as páginas
 */

class LoginComponent {
    constructor() {
        this.sessionManager = null;
        this.isInitialized = false;
        this.currentUser = null;
    }

    /**
     * Inicializa o componente de login
     */
    async init() {
        if (this.isInitialized) return;
        
        console.log('🔐 Inicializando LoginComponent...');
        
        // Aguardar o SessionManager estar disponível
        await this.waitForSessionManager();
        
        // Verificar estado inicial de autenticação
        await this.checkAuthState();
        
        // Configurar listeners para mudanças no localStorage
        this.setupStorageListener();
        
        // Configurar event listeners dos botões
        this.setupEventListeners();
        
        // Melhorar inputs de senha com botão de visibilidade
        this.enhancePasswordFields();

        this.isInitialized = true;
        console.log('✅ LoginComponent inicializado com sucesso');
    }

    /**
     * Aguarda o SessionManager estar disponível
     */
    async waitForSessionManager() {
        return new Promise((resolve) => {
            const checkSessionManager = () => {
                if (typeof window.sessionManager !== 'undefined' && window.sessionManager) {
                    this.sessionManager = window.sessionManager;
                    console.log('📦 SessionManager encontrado no LoginComponent');
                    resolve();
                } else {
                    console.log('⏳ LoginComponent aguardando SessionManager...');
                    setTimeout(checkSessionManager, 100);
                }
            };
            checkSessionManager();
        });
    }

    /**
     * Verifica o estado atual de autenticação
     */
    async checkAuthState() {
        try {
            if (this.sessionManager && this.sessionManager.isLoggedIn()) {
                const userData = this.sessionManager.getUserData();
                console.log('👤 Usuário logado encontrado:', userData);
                this.currentUser = userData;
                this.updateUI(userData);
            } else {
                console.log('🚫 Nenhum usuário logado');
                this.currentUser = null;
                this.updateUI(null);
            }
        } catch (error) {
            console.error('❌ Erro ao verificar estado de autenticação:', error);
            this.currentUser = null;
            this.updateUI(null);
        }
    }

    /**
     * Configura listener para mudanças no localStorage
     */
    setupStorageListener() {
        // Listener para mudanças entre abas
        window.addEventListener('storage', (e) => {
            if (e.key === 'nextads_user_data' || e.key === 'nextads_session_token') {
                console.log('🔄 Mudança detectada no localStorage (entre abas), atualizando UI...');
                setTimeout(() => this.checkAuthState(), 100);
            }
        });

        // Listener para mudanças na mesma aba
        const originalSetItem = localStorage.setItem;
        const originalRemoveItem = localStorage.removeItem;
        const originalClear = localStorage.clear;
        
        localStorage.setItem = function(key, value) {
            originalSetItem.apply(this, arguments);
            if (key === 'nextads_user_data' || key === 'nextads_session_token') {
                window.dispatchEvent(new CustomEvent('nextadsAuthChanged', {
                    detail: { action: 'set', key, value }
                }));
            }
        };

        localStorage.removeItem = function(key) {
            originalRemoveItem.apply(this, arguments);
            if (key === 'nextads_user_data' || key === 'nextads_session_token') {
                window.dispatchEvent(new CustomEvent('nextadsAuthChanged', {
                    detail: { action: 'remove', key }
                }));
            }
        };

        localStorage.clear = function() {
            originalClear.apply(this, arguments);
            window.dispatchEvent(new CustomEvent('nextadsAuthChanged', {
                detail: { action: 'clear' }
            }));
        };

        // Listener para eventos customizados de autenticação
        window.addEventListener('nextadsAuthChanged', (e) => {
            console.log('🔄 Mudança de autenticação detectada:', e.detail);
            setTimeout(() => this.checkAuthState(), 100);
        });

        // Listener para eventos de login/logout diretos
        window.addEventListener('nextadsLogin', (e) => {
            console.log('🔐 Evento de login detectado:', e.detail);
            this.currentUser = e.detail.userData;
            this.updateUI(e.detail.userData);
            
            // Fechar modal de login automaticamente após login bem-sucedido
            console.log('🔒 Fechando modal automaticamente após login bem-sucedido');
            this.closeLoginModal();
        });

        window.addEventListener('nextadsLogout', (e) => {
            console.log('🚪 Evento de logout detectado');
            this.currentUser = null;
            this.updateUI(null);
        });
    }

    /**
     * Atualiza a interface do usuário baseado no estado de login
     */
    updateUI(userData) {
        console.log('🔄 Atualizando UI do login...');
        
        // Verificar se o sessionManager está disponível
        if (!this.sessionManager) {
            console.log('⚠️ SessionManager não disponível ainda, aguardando...');
            return;
        }
        
        const user = this.sessionManager.getUserData();
        
        if (user) {
            console.log('👤 Usuário logado detectado:', user.username);
            this.showLoggedInState(user);
        } else {
            console.log('🚪 Nenhum usuário logado, mostrando botões de login');
            this.showLoggedOutState();
        }
    }

    /**
     * Encontra todos os elementos de login na página
     */
    findLoginElements() {
        return {
            // Desktop elements
            loginBtnDesktop: document.getElementById('loginBtnDesktop') || document.getElementById('login-btn-desktop'),
            userDropdownDesktop: document.getElementById('userDropdownDesktop') || document.getElementById('user-dropdown'),
            userNameDesktop: document.getElementById('userNameDesktop') || document.getElementById('user-name-desktop'),
            
            // Mobile elements
            loginBtnMobile: document.getElementById('loginBtnMobile') || document.getElementById('login-btn-mobile'),
            userDropdownMobile: document.getElementById('userDropdownMobile') || document.getElementById('user-dropdown-mobile'),
            userNameMobile: document.getElementById('userNameMobile') || document.getElementById('user-name-mobile'),
            
            // Fallback elements (compatibilidade)
            mainLoginBtn: document.getElementById('loginBtn'),
            mainUserDropdown: document.getElementById('userDropdown'),
            mainUserName: document.getElementById('userName')
        };
    }

    /**
     * Mostra o estado logado (usuário autenticado)
     */
    showLoggedInState(user) {
        console.log('🔑 Executando showLoggedInState para usuário:', user.username);
        
        // Ocultar botões de login (desktop e mobile)
        const loginBtnsDesktop = document.querySelectorAll('#loginBtnDesktop');
        const loginBtnsMobile = document.querySelectorAll('#loginBtnMobile');
        
        console.log('🖥️ Botões de login desktop encontrados:', loginBtnsDesktop.length);
        console.log('📱 Botões de login mobile encontrados:', loginBtnsMobile.length);
        
        loginBtnsDesktop.forEach(btn => {
            if (btn) {
                btn.style.display = 'none';
                console.log('✅ Ocultando botão de login desktop');
            }
        });
        
        loginBtnsMobile.forEach(btn => {
            if (btn) {
                btn.style.display = 'none';
                console.log('✅ Ocultando botão de login mobile');
            }
        });

        // Mostrar botões de usuário (desktop e mobile)
        const userBtnsDesktop = document.querySelectorAll('#userBtnDesktop');
        const userBtnsMobile = document.querySelectorAll('#userBtnMobile');
        
        console.log('🖥️ Botões de usuário desktop encontrados:', userBtnsDesktop.length);
        console.log('📱 Botões de usuário mobile encontrados:', userBtnsMobile.length);
        
        userBtnsDesktop.forEach(btn => {
            if (btn) {
                btn.style.display = 'flex';
                console.log('✅ Mostrando botão de usuário desktop');
            }
        });
        
        userBtnsMobile.forEach(btn => {
            if (btn) {
                btn.style.display = 'flex';
                console.log('✅ Mostrando botão de usuário mobile');
            }
        });

        // Atualizar nomes de usuário (desktop e mobile)
        const userNameBtnsDesktop = document.querySelectorAll('#userNameBtnDesktop');
        const userNameBtnsMobile = document.querySelectorAll('#userNameBtnMobile');
        
        console.log('🖥️ Elementos de nome desktop encontrados:', userNameBtnsDesktop.length);
        console.log('📱 Elementos de nome mobile encontrados:', userNameBtnsMobile.length);
        
        userNameBtnsDesktop.forEach(nameElement => {
            if (nameElement) {
                nameElement.textContent = user.firstName || user.username;
                console.log('✅ Nome de usuário desktop atualizado para:', user.firstName || user.username);
            }
        });
        
        userNameBtnsMobile.forEach(nameElement => {
            if (nameElement) {
                nameElement.textContent = user.firstName || user.username;
                console.log('✅ Nome de usuário mobile atualizado para:', user.firstName || user.username);
            }
        });

        // Ocultar dropdowns inicialmente
        const userDropdownsDesktop = document.querySelectorAll('#userDropdownDesktop');
        const userDropdownsMobile = document.querySelectorAll('#userDropdownMobile');
        
        userDropdownsDesktop.forEach(dropdown => {
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
        
        userDropdownsMobile.forEach(dropdown => {
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });

        // Ocultar seções de login quando usuário estiver logado
        const loginSections = document.querySelectorAll('#login-section');
        console.log('🔒 Seções de login encontradas:', loginSections.length);
        
        loginSections.forEach(section => {
            if (section) {
                section.style.display = 'none';
                console.log('✅ Ocultando seção de login');
            }
        });
        
        console.log('✅ Estado logado configurado com sucesso');
    }

    /**
     * Mostra o estado deslogado (usuário não autenticado)
     */
    showLoggedOutState() {
        console.log('🚪 Executando showLoggedOutState');
        
        // Mostrar botões de login (desktop e mobile)
        const loginBtnsDesktop = document.querySelectorAll('#loginBtnDesktop');
        const loginBtnsMobile = document.querySelectorAll('#loginBtnMobile');
        
        console.log('🖥️ Botões de login desktop encontrados:', loginBtnsDesktop.length);
        console.log('📱 Botões de login mobile encontrados:', loginBtnsMobile.length);
        
        loginBtnsDesktop.forEach(btn => {
            if (btn) {
                btn.style.display = 'flex';
                console.log('✅ Mostrando botão de login desktop');
            }
        });
        
        loginBtnsMobile.forEach(btn => {
            if (btn) {
                btn.style.display = 'flex';
                console.log('✅ Mostrando botão de login mobile');
            }
        });

        // Ocultar botões de usuário (desktop e mobile)
        const userBtnsDesktop = document.querySelectorAll('#userBtnDesktop');
        const userBtnsMobile = document.querySelectorAll('#userBtnMobile');
        
        console.log('🖥️ Botões de usuário desktop encontrados:', userBtnsDesktop.length);
        console.log('📱 Botões de usuário mobile encontrados:', userBtnsMobile.length);
        
        userBtnsDesktop.forEach(btn => {
            if (btn) {
                btn.style.display = 'none';
                console.log('✅ Ocultando botão de usuário desktop');
            }
        });
        
        userBtnsMobile.forEach(btn => {
            if (btn) {
                btn.style.display = 'none';
                console.log('✅ Ocultando botão de usuário mobile');
            }
        });

        // Ocultar dropdowns de usuário (desktop e mobile)
        const userDropdownsDesktop = document.querySelectorAll('#userDropdownDesktop');
        const userDropdownsMobile = document.querySelectorAll('#userDropdownMobile');
        
        userDropdownsDesktop.forEach(dropdown => {
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
        
        userDropdownsMobile.forEach(dropdown => {
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });

        // Mostrar seções de login quando usuário não estiver logado
        const loginSections = document.querySelectorAll('#login-section');
        console.log('🔓 Seções de login encontradas:', loginSections.length);
        
        loginSections.forEach(section => {
            if (section) {
                section.style.display = 'block';
                console.log('✅ Mostrando seção de login');
            }
        });
        
        console.log('✅ Estado deslogado configurado com sucesso');
    }

    /**
     * Configura event listeners para os botões
     */
    setupEventListeners() {
        // Evitar configurar múltiplas vezes
        if (this.listenersConfigured) return;

        const elements = this.findLoginElements();

        // Botões de login
        [elements.loginBtnDesktop, elements.loginBtnMobile, elements.mainLoginBtn].forEach(btn => {
            if (btn && !btn.hasAttribute('data-login-listener')) {
                btn.addEventListener('click', () => this.openLoginModal());
                btn.setAttribute('data-login-listener', 'true');
            }
        });

        // Botões de usuário (toggle dropdown)
        const userBtnsDesktop = document.querySelectorAll('#userBtnDesktop');
        const userBtnsMobile = document.querySelectorAll('#userBtnMobile');
        
        userBtnsDesktop.forEach(userBtnDesktop => {
            if (userBtnDesktop && !userBtnDesktop.hasAttribute('data-user-listener')) {
                userBtnDesktop.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleDropdown('userDropdownDesktop', 'userBtnDesktop');
                });
                userBtnDesktop.setAttribute('data-user-listener', 'true');
            }
        });

        userBtnsMobile.forEach(userBtnMobile => {
            if (userBtnMobile && !userBtnMobile.hasAttribute('data-user-listener')) {
                userBtnMobile.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleDropdown('userDropdownMobile', 'userBtnMobile');
                });
                userBtnMobile.setAttribute('data-user-listener', 'true');
            }
        });

        // Fechar dropdowns ao clicar fora
        document.addEventListener('click', (e) => {
            const dropdowns = ['userDropdownDesktop', 'userDropdownMobile'];
            dropdowns.forEach(dropdownId => {
                const dropdown = document.getElementById(dropdownId);
                const userBtn = document.getElementById(dropdownId.replace('Dropdown', 'Btn'));
                
                if (dropdown && dropdown.style.display === 'block') {
                    if (!dropdown.contains(e.target) && !userBtn.contains(e.target)) {
                        this.closeDropdown(dropdownId, dropdownId.replace('Dropdown', 'Btn'));
                    }
                }
            });
        });

        // Links de logout
        const logoutLinks = document.querySelectorAll('[data-action="logout"], #logout-link, #logout-link-mobile');
        logoutLinks.forEach(link => {
            if (!link.hasAttribute('data-logout-listener')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
                link.setAttribute('data-logout-listener', 'true');
            }
        });

        // Links de minha conta
        const accountLinks = document.querySelectorAll('[data-action="account"], #minha-conta-link, #minha-conta-link-mobile');
        accountLinks.forEach(link => {
            if (!link.hasAttribute('data-account-listener')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.goToAccount();
                });
                link.setAttribute('data-account-listener', 'true');
            }
        });

        // Event listeners para fechar o modal de login
        const closeLoginModalBtns = document.querySelectorAll('#close-login-modal, .close-login-modal');
        closeLoginModalBtns.forEach(btn => {
            if (btn && !btn.hasAttribute('data-close-modal-listener')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeLoginModal();
                });
                btn.setAttribute('data-close-modal-listener', 'true');
            }
        });

        // Fechar modal ao clicar no overlay (fora do modal)
        const loginModalOverlays = document.querySelectorAll('#login-modal-overlay, .login-modal-overlay');
        loginModalOverlays.forEach(overlay => {
            if (overlay && !overlay.hasAttribute('data-overlay-listener')) {
                overlay.addEventListener('click', (e) => {
                    // Só fechar se clicou no overlay, não no conteúdo do modal
                    if (e.target === overlay) {
                        this.closeLoginModal();
                    }
                });
                overlay.setAttribute('data-overlay-listener', 'true');
            }
        });

        // Fechar modal com tecla ESC
        if (!document.documentElement.hasAttribute('data-esc-listener')) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const loginModalOverlay = document.getElementById('login-modal-overlay');
                    if (loginModalOverlay && (loginModalOverlay.style.display === 'flex' || loginModalOverlay.classList.contains('active'))) {
                        this.closeLoginModal();
                    }
                }
            });
            document.documentElement.setAttribute('data-esc-listener', 'true');
        }

        this.listenersConfigured = true;
        console.log('🎯 Event listeners configurados');
    }

    /**
     * Dispara evento de login para sincronização
     */
    triggerLoginEvent(userData) {
        window.dispatchEvent(new CustomEvent('nextadsLogin', {
            detail: { userData }
        }));
    }

    /**
     * Dispara evento de logout para sincronização
     */
    triggerLogoutEvent() {
        window.dispatchEvent(new CustomEvent('nextadsLogout'));
    }

    /**
     * Abre o modal de login
     */
    openLoginModal() {
        console.log('🔓 Abrindo modal de login');
        
        // Procurar pelo modal de login
        const loginModalOverlay = document.getElementById('login-modal-overlay');
        const loginModal = document.getElementById('login-modal');
        
        if (loginModalOverlay) {
            loginModalOverlay.style.display = 'flex';
            loginModalOverlay.classList.add('active');
            console.log('✅ Modal de login aberto com sucesso');
            // Garantir que os campos de senha estejam com toggle
            this.enhancePasswordFields();
        } else if (loginModal) {
            loginModal.style.display = 'flex';
            console.log('✅ Modal de login aberto (fallback)');
            this.enhancePasswordFields();
        } else {
            console.warn('⚠️ Modal de login não encontrado');
            // Modal não encontrado - não redirecionar
        }
    }

    /**
     * Fecha o modal de login
     */
    closeLoginModal() {
        console.log('🔒 Fechando modal de login');
        
        const loginModalOverlay = document.getElementById('login-modal-overlay');
        const loginModal = document.getElementById('login-modal');
        
        if (loginModalOverlay) {
            loginModalOverlay.style.display = 'none';
            loginModalOverlay.classList.remove('active');
            console.log('✅ Modal de login fechado com sucesso');
        } else if (loginModal) {
            loginModal.style.display = 'none';
            console.log('✅ Modal de login fechado (fallback)');
        }
    }

    /**
     * Adiciona ícone de olho para revelar/ocultar senha nos campos de login
     */
    enhancePasswordFields() {
        try {
            const passwordInputs = document.querySelectorAll('#login-password');
            passwordInputs.forEach(input => {
                if (input.hasAttribute('data-eye-enhanced')) return;

                // Criar wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'password-wrapper';
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);

                // Criar botão de toggle
                const toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'toggle-password';
                toggleBtn.setAttribute('aria-label', 'Mostrar/ocultar senha');
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i><i class="fas fa-eye-slash"></i>';
                wrapper.appendChild(toggleBtn);

                // Listener de toggle
                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isVisible = input.type === 'text';
                    if (isVisible) {
                        input.type = 'password';
                        wrapper.classList.remove('password-visible');
                    } else {
                        input.type = 'text';
                        wrapper.classList.add('password-visible');
                    }
                });

                // Marcar como aprimorado
                input.setAttribute('data-eye-enhanced', 'true');
            });
        } catch (err) {
            console.warn('⚠️ Falha ao aprimorar campos de senha:', err);
        }
    }

    /**
     * Realiza logout
     */
    async logout() {
        console.log('🚪 Realizando logout');
        
        try {
            // Dispara evento de logout antes de remover dados
            this.triggerLogoutEvent();
            
            if (this.sessionManager) {
                await this.sessionManager.logout();
            }
            
            this.currentUser = null;
            this.updateUI(null);
            
            // Redirecionar para página inicial
            window.location.href = 'index.html';
        } catch (error) {
            console.error('❌ Erro ao fazer logout:', error);
        }
    }

    /**
     * Vai para página de conta
     */
    goToAccount() {
        console.log('👤 Navegando para minha conta');
        window.location.href = 'minha-conta.html';
    }

    /**
     * Toggle do dropdown do usuário
     */
    toggleDropdown(dropdownId, buttonId) {
        const dropdown = document.getElementById(dropdownId);
        const button = document.getElementById(buttonId);
        const chevron = button ? button.querySelector('.chevron-icon') : null;
        
        if (!dropdown) return;

        const isVisible = dropdown.style.display === 'block';
        
        if (isVisible) {
            this.closeDropdown(dropdownId, buttonId);
        } else {
            this.openDropdown(dropdownId, buttonId);
        }
    }

    /**
     * Abre o dropdown do usuário
     */
    openDropdown(dropdownId, buttonId) {
        const dropdown = document.getElementById(dropdownId);
        const button = document.getElementById(buttonId);
        const chevron = button ? button.querySelector('.chevron-icon') : null;
        
        if (dropdown) {
            dropdown.style.display = 'block';
            console.log(`📋 Dropdown ${dropdownId} aberto`);
        }
        
        if (chevron) {
            chevron.classList.add('rotated');
        }
    }

    /**
     * Fecha o dropdown do usuário
     */
    closeDropdown(dropdownId, buttonId) {
        const dropdown = document.getElementById(dropdownId);
        const button = document.getElementById(buttonId);
        const chevron = button ? button.querySelector('.chevron-icon') : null;
        
        if (dropdown) {
            dropdown.style.display = 'none';
            console.log(`📋 Dropdown ${dropdownId} fechado`);
        }
        
        if (chevron) {
            chevron.classList.remove('rotated');
        }
    }

    /**
     * Força atualização da UI
     */
    forceUpdate() {
        this.checkAuthState();
    }
}

// Criar instância global
const loginComponent = new LoginComponent();

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loginComponent.init());
} else {
    loginComponent.init();
}

// Exportar para uso global
window.loginComponent = loginComponent;

// Expor funções principais globalmente para compatibilidade
window.openLoginModal = () => loginComponent.openLoginModal();
window.closeLoginModal = () => loginComponent.closeLoginModal();