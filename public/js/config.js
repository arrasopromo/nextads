/**
 * Configuração de Ambiente para NextAds
 * Detecta automaticamente se está em desenvolvimento ou produção
 */

class AppConfig {
    constructor() {
        this.environment = this.detectEnvironment();
        this.apiBaseUrl = this.getApiBaseUrl();
        
        console.log(`🌍 Ambiente detectado: ${this.environment}`);
        console.log(`🔗 API Base URL: ${this.apiBaseUrl}`);
    }
    
    detectEnvironment() {
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
            return 'development';
        } else {
            return 'production';
        }
    }
    
    getApiBaseUrl() {
        // Usar sempre caminho relativo ao origin atual
        return '';
    }
    
    isDevelopment() {
        return this.environment === 'development';
    }
    
    isProduction() {
        return this.environment === 'production';
    }
    
    getApiUrl(endpoint) {
        // Remove barra inicial se existir
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        return `${this.apiBaseUrl}/${cleanEndpoint}`;
    }
}

// Instanciar configuração global
window.appConfig = new AppConfig();

// Exportar para compatibilidade
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}