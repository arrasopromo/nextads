/**
 * Componente de Botão de Usuário Único
 * Gerencia a exibição do botão "Entrar" e do nome do usuário
 */
class UserButtonComponent {
    constructor() {
        this.isInitialized = false;
        this.currentPage = this.getCurrentPage();
    }

    /**
     * Detecta a página atual
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename.replace('.html', '');
    }

    /**
     * Verifica se deve mostrar o botão "Entrar" na página atual
     */
    shouldShowLoginButton() {
        const pagesWithoutLogin = ['minhas-campanhas', 'sobre'];
        return !pagesWithoutLogin.includes(this.currentPage);
    }

    /**
     * Inicializa o componente de botão de usuário
     */
    init() {
        if (this.isInitialized) return;
        
        this.createUserButtons();
        this.setupEventListeners();
        this.isInitialized = true;
        
        // Verificar estado inicial
        this.updateButtonState();
    }

    /**
     * Cria os botões de usuário no DOM
     */
    createUserButtons() {
        // Verificar se já existem containers
        let desktopContainer = document.getElementById('user-menu-container');
        let mobileContainer = document.getElementById('user-menu-container-mobile');

        // Se não existirem, criar
        if (!desktopContainer) {
            desktopContainer = this.createDesktopContainer();
            document.body.appendChild(desktopContainer);
        }

        if (!mobileContainer) {
            mobileContainer = this.createMobileContainer();
            document.body.appendChild(mobileContainer);
        }

        // Limpar conteúdo existente e recriar
        desktopContainer.innerHTML = this.getDesktopButtonHTML();
        mobileContainer.innerHTML = this.getMobileButtonHTML();
    }

    /**
     * Cria o container desktop
     */
    createDesktopContainer() {
        const container = document.createElement('div');
        container.className = 'user-menu-container';
        container.id = 'user-menu-container';
        return container;
    }

    /**
     * Cria o container mobile
     */
    createMobileContainer() {
        const container = document.createElement('div');
        container.className = 'user-menu-container-mobile';
        container.id = 'user-menu-container-mobile';
        return container;
    }

    /**
     * HTML para botões desktop
     */
    getDesktopButtonHTML() {
        const showLoginButton = this.shouldShowLoginButton();
        
        return `
            ${showLoginButton ? `
            <button class="login-btn-desktop" id="loginBtnDesktop">
                <i class="fas fa-user"></i>
                <span>Entrar</span>
            </button>
            ` : ''}
            <button class="user-btn-desktop" id="userBtnDesktop" style="display: none;">
                <i class="fas fa-user-circle"></i>
                <span id="userNameBtnDesktop">Usuário</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="user-dropdown" id="userDropdownDesktop" style="display: none;">
                <a href="#" id="minha-conta-link" data-action="account">
                    <i class="fas fa-user-cog"></i>
                    Minha conta
                </a>
                <a href="#" id="logout-link" data-action="logout">
                    <i class="fas fa-sign-out-alt"></i>
                    Deslogar
                </a>
            </div>
        `;
    }

    /**
     * HTML para botões mobile
     */
    getMobileButtonHTML() {
        const showLoginButton = this.shouldShowLoginButton();
        
        return `
            ${showLoginButton ? `
            <button class="login-btn-mobile" id="loginBtnMobile">
                <i class="fas fa-user"></i>
                <span>Entrar</span>
            </button>
            ` : ''}
            <button class="user-btn-mobile" id="userBtnMobile" style="display: none;">
                <i class="fas fa-user-circle"></i>
                <span id="userNameBtnMobile">Usuário</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="user-dropdown-mobile" id="userDropdownMobile" style="display: none;">
                <a href="#" id="minha-conta-link-mobile" data-action="account">
                    <i class="fas fa-user-cog"></i>
                    Minha conta
                </a>
                <a href="#" id="logout-link-mobile" data-action="logout">
                    <i class="fas fa-sign-out-alt"></i>
                    Deslogar
                </a>
            </div>
        `;
    }

    /**
     * Configura os event listeners
     */
    setupEventListeners() {
        // Escutar mudanças de autenticação
        window.addEventListener('nextadsAuthChanged', () => {
            this.updateButtonState();
        });

        window.addEventListener('nextadsLogin', () => {
            this.updateButtonState();
        });

        window.addEventListener('nextadsLogout', () => {
            this.updateButtonState();
        });

        // Event listeners para os botões (delegados para o LoginComponent)
        document.addEventListener('click', (e) => {
            if (e.target.closest('#loginBtnDesktop') || e.target.closest('#loginBtnMobile')) {
                if (window.loginComponent && window.loginComponent.openLoginModal) {
                    window.loginComponent.openLoginModal();
                }
            }
        });
    }

    /**
     * Atualiza o estado dos botões baseado na autenticação
     */
    updateButtonState() {
        const sessionManager = window.sessionManager;
        if (!sessionManager) return;

        const isLoggedIn = sessionManager.isLoggedIn();
        const user = sessionManager.getUserData();
        const showLoginButton = this.shouldShowLoginButton();

        const loginBtnDesktop = document.getElementById('loginBtnDesktop');
        const userBtnDesktop = document.getElementById('userBtnDesktop');
        const userNameDesktop = document.getElementById('userNameBtnDesktop');
        
        const loginBtnMobile = document.getElementById('loginBtnMobile');
        const userBtnMobile = document.getElementById('userBtnMobile');
        const userNameMobile = document.getElementById('userNameBtnMobile');

        if (isLoggedIn && user) {
            // Mostrar botões de usuário
            if (loginBtnDesktop) loginBtnDesktop.style.display = 'none';
            if (userBtnDesktop) userBtnDesktop.style.display = 'flex';
            if (userNameDesktop) userNameDesktop.textContent = user.firstName || user.username || 'Usuário';

            if (loginBtnMobile) loginBtnMobile.style.display = 'none';
            if (userBtnMobile) userBtnMobile.style.display = 'flex';
            if (userNameMobile) userNameMobile.textContent = user.firstName || user.username || 'Usuário';
        } else {
            // Mostrar botões de login apenas se permitido na página atual
            if (showLoginButton) {
                if (loginBtnDesktop) loginBtnDesktop.style.display = 'flex';
                if (loginBtnMobile) loginBtnMobile.style.display = 'flex';
            }
            if (userBtnDesktop) userBtnDesktop.style.display = 'none';
            if (userBtnMobile) userBtnMobile.style.display = 'none';
        }
    }
}

// Criar instância global
window.userButtonComponent = new UserButtonComponent();

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.userButtonComponent.init();
    });
} else {
    window.userButtonComponent.init();
}