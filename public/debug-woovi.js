// Debug Woovi PIX JavaScript

class WooviDebugger {
    constructor() {
        this.config = {
            baseURL: 'https://api.woovi-sandbox.com',
            appId: '',
            timeout: 30000
        };
        
        this.currentCharge = null;
        this.webhookEvents = [];
        this.logEntries = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSavedConfig();
        this.generateCorrelationId();
        this.log('info', 'Debug Woovi PIX iniciado');
        this.log('info', `Base URL: ${this.config.baseURL}`);
        
        // Verificar se há webhook events no localStorage
        this.loadWebhookEvents();
        
        // Atualizar URL do webhook
        this.updateWebhookUrl();
    }
    
    setupEventListeners() {
        // Configuração
        document.getElementById('test-connection').addEventListener('click', () => this.testConnection());
        document.getElementById('base-url').addEventListener('change', (e) => {
            this.config.baseURL = e.target.value;
            this.saveConfig();
            this.log('info', `Base URL alterada para: ${this.config.baseURL}`);
        });
        
        document.getElementById('woovi-app-id').addEventListener('input', (e) => {
            this.config.appId = e.target.value;
            this.saveConfig();
        });
        
        // Formulário de cobrança
        document.getElementById('charge-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCharge();
        });
        
        // Logs
        document.getElementById('clear-logs').addEventListener('click', () => this.clearLogs());
        document.getElementById('export-logs').addEventListener('click', () => this.exportLogs());
        
        // Status
        document.getElementById('check-status').addEventListener('click', () => this.checkChargeStatus());
        
        // Webhook
        document.getElementById('copy-webhook-url').addEventListener('click', () => this.copyWebhookUrl());
        
        // Modal
        document.getElementById('close-qr-modal').addEventListener('click', () => this.closeQrModal());
        document.getElementById('copy-pix-code').addEventListener('click', () => this.copyPixCode());
        
        // Fechar modal clicando fora
        document.getElementById('qr-modal').addEventListener('click', (e) => {
            if (e.target.id === 'qr-modal') {
                this.closeQrModal();
            }
        });
        
        // Auto-gerar correlation ID quando valor mudar
        document.getElementById('charge-value').addEventListener('input', () => {
            this.generateCorrelationId();
        });
    }
    
    loadSavedConfig() {
        const savedConfig = localStorage.getItem('woovi-debug-config');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            this.config = { ...this.config, ...config };
            
            document.getElementById('woovi-app-id').value = this.config.appId || '';
            document.getElementById('base-url').value = this.config.baseURL;
        }
    }
    
    saveConfig() {
        localStorage.setItem('woovi-debug-config', JSON.stringify(this.config));
    }
    
    generateCorrelationId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        const correlationId = `debug-${timestamp}-${random}`;
        document.getElementById('correlation-id').value = correlationId;
        return correlationId;
    }
    
    async testConnection() {
        if (!this.config.appId) {
            this.log('error', 'App ID não configurado');
            this.showError('Por favor, configure o App ID da Woovi');
            return;
        }
        
        this.showLoading('Testando conexão com API Woovi...');
        this.log('info', 'Testando conexão com API Woovi...');
        
        try {
            // Tentar fazer uma requisição simples para testar a conexão
            const response = await fetch(`${this.config.baseURL}/api/v1/account`, {
                method: 'GET',
                headers: {
                    'Authorization': this.config.appId,
                    'Content-Type': 'application/json'
                },
                timeout: this.config.timeout
            });
            
            this.hideLoading();
            
            if (response.ok) {
                const data = await response.json();
                this.log('success', 'Conexão com API Woovi estabelecida com sucesso');
                this.log('info', `Dados da conta: ${JSON.stringify(data, null, 2)}`);
                this.showSuccess('Conexão estabelecida com sucesso!');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            this.hideLoading();
            this.log('error', `Erro ao testar conexão: ${error.message}`);
            this.showError(`Erro na conexão: ${error.message}`);
        }
    }
    
    async createCharge() {
        if (!this.config.appId) {
            this.log('error', 'App ID não configurado');
            this.showError('Por favor, configure o App ID da Woovi');
            return;
        }
        
        const formData = this.getFormData();
        
        if (!formData.value || formData.value <= 0) {
            this.log('error', 'Valor inválido para cobrança');
            this.showError('Por favor, insira um valor válido');
            return;
        }
        
        this.showLoading('Criando cobrança PIX...');
        this.log('info', 'Iniciando criação de cobrança PIX');
        this.log('info', `Dados da cobrança: ${JSON.stringify(formData, null, 2)}`);
        
        try {
            const response = await fetch('/api/create-pix-charge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            this.hideLoading();
            
            if (response.ok && result.success) {
                this.currentCharge = result.data;
                this.log('success', 'Cobrança PIX criada com sucesso');
                this.log('info', `Dados da cobrança: ${JSON.stringify(result.data, null, 2)}`);
                
                this.displayChargeResult(result.data);
                this.showQrModal(result.data);
                
                // Atualizar campo de status com correlation ID
                document.getElementById('status-correlation-id').value = result.data.correlationID;
                
            } else {
                throw new Error(result.error || 'Erro desconhecido ao criar cobrança');
            }
        } catch (error) {
            this.hideLoading();
            this.log('error', `Erro ao criar cobrança: ${error.message}`);
            this.showError(`Erro ao criar cobrança: ${error.message}`);
        }
    }
    
    getFormData() {
        const value = parseFloat(document.getElementById('charge-value').value);
        const comment = document.getElementById('charge-comment').value;
        const expiresIn = parseInt(document.getElementById('expires-in').value);
        const correlationId = document.getElementById('correlation-id').value;
        
        // Verificar se está usando sandbox baseado na URL selecionada
        const useSandbox = this.config.baseURL.includes('sandbox');
        
        const data = {
            value: Math.round(value * 100), // converter para centavos
            comment: comment || 'Teste de cobrança PIX - Debug',
            expiresIn: expiresIn || 900,
            correlationID: correlationId,
            useSandbox: useSandbox
        };
        
        // Adicionar dados do cliente se preenchidos
        const customerName = document.getElementById('customer-name').value;
        const customerEmail = document.getElementById('customer-email').value;
        const customerPhone = document.getElementById('customer-phone').value;
        const customerTaxId = document.getElementById('customer-tax-id').value;
        
        if (customerName || customerEmail || customerPhone || customerTaxId) {
            data.customer = {};
            if (customerName) data.customer.name = customerName;
            if (customerEmail) data.customer.email = customerEmail;
            if (customerPhone) data.customer.phone = customerPhone;
            if (customerTaxId) data.customer.taxID = customerTaxId;
        }
        
        return data;
    }
    
    displayChargeResult(chargeData) {
        const container = document.getElementById('result-container');
        
        const resultHtml = `
            <div class="charge-result">
                <div class="charge-info">
                    <h4><i class="fas fa-check-circle"></i> Cobrança Criada com Sucesso</h4>
                    <div class="charge-details">
                        <div class="charge-detail">
                            <strong>Correlation ID:</strong>
                            ${chargeData.correlationID}
                        </div>
                        <div class="charge-detail">
                            <strong>Valor:</strong>
                            R$ ${(chargeData.value / 100).toFixed(2).replace('.', ',')}
                        </div>
                        <div class="charge-detail">
                            <strong>Status:</strong>
                            <span class="text-info">${chargeData.status || 'ACTIVE'}</span>
                        </div>
                        <div class="charge-detail">
                            <strong>Expira em:</strong>
                            ${this.formatExpirationTime(chargeData.expiresDate)}
                        </div>
                    </div>
                    <div class="copy-container">
                        <input type="text" value="${chargeData.brCode || ''}" readonly>
                        <button type="button" class="btn btn-secondary" onclick="wooviDebugger.copyToClipboard('${chargeData.brCode || ''}')">
                            <i class="fas fa-copy"></i> Copiar PIX
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = resultHtml;
    }
    
    showQrModal(chargeData) {
        const modal = document.getElementById('qr-modal');
        const qrContainer = document.getElementById('qr-code-container');
        const pixInput = document.getElementById('pix-copy-paste');
        const valueDisplay = document.getElementById('charge-value-display');
        const expiresDisplay = document.getElementById('charge-expires-display');
        const statusDisplay = document.getElementById('charge-status-display');
        
        // Gerar QR Code
        if (chargeData.qrCodeImage) {
            qrContainer.innerHTML = `<img src="${chargeData.qrCodeImage}" alt="QR Code PIX" style="max-width: 250px; height: auto;">`;
        } else {
            qrContainer.innerHTML = `
                <div style="padding: 40px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px;">
                    <i class="fas fa-qrcode" style="font-size: 3rem; color: #6c757d; margin-bottom: 10px;"></i>
                    <p style="color: #6c757d; margin: 0;">QR Code não disponível</p>
                </div>
            `;
        }
        
        // Preencher dados
        pixInput.value = chargeData.brCode || '';
        valueDisplay.textContent = `R$ ${(chargeData.value / 100).toFixed(2).replace('.', ',')}`;
        expiresDisplay.textContent = this.formatExpirationTime(chargeData.expiresDate);
        statusDisplay.textContent = chargeData.status || 'ACTIVE';
        
        modal.style.display = 'flex';
    }
    
    closeQrModal() {
        document.getElementById('qr-modal').style.display = 'none';
    }
    
    copyPixCode() {
        const pixInput = document.getElementById('pix-copy-paste');
        this.copyToClipboard(pixInput.value);
    }
    
    async checkChargeStatus() {
        this.showError('Verificação de status removida - use apenas webhook para validação de pagamento');
        this.log('info', 'Função de polling removida - validação agora é feita apenas via webhook');
    }
    
    displayStatusResult(result, success) {
        const container = document.getElementById('status-result');
        
        if (success) {
            container.className = 'status-result success';
            container.innerHTML = `
                <h4><i class="fas fa-check-circle"></i> Status Obtido com Sucesso</h4>
                <p><strong>Status:</strong> ${result.status}</p>
                <p><strong>Correlation ID:</strong> ${result.data.charge?.correlationID}</p>
                <p><strong>Valor:</strong> R$ ${(result.data.charge?.value / 100).toFixed(2).replace('.', ',')}</p>
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; font-weight: bold;">Ver dados completos</summary>
                    <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; overflow-x: auto; font-size: 0.8rem;">${JSON.stringify(result.data, null, 2)}</pre>
                </details>
            `;
        } else {
            container.className = 'status-result error';
            container.innerHTML = `
                <h4><i class="fas fa-exclamation-circle"></i> Erro ao Verificar Status</h4>
                <p>${result.error}</p>
            `;
        }
    }
    
    copyWebhookUrl() {
        const webhookUrl = document.getElementById('webhook-url').textContent;
        this.copyToClipboard(webhookUrl);
    }
    
    updateWebhookUrl() {
        const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        const webhookUrl = `${window.location.protocol}//${window.location.hostname}:${port}/api/woovi-webhook`;
        document.getElementById('webhook-url').textContent = webhookUrl;
    }
    
    loadWebhookEvents() {
        const savedEvents = localStorage.getItem('woovi-webhook-events');
        if (savedEvents) {
            this.webhookEvents = JSON.parse(savedEvents);
            this.displayWebhookEvents();
        }
    }
    
    saveWebhookEvents() {
        localStorage.setItem('woovi-webhook-events', JSON.stringify(this.webhookEvents));
    }
    
    addWebhookEvent(event) {
        this.webhookEvents.unshift({
            ...event,
            timestamp: new Date().toISOString(),
            id: Date.now()
        });
        
        // Manter apenas os últimos 50 eventos
        if (this.webhookEvents.length > 50) {
            this.webhookEvents = this.webhookEvents.slice(0, 50);
        }
        
        this.saveWebhookEvents();
        this.displayWebhookEvents();
        this.log('info', `Webhook event recebido: ${event.event}`);
    }
    
    displayWebhookEvents() {
        const container = document.getElementById('webhook-events-container');
        
        if (this.webhookEvents.length === 0) {
            container.innerHTML = `
                <div class="no-events">
                    <i class="fas fa-clock"></i>
                    <p>Aguardando eventos do webhook...</p>
                </div>
            `;
            return;
        }
        
        const eventsHtml = this.webhookEvents.map(event => `
            <div class="webhook-event">
                <div class="webhook-event-header">
                    <span class="webhook-event-type">${event.event}</span>
                    <span class="webhook-event-time">${this.formatDateTime(event.timestamp)}</span>
                </div>
                <div class="webhook-event-data">${JSON.stringify(event, null, 2)}</div>
            </div>
        `).join('');
        
        container.innerHTML = eventsHtml;
    }
    
    log(level, message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            level,
            message,
            id: Date.now()
        };
        
        this.logEntries.unshift(logEntry);
        
        // Manter apenas os últimos 100 logs
        if (this.logEntries.length > 100) {
            this.logEntries = this.logEntries.slice(0, 100);
        }
        
        this.displayLogs();
        
        // Log no console também
        console.log(`[${level.toUpperCase()}] ${message}`);
    }
    
    displayLogs() {
        const container = document.getElementById('logs-container');
        
        const logsHtml = this.logEntries.map(entry => `
            <div class="log-entry">
                <span class="log-time">[${entry.timestamp}]</span>
                <span class="log-level ${entry.level}">${entry.level.toUpperCase()}</span>
                <span class="log-message">${entry.message}</span>
            </div>
        `).join('');
        
        container.innerHTML = logsHtml;
        
        // Auto-scroll para o topo (logs mais recentes)
        container.scrollTop = 0;
    }
    
    clearLogs() {
        this.logEntries = [];
        this.displayLogs();
        this.log('info', 'Logs limpos');
    }
    
    exportLogs() {
        const logsText = this.logEntries.map(entry => 
            `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`
        ).join('\n');
        
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `woovi-debug-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.log('info', 'Logs exportados');
    }
    
    showLoading(message = 'Carregando...') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = document.getElementById('loading-message');
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
    
    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type = 'info') {
        // Criar notificação toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Adicionar estilos se não existirem
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 3000;
                    animation: slideInRight 0.3s ease;
                    max-width: 400px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                }
                .toast-success { background: #27ae60; }
                .toast-error { background: #e74c3c; }
                .toast-info { background: #3498db; }
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Remover após 5 segundos
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showSuccess('Copiado para a área de transferência!');
            }).catch(() => {
                this.fallbackCopyToClipboard(text);
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showSuccess('Copiado para a área de transferência!');
        } catch (err) {
            this.showError('Erro ao copiar para a área de transferência');
        }
        
        document.body.removeChild(textArea);
    }
    
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR');
    }
    
    formatExpirationTime(expiresDate) {
        if (!expiresDate) return 'Não definido';
        
        const expires = new Date(expiresDate);
        const now = new Date();
        const diff = expires.getTime() - now.getTime();
        
        if (diff <= 0) {
            return 'Expirado';
        }
        
        const minutes = Math.floor(diff / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        return `${minutes}m ${seconds}s`;
    }
}

// Inicializar quando a página carregar
let wooviDebugger;

document.addEventListener('DOMContentLoaded', () => {
    wooviDebugger = new WooviDebugger();
    
    // Simular recebimento de webhook events (para teste)
    // Remover em produção
    if (window.location.search.includes('test-webhook')) {
        setTimeout(() => {
            wooviDebugger.addWebhookEvent({
                event: 'OPENPIX:CHARGE_COMPLETED',
                charge: {
                    correlationID: 'debug-test-123',
                    value: 29700,
                    status: 'COMPLETED'
                }
            });
        }, 3000);
    }
});

// Expor globalmente para uso em callbacks
window.wooviDebugger = wooviDebugger;