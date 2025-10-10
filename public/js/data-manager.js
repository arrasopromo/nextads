/**
 * Sistema de Gerenciamento de Dados MongoDB
 * Funciona exclusivamente com MongoDB via API
 */

class DataManager {
    constructor() {
        this.isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        // Usar sempre URL relativa ao origin atual para evitar conflitos de porta (ex.: 4000 vs 4001)
        this.apiBaseUrl = '';
        this.useAPI = true; // Sempre usar API/MongoDB
        this.init();
    }

    async init() {
        // Verificar se a API está disponível
        try {
            const healthUrl = `${this.apiBaseUrl}/api/health`;
            const response = await fetch(healthUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            if (!text) {
                throw new Error('Resposta vazia do servidor');
            }
            
            const data = JSON.parse(text);
            if (!data.mongodb) {
                console.log('⚠️ MongoDB não disponível, usando localStorage como fallback');
                this.useAPI = false;
            } else {
                console.log('🗄️ DataManager: Conectado ao MongoDB');
                this.useAPI = true;
            }
        } catch (error) {
            console.error('❌ Erro ao verificar API:', error.message);
            console.log('⚠️ Usando localStorage como fallback');
            this.useAPI = false;
        }
    }

    // ==================== MÉTODOS PRINCIPAIS ====================

    async getAllCampaigns() {
        if (this.useAPI) {
            return await this.getFromAPI();
        } else {
            return this.getFromLocalStorage();
        }
    }

    async saveCampaign(campaign) {
        if (this.useAPI) {
            return await this.saveToAPI(campaign);
        } else {
            return this.saveToLocalStorage(campaign);
        }
    }

    async updateCampaign(campaignId, updateData) {
        if (this.useAPI) {
            return await this.updateInAPI(campaignId, updateData);
        } else {
            return this.updateInLocalStorage(campaignId, updateData);
        }
    }

    async deleteCampaign(campaignId) {
        if (this.useAPI) {
            return await this.deleteFromAPI(campaignId);
        } else {
            return this.deleteFromLocalStorage(campaignId);
        }
    }

    // ==================== MÉTODOS DA API (MongoDB) ====================

    async getFromAPI() {
        try {
            // Usar API REST diretamente
            const apiUrl = `${this.apiBaseUrl}/api/campaigns`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            if (!text) {
                throw new Error('Resposta vazia do servidor');
            }
            
            const data = JSON.parse(text);
            
            if (data.error) {
                throw new Error(`API Error: ${data.error}`);
            }
            
            console.log('📊 [API] Campanhas carregadas:', data.campaigns?.length || 0);
            
            // Ordenar campanhas por data de criação (mais recente primeiro) no lado do cliente
            const campaigns = data.campaigns || [];
            campaigns.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.startTime || 0);
                const dateB = new Date(b.createdAt || b.startTime || 0);
                return dateB - dateA; // Ordem decrescente (mais recente primeiro)
            });
            
            console.log('📊 [API] Campanhas ordenadas por data de criação');
            return campaigns;
        } catch (error) {
            console.error('❌ [API] Erro ao carregar campanhas:', error);
            throw error;
        }
    }

    async saveToAPI(campaign) {
        try {
            // Use REST API directly
            console.log('🔄 [API] Salvando campanha via REST API');
            
            // Obter token de autenticação se disponível
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Verificar se há um usuário logado e incluir token
            if (window.sessionManager && typeof window.sessionManager.getUserData === 'function') {
                const userData = window.sessionManager.getUserData();
                if (userData && userData.accessToken) {
                    headers['Authorization'] = `Bearer ${userData.accessToken}`;
                    console.log('✅ [API] Token de autenticação incluído no salvamento');
                }
            }
            
            const apiUrl = `${this.apiBaseUrl}/api/campaigns`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(campaign)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            if (!text) {
                throw new Error('Resposta vazia do servidor');
            }
            
            const result = JSON.parse(text);
            console.log('✅ [API] Campanha salva via REST:', result);
            return result;
        } catch (error) {
            console.error('❌ [API] Erro ao salvar campanha:', error);
            throw error;
        }
    }

    async updateInAPI(campaignId, updateData) {
        try {
            // Obter token de autenticação se disponível
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Verificar se há um usuário logado e incluir token
            if (window.sessionManager && typeof window.sessionManager.getUserData === 'function') {
                const userData = window.sessionManager.getUserData();
                if (userData && userData.accessToken) {
                    headers['Authorization'] = `Bearer ${userData.accessToken}`;
                    console.log('✅ [API] Token de autenticação incluído na atualização');
                }
            }
            
            const apiUrl = `${this.apiBaseUrl}/api/campaigns/${campaignId}`;
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            if (!text) {
                throw new Error('Resposta vazia do servidor');
            }
            
            const data = JSON.parse(text);
            
            if (data.error) {
                throw new Error(`API Error: ${data.error}`);
            }
            
            return data;
        } catch (error) {
            console.error('Erro ao atualizar campanha na API:', error);
            throw error;
        }
    }

    async deleteFromAPI(campaignId) {
        try {
            const apiUrl = `${this.apiBaseUrl}/api/campaigns/${campaignId}`;
            const response = await fetch(apiUrl, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            if (!text) {
                throw new Error('Resposta vazia do servidor');
            }
            
            const data = JSON.parse(text);
            console.log('✅ [API] Campanha deletada via REST:', data);
            
            if (data.error) {
                throw new Error(`API Error: ${data.error}`);
            }
            
            return data;
        } catch (error) {
            console.error('Erro ao deletar campanha na API:', error);
            throw error;
        }
    }

    // ==================== MÉTODOS LOCALSTORAGE (FALLBACK) ====================

    getFromLocalStorage() {
        try {
            const campaigns = localStorage.getItem('campaigns');
            return campaigns ? JSON.parse(campaigns) : [];
        } catch (error) {
            console.error('Erro ao carregar do localStorage:', error);
            return [];
        }
    }

    saveToLocalStorage(campaign) {
        try {
            const campaigns = this.getFromLocalStorage();
            const existingIndex = campaigns.findIndex(c => c.id === campaign.id);
            
            if (existingIndex >= 0) {
                campaigns[existingIndex] = campaign;
            } else {
                campaigns.push(campaign);
            }
            
            localStorage.setItem('campaigns', JSON.stringify(campaigns));
            console.log('✅ [LocalStorage] Campanha salva:', campaign.id);
            return { success: true, id: campaign.id };
        } catch (error) {
            console.error('❌ [LocalStorage] Erro ao salvar:', error);
            throw error;
        }
    }

    updateInLocalStorage(campaignId, updateData) {
        try {
            const campaigns = this.getFromLocalStorage();
            const index = campaigns.findIndex(c => c.id === campaignId);
            
            if (index >= 0) {
                campaigns[index] = { ...campaigns[index], ...updateData };
                localStorage.setItem('campaigns', JSON.stringify(campaigns));
                console.log('✅ [LocalStorage] Campanha atualizada:', campaignId);
                return { success: true, id: campaignId };
            } else {
                throw new Error('Campanha não encontrada');
            }
        } catch (error) {
            console.error('❌ [LocalStorage] Erro ao atualizar:', error);
            throw error;
        }
    }

    deleteFromLocalStorage(campaignId) {
        try {
            const campaigns = this.getFromLocalStorage();
            const filteredCampaigns = campaigns.filter(c => c.id !== campaignId);
            localStorage.setItem('campaigns', JSON.stringify(filteredCampaigns));
            console.log('✅ [LocalStorage] Campanha deletada:', campaignId);
            return { success: true, id: campaignId };
        } catch (error) {
            console.error('❌ [LocalStorage] Erro ao deletar:', error);
            throw error;
        }
    }

    // ==================== UTILITÁRIOS ====================

    getStorageInfo() {
        return {
            useAPI: this.useAPI,
            isProduction: this.isProduction,
            apiBaseUrl: this.apiBaseUrl,
            mongoDBOnly: true
        };
    }
}

// Instância global
window.dataManager = new DataManager();

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}