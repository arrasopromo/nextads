// API Keys Configuration
// IMPORTANTE: Configure suas chaves reais aqui antes de usar as integrações

const API_KEYS = {
    // Facebook App Configuration
    // Para obter essas chaves:
    // 1. Acesse https://developers.facebook.com/
    // 2. Crie um novo app ou use um existente
    // 3. Vá em Configurações > Básico
    // IMPORTANTE: App Secrets foram movidos para o backend por segurança
    facebook: {
        appId: '1300310504880691'        // Ex: '1234567890123456'
        // appSecret removido por segurança - agora está no backend
    },

    // Instagram Basic Display API
    // Normalmente usa o mesmo App ID do Facebook
    instagram: {
        appId: '1300310504880691'        // Geralmente o mesmo do Facebook
        // appSecret removido por segurança - agora está no backend
    }
};

// Função para verificar se as chaves estão configuradas
function areAPIKeysConfigured() {
    const facebookConfigured = API_KEYS.facebook.appId !== 'SEU_FACEBOOK_APP_ID_AQUI' && 
                              API_KEYS.facebook.appId.length > 10;
    
    const instagramConfigured = API_KEYS.instagram.appId !== 'SEU_INSTAGRAM_APP_ID_AQUI' && 
                               API_KEYS.instagram.appId.length > 10;
    
    return {
        facebook: facebookConfigured,
        instagram: instagramConfigured,
        allConfigured: facebookConfigured && instagramConfigured,
        note: 'App Secrets agora são gerenciados de forma segura no backend'
    };
}

// Função para mostrar aviso se as chaves não estiverem configuradas
function checkAPIKeysOnLoad() {
    const status = areAPIKeysConfigured();
    
    if (!status.allConfigured) {
        console.warn('⚠️ ATENÇÃO: Configure suas chaves da API em api-keys.js');
        
        if (!status.facebook) {
            console.warn('❌ Facebook App ID não configurado');
        }
        
        if (!status.instagram) {
            console.warn('❌ Instagram App ID não configurado');
        }
        
        // Mostrar notificação visual se estiver na página de integrações
        if (window.location.pathname.includes('integracoes.html')) {
            showAPIKeyWarning();
        }
    } else {
        console.log('✅ Chaves da API configuradas corretamente');
    }
}

// Mostrar aviso visual na página
function showAPIKeyWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'api-key-warning';
    warningDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff6b6b;
        color: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    warningDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">⚠️</span>
            <div>
                <strong>Configuração Necessária</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">
                    Configure suas chaves da API no arquivo <code>api-keys.js</code>
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(warningDiv);
    
    // Remover aviso após 10 segundos
    setTimeout(() => {
        if (document.getElementById('api-key-warning')) {
            document.getElementById('api-key-warning').remove();
        }
    }, 10000);
}

// Verificar chaves quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAPIKeysOnLoad);
} else {
    checkAPIKeysOnLoad();
}