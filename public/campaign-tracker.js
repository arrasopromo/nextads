// CampaignTracker - Sistema de rastreamento de campanhas
// Agora usando exclusivamente MongoDB via DataManager
class CampaignTracker {
    constructor(campaignId = null) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            console.log('[CampaignTracker] 📱 Inicializando em dispositivo móvel');
            console.log('[CampaignTracker] 🌐 Domínio:', window.location.hostname);
            console.log('[CampaignTracker] 🔒 Protocolo:', window.location.protocol);
            console.log('[CampaignTracker] 📊 UserAgent:', navigator.userAgent);
        }
        
        // Inicializar DataManager para MongoDB
        this.dataManager = new DataManager();
        
        console.log('🗄️ CampaignTracker configurado para usar apenas MongoDB');
        
        // Sempre criar nova campanha (sem reutilização)
        console.log('🆕 [CampaignTracker] Criando nova campanha');
        
        // Inicializar de forma assíncrona
        this.initializeAsync(campaignId, true);
    }
    
    async initializeAsync(campaignId, isNewSession) {
        // Verificar se já existe um campaignId ativo
        const existingCampaignId = campaignId || localStorage.getItem('activeCampaignId');
        
        if (existingCampaignId) {
            // SEMPRE reutilizar o campaignId existente se houver um no localStorage
            this.campaignId = existingCampaignId;
            console.log('🔄 [CampaignTracker] Reutilizando campaignId existente:', this.campaignId);
            
            // Tentar carregar dados existentes da campanha
            try {
                const campaigns = await this.dataManager.getAllCampaigns();
                const existingCampaign = campaigns.find(c => 
                    c.campaignId === this.campaignId || 
                    c.id === this.campaignId || 
                    c._id?.$oid === this.campaignId
                );
                
                if (existingCampaign) {
                    // Carregar dados existentes
                    this.campaignData = existingCampaign.campaignData || existingCampaign;
                    this.startTime = existingCampaign.startTime || new Date().toISOString();
                    this.currentStep = existingCampaign.currentStep || 'initial';
                    this.completedSteps = existingCampaign.completedSteps || [];
                    this.currentProgress = existingCampaign.currentProgress || 0;
                    this.progressSteps = existingCampaign.progressSteps || {};
                    console.log('✅ [CampaignTracker] Dados da campanha carregados:', this.campaignData);
                } else {
                    console.log('⚠️ [CampaignTracker] Campanha não encontrada no MongoDB, usando dados padrão');
                    this.initializeDefaultData();
                }
            } catch (error) {
                console.log('⚠️ [CampaignTracker] Erro ao carregar campanha existente:', error);
                this.initializeDefaultData();
            }
        } else {
            // Verificar se o usuário está autenticado antes de criar nova campanha
            let userId = null;
            if (window.sessionManager && typeof window.sessionManager.getUserData === 'function') {
                const userData = window.sessionManager.getUserData();
                if (userData && userData.userId) {
                    userId = userData.userId;
                } else {
                    console.warn('⚠️ [CampaignTracker] Usuário não autenticado - campanha será criada sem userId');
                }
            }
            
            // Criar nova campanha APENAS se não houver nenhuma ativa
            this.campaignId = this.generateCampaignId();
            console.log('🆕 [CampaignTracker] Criando nova campanha (nenhuma ativa encontrada):', this.campaignId);
            this.initializeDefaultData();
            
            // Salvar imediatamente no MongoDB para garantir persistência
            try {
                await this.saveCampaign();
                console.log('✅ [CampaignTracker] Nova campanha salva no MongoDB:', this.campaignId);
            } catch (error) {
                console.error('❌ [CampaignTracker] Erro ao salvar nova campanha no MongoDB:', error);
            }
        }
        
        this.sessionId = this.generateSessionId();
        this.isNewSession = !existingCampaignId;
        this.isAbandoned = false;
        this.isCompleted = false;
        this.completionTime = null;
        
        // Salvar activeCampaignId imediatamente no localStorage
        localStorage.setItem('activeCampaignId', this.campaignId);
        console.log('💾 [CampaignTracker] activeCampaignId salvo no localStorage:', this.campaignId);
        
        console.log('🆔 [CampaignTracker] Campaign ID final:', this.campaignId);
        
        console.log('🆔 CampaignTracker initialized with ID:', this.campaignId);
        console.log('🔄 Session ID:', this.sessionId);
        console.log('🆕 Is new session:', this.isNewSession);
        console.log('🗄️ Using MongoDB only:', true);
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            console.log('[CampaignTracker] ✅ Inicialização concluída em mobile');
            console.log('[CampaignTracker] 🆔 Campaign ID:', this.campaignId);
            console.log('[CampaignTracker] 🔑 Session ID:', this.sessionId);
        }
        
        // Sistema de progresso de etapas (só inicializar se não existir)
        if (!this.progressSteps) {
            this.progressSteps = {
                1: { name: 'index', completed: false, description: 'Dados básicos preenchidos na index' },
                2: { name: 'config-campaign', completed: false, description: 'Configuração da campanha' },
                3: { name: 'payment-generated', completed: false, description: 'Pedido gerado' },
                4: { name: 'payment-completed', completed: false, description: 'Pagamento concluído' }
            };
        }
        if (this.currentProgress === undefined || this.currentProgress === null || typeof this.currentProgress !== 'number') {
            this.currentProgress = 0; // Inicia em 0, vai para 1 quando estiver na index
            console.log('📈 Progresso inicializado como 0 (será atualizado pela detecção de página)');
        }
        
        // Detectar página atual e atualizar progresso automaticamente
        this.detectCurrentPageAndUpdateProgress();
        
        // Inicializar DataManager
        this.init();
        
        console.log('✅ CampaignTracker inicializado para MongoDB');
    }
    
    // Método para inicializar dados padrão da campanha
    initializeDefaultData() {
        this.startTime = new Date().toISOString();
        this.currentStep = 'initial';
        this.completedSteps = [];
        
        // Obter parâmetros UTM se disponíveis
        const utmParams = typeof getUTMParameters === 'function' ? getUTMParameters() : {
            utm_source: '',
            utm_medium: '',
            utm_campaign: '',
            utm_term: '',
            utm_content: ''
        };
        
        // Inicializar dados da campanha
        this.campaignData = {
            objective: '',
            direction: '',
            profile: '',
            startTime: this.startTime,
            currentStep: this.currentStep,
            utm_source: utmParams.utm_source,
            utm_medium: utmParams.utm_medium,
            utm_campaign: utmParams.utm_campaign,
            utm_term: utmParams.utm_term,
            utm_content: utmParams.utm_content
        };
    }
    
    async init() {
        try {
            await this.dataManager.init();
            console.log('🗄️ DataManager inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar DataManager:', error);
            throw error;
        }
    }
    
    // Métodos principais para salvar dados no MongoDB com debouncing
    async saveCampaign() {
        // Implementar debouncing para evitar múltiplas chamadas simultâneas
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
        
        return new Promise((resolve, reject) => {
            this._saveTimeout = setTimeout(async () => {
                try {
                    console.log('💾 [DEBOUNCED] Salvando campanha:', this.campaignId);
                    
                    // Obter parâmetros UTM salvos
                    const utmParams = typeof getUTMParameters === 'function' ? getUTMParameters() : {
                        utm_source: '',
                        utm_medium: '',
                        utm_campaign: '',
                        utm_term: '',
                        utm_content: ''
                    };
                    
                    // Obter userId - primeiro da instância, depois do sessionManager
                    let userId = this.userId || null;
                    if (!userId && window.sessionManager && typeof window.sessionManager.getUserData === 'function') {
                        const userData = window.sessionManager.getUserData();
                        if (userData && userData.userId) {
                            userId = userData.userId;
                            console.log('✅ [CampaignTracker] UserId obtido do sessionManager:', userId);
                        }
                    }
                    if (userId) {
                        console.log('✅ [CampaignTracker] UserId será salvo na campanha:', userId);
                    } else {
                        console.log('⚠️ [CampaignTracker] Nenhum userId disponível para salvar');
                    }
                    
                    const campaignData = {
                        id: this.campaignId,
                        campaignId: this.campaignId, // Garantir compatibilidade
                        userId: userId, // Adicionar userId se disponível
                        name: `Campanha ${this.campaignId}`,
                        status: this.isCompleted ? 'completed' : (this.isAbandoned ? 'abandoned' : 'active'),
                        createdAt: this.startTime,
                        completedAt: this.completionTime,
                        currentStep: this.currentStep,
                        completedSteps: this.completedSteps,
                        campaignData: this.campaignData,
                        objective: this.objective,
                        direction: this.direction,
                        creative: this.creative,
                        // budget field removed
                        profile: this.profile,
                        location: this.location || this.campaignData?.selectedState || this.campaignData?.location,
                        gender: this.gender,
                        age: this.age,
                        duration: this.duration,
                        index: this.index, // CAMPO INDEX ADICIONADO
                        profileData: this.profileData,
                        siteUrl: this.siteUrl,
                        audience: this.audience,
                        markets: this.markets,
                        // Plataformas selecionadas
                        platforms: this.platforms || this.campaignData?.platforms,
                        // Parâmetros UTM
                        utm_source: this.utm_source || this.campaignData?.utm_source || utmParams.utm_source,
                        utm_medium: this.utm_medium || this.campaignData?.utm_medium || utmParams.utm_medium,
                        utm_campaign: this.utm_campaign || this.campaignData?.utm_campaign || utmParams.utm_campaign,
                        utm_term: this.utm_term || this.campaignData?.utm_term || utmParams.utm_term,
                        utm_content: this.utm_content || this.campaignData?.utm_content || utmParams.utm_content,
                        // Garantir que os arquivos sejam salvos em múltiplas propriedades para compatibilidade
                        files: this.campaignData?.uploadedFiles || this.campaignData?.files || this.files || [],
                        uploadedFiles: this.campaignData?.uploadedFiles || this.campaignData?.files || this.files || [],
                        progressSteps: this.progressSteps,
                        currentProgress: this.currentProgress,
                        isAbandoned: this.isAbandoned,
                        isCompleted: this.isCompleted,
                        lastSaved: new Date().toISOString()
                    };
                    
                    // Garantir padrão de Público Ad+ quando não houver mercados selecionados
                    try {
                        const selectedMarketsRaw = this.selectedMarkets || this.campaignData?.selectedMarkets || campaignData.selectedMarkets || [];
                        const marketNames = Array.isArray(selectedMarketsRaw)
                            ? selectedMarketsRaw
                                .map(m => typeof m === 'string' ? m : (m && (m.nome || m.name || m.title || '')))
                                .filter(Boolean)
                            : [];

                        // Preservar selectedMarkets no documento salvo
                        if (!campaignData.selectedMarkets) {
                            campaignData.selectedMarkets = selectedMarketsRaw;
                        }

                        // Definir audience padrão: "Público Ad+" ou "Público Ad+ • Mercado1, Mercado2"
                        if (!campaignData.audience || !String(campaignData.audience).trim()) {
                            campaignData.audience = marketNames.length > 0
                                ? `Público Ad+ • ${marketNames.join(', ')}`
                                : 'Público Ad+';
                        }

                        // Campo legado "publico" como espelho do audience
                        if (!campaignData.publico || !String(campaignData.publico).trim()) {
                            campaignData.publico = campaignData.audience;
                        }

                        // Se não houver markets definidos, mas há mercados selecionados, salvar nomes em markets
                        const marketsEmpty = (
                            campaignData.markets === undefined ||
                            (Array.isArray(campaignData.markets) && campaignData.markets.length === 0) ||
                            (typeof campaignData.markets === 'string' && !campaignData.markets.trim())
                        );
                        if (marketsEmpty && marketNames.length > 0) {
                            campaignData.markets = marketNames;
                        }
                    } catch (e) {
                        console.warn('⚠️ [CampaignTracker] Falha ao aplicar padrão Público Ad+:', e);
                    }

                    // DEBUG: Log dos arquivos sendo salvos
                    console.log('💾 [DEBUG] Salvando campanha com arquivos:', {
                        campaignId: this.campaignId,
                        files: campaignData.files,
                        uploadedFiles: campaignData.uploadedFiles,
                        campaignDataFiles: campaignData.campaignData?.files,
                        thisFiles: this.files,
                        thisCampaignDataFiles: this.campaignData?.files,
                        location: campaignData.location,
                        selectedState: campaignData.campaignData?.selectedState
                    });
                    
                    const result = await this.dataManager.saveCampaign(campaignData);
                    console.log('✅ [DEBOUNCED] Campanha salva no MongoDB:', result);
                    resolve(result);
                } catch (error) {
                    console.error('❌ [DEBOUNCED] Erro ao salvar campanha no MongoDB:', error);
                    reject(error);
                }
            }, 500); // Debounce de 500ms
        });
    }
    
    // Método para atualizar dados da campanha
    async updateCampaign(updates) {
        try {
            // Atualizar propriedades locais
            Object.assign(this, updates);
            
            // Salvar no MongoDB
            return await this.saveCampaign();
        } catch (error) {
            console.error('❌ Erro ao atualizar campanha:', error);
            throw error;
        }
    }

    // Método para criar sempre uma nova campanha
    getOrCreateActiveCampaignId() {
        // SEMPRE criar nova campanha para garantir dados únicos
        const newId = this.generateCampaignId();
        console.log('🆕 Criando nova campanha:', newId);
        return newId;
    }

    generateCampaignId(fileName = null) {
        if (fileName) {
            // Limpar o nome do arquivo para usar como ID
            const cleanFileName = fileName
                .replace(/\.[^/.]+$/, '') // Remove extensão
                .replace(/[^a-zA-Z0-9_-]/g, '_') // Substitui caracteres especiais por underscore
                .toLowerCase()
                .substring(0, 50); // Limita o tamanho
            
            return `camp_${cleanFileName}_${Date.now()}`;
        }
        return 'camp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Método para verificar se há campanha ativa existente
    async getExistingActiveCampaign() {
        try {
            // Verificar localStorage primeiro
            const activeCampaignId = localStorage.getItem('activeCampaignId');
            if (activeCampaignId) {
                const campaigns = JSON.parse(localStorage.getItem('campaigns') || '[]');
                const activeCampaign = campaigns.find(c => c.id === activeCampaignId || c.campaignId === activeCampaignId);
                if (activeCampaign) {
                    console.log('✅ Campanha ativa encontrada no localStorage:', activeCampaign);
                    return activeCampaign;
                }
            }
            
            // Se não encontrou no localStorage, verificar campaignData
            const campaignData = JSON.parse(localStorage.getItem('campaignData') || '{}');
            if (campaignData && Object.keys(campaignData).length > 0) {
                console.log('✅ Dados de campanha encontrados no campaignData:', campaignData);
                return {
                    id: campaignData.id || activeCampaignId,
                    campaignData: campaignData,
                    ...campaignData
                };
            }
            
            // Se não encontrou no localStorage, verificar MongoDB
            console.log('🔍 Verificando campanhas ativas no MongoDB...');
            const mongoActiveCampaign = await CampaignTracker.getActiveCampaign();
            if (mongoActiveCampaign) {
                console.log('✅ Campanha ativa encontrada no MongoDB:', mongoActiveCampaign);
                // Sincronizar com localStorage para próximas verificações
                localStorage.setItem('activeCampaignId', mongoActiveCampaign.campaignId || mongoActiveCampaign.id);
                return mongoActiveCampaign;
            }
            
            console.log('ℹ️ Nenhuma campanha ativa existente encontrada');
            return null;
        } catch (error) {
            console.error('❌ Erro ao verificar campanha existente:', error);
            return null;
        }
    }

    // Método para detectar nova sessão baseado na lógica do script.js
    detectNewSession() {
        try {
            // Verificar se localStorage está disponível
            if (typeof(Storage) === "undefined") {
                console.log('🆕 [CampaignTracker] localStorage não disponível - considerando nova sessão');
                return true;
            }

            const now = Date.now();
            const lastPageLoad = localStorage.getItem('lastPageLoad');
            const referrer = document.referrer;
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';

            // Se não há registro de último carregamento, é nova sessão
            if (!lastPageLoad) {
                console.log('🆕 [CampaignTracker] Primeira visita - nova sessão');
                localStorage.setItem('lastPageLoad', now.toString());
                return true;
            }

            // Verificar tempo desde último carregamento (30 minutos = 1800000ms)
            const timeSinceLastLoad = now - parseInt(lastPageLoad);
            if (timeSinceLastLoad > 1800000) {
                console.log('🆕 [CampaignTracker] Sessão expirada por tempo - nova sessão');
                localStorage.setItem('lastPageLoad', now.toString());
                return true;
            }

            // Verificar se o referrer é externo ou ausente
            const isExternalReferrer = !referrer || (!referrer.includes(window.location.hostname) && !referrer.includes('localhost'));
            
            // Para index.html sempre criar nova campanha (sem reutilização)
            if (currentPage === 'index.html' && isExternalReferrer) {
                console.log('🆕 [CampaignTracker] Acesso ao index.html com referrer externo - sempre nova sessão');
                localStorage.setItem('lastPageLoad', now.toString());
                return true; // Sempre criar nova campanha
            }

            // Preservar sessão para navegação interna
            console.log('♻️ [CampaignTracker] Navegação interna detectada - preservando sessão');
            localStorage.setItem('lastPageLoad', now.toString());
            return false;

        } catch (error) {
            console.error('❌ [CampaignTracker] Erro na detecção de sessão:', error);
            return true; // Em caso de erro, considerar nova sessão
        }
    }

    // Método simplificado - não usa localStorage
    handleSessionLogic() {
        console.log('🆕 [CampaignTracker] Nova sessão iniciada - usando apenas MongoDB');
        // Não há dados para recuperar do localStorage
    }

    // Método removido - não usa localStorage
    clearPreviousSessionData() {
        console.log('🗑️ [CampaignTracker] Não há dados de localStorage para limpar');
    }

    async updateCampaign(field, value) {
        console.log(`📝 Updating campaign ${field}:`, value);
        
        // Verificar se campaignData existe, se não, inicializar
        if (!this.campaignData) {
            console.log('⚠️ campaignData não inicializado, criando objeto vazio');
            this.campaignData = {
                objective: null,
                direction: null,
                creative: null,
                profile: null,
                profileData: null,
                location: null,
                gender: null,
                age: null,
                duration: null,
                markets: null,
                platforms: null,
                files: [],
                utm_source: null,
                utm_medium: null,
                utm_campaign: null,
                utm_term: null,
                utm_content: null
            };
        }
        
        // Salvar no campaignData e também como propriedade direta
        this.campaignData[field] = value;
        this[field] = value;
        
        // Tratamento especial para arquivos
        if (field === 'files' && Array.isArray(value)) {
            this.files = value;
            this.campaignData.files = value;
            console.log('📎 [DEBUG] Arquivos atualizados:', value.length, 'arquivos');
        }
        
        // Atualizar step atual baseado no campo
        const stepMap = {
            'objective': 'objective',
            'direction': 'direction', 
            'creative': 'creative',
            // 'budget': 'budget', // removed
            'profile': 'profile',
            'profileData': 'profileData',
            'location': 'location',
            'gender': 'gender',
            'age': 'age',
            'duration': 'duration',
            'markets': 'markets',
            'platforms': 'platforms',
            'index': 'index', // CAMPO INDEX ADICIONADO
            'files': 'files', // CAMPO FILES ADICIONADO
            'utm_source': 'utm_source',
            'utm_medium': 'utm_medium',
            'utm_campaign': 'utm_campaign',
            'utm_term': 'utm_term',
            'utm_content': 'utm_content'
        };
        
        if (stepMap[field]) {
            this.currentStep = stepMap[field];
            if (!this.completedSteps.includes(field)) {
                this.completedSteps.push(field);
            }
        }
        
        // Salvar no MongoDB
        try {
            await this.saveCampaign();
        } catch (error) {
            console.error('❌ Erro ao salvar atualização no MongoDB:', error);
        }
    }

    // Método específico para atualizar o userId
    async updateUserId(userId) {
        console.log('🔄 [CampaignTracker] Atualizando userId da campanha:', userId);
        this.userId = userId;
        await this.saveCampaign();
        console.log('✅ [CampaignTracker] UserId atualizado e campanha salva');
    }

    updateField(field, value) {
        // Alias para updateCampaign para compatibilidade
        this.updateCampaign(field, value);
    }

    async addCompletedStep(step) {
        if (!this.completedSteps.includes(step)) {
            this.completedSteps.push(step);
            try {
                await this.saveCampaign();
            } catch (error) {
                console.error('❌ Erro ao salvar step completado no MongoDB:', error);
            }
        }
    }

    async markAbandoned() {
        this.isAbandoned = true;
        try {
            await this.saveCampaign();
        } catch (error) {
            console.error('❌ Erro ao marcar campanha como abandonada no MongoDB:', error);
        }
    }

    async markCompleted() {
        this.isCompleted = true;
        this.completionTime = new Date();
        console.log('✅ Campaign completed:', this.campaignId);
        try {
            await this.saveCampaign();
            console.log('✅ Campanha completada e salva no MongoDB:', this.campaignId);
        } catch (error) {
            console.error('❌ Erro ao marcar campanha como completada no MongoDB:', error);
        }
    }

    // Métodos para gerenciar progresso de etapas
    async updateProgress(step) {
        if (this.progressSteps[step]) {
            this.progressSteps[step].completed = true;
            this.currentProgress = Math.max(this.currentProgress, step);
            console.log(`📈 Progresso atualizado para etapa ${step}: ${this.progressSteps[step].description}`);
            
            // Salvar no MongoDB
            try {
                await this.saveCampaign();
            } catch (error) {
                console.error('❌ Erro ao salvar progresso no MongoDB:', error);
            }
        }
    }

    getCurrentProgress() {
        return this.currentProgress;
    }

    getProgressSteps() {
        return this.progressSteps;
    }

    getProgressPercentage() {
        const completedSteps = Object.values(this.progressSteps).filter(step => step.completed).length;
        return Math.round((completedSteps / Object.keys(this.progressSteps).length) * 100);
    }

    // Detectar página atual e atualizar progresso automaticamente
    detectCurrentPageAndUpdateProgress() {
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';
        
        console.log('🔍 Detectando página atual:', currentPage);
        
        // Atualizar progresso baseado na página atual
        if (currentPage === 'index.html' || currentPage === '') {
            // Página index = 1 etapa
            if (this.currentProgress < 1) {
                this.updateProgress(1);
                console.log('📈 Progresso atualizado para etapa 1 (index)');
            }
        } else if (currentPage === 'campaign-config.html') {
            // Página config = 2 etapas
            if (this.currentProgress < 2) {
                this.updateProgress(1); // Garantir que etapa 1 está completa
                this.updateProgress(2); // Atualizar para etapa 2
                console.log('📈 Progresso atualizado para etapa 2 (config-campaign)');
            }
        }
        // Etapa 3 (pedido gerado) será atualizada quando o PIX for gerado
    }

    static async getAllCampaigns() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            console.log('[CampaignTracker] 📱📊 getAllCampaigns() chamado em mobile - usando apenas MongoDB');
        }
        
        try {
            // Usar DataManager exclusivamente para MongoDB
            if (window.dataManager) {
                if (isMobile) {
                    console.log('[CampaignTracker] 📱🗄️ Usando DataManager em mobile - MongoDB apenas');
                }
                const campaigns = await window.dataManager.getAllCampaigns();
                
                if (isMobile) {
                    console.log('[CampaignTracker] 📱📋 Campanhas do MongoDB em mobile:', {
                        count: campaigns.length,
                        source: 'MongoDB',
                        campaigns: campaigns.map(c => ({ id: c.id || c.campaignId, status: c.status, created: c.created }))
                    });
                }
                
                return campaigns;
            }
            
            console.warn('⚠️ DataManager não disponível - retornando array vazio');
            return [];
        } catch (e) {
            if (isMobile) {
                console.error('[CampaignTracker] 📱❌ Erro ao recuperar campanhas do MongoDB em mobile:', e);
            }
            console.error('❌ Erro ao recuperar campanhas do MongoDB:', e);
            return [];
        }
    }
    
    static async getActiveCampaign() {
        try {
            console.log('🔍 Buscando campanha ativa no MongoDB');
            const campaigns = await CampaignTracker.getAllCampaigns();
            
            // Retornar a campanha mais recente que não foi completada
            const activeCampaign = campaigns
                .filter(c => !c.isCompleted && !c.isAbandoned)
                .sort((a, b) => new Date(b.createdAt || b.startTime) - new Date(a.createdAt || a.startTime))[0];
            
            if (activeCampaign) {
                console.log('✅ Campanha ativa encontrada no MongoDB:', activeCampaign.campaignId || activeCampaign.id);
            } else {
                console.log('ℹ️ Nenhuma campanha ativa encontrada no MongoDB');
            }
            
            return activeCampaign || null;
        } catch (e) {
            console.error('❌ Erro ao recuperar campanha ativa do MongoDB:', e);
            return null;
        }
    }
    
    // Função estática para atualizar progresso de qualquer lugar
    static async updateProgressGlobal(step, campaignId = null) {
        try {
            // Se não foi fornecido campaignId, buscar da campanha ativa
            if (!campaignId) {
                const activeCampaign = await CampaignTracker.getActiveCampaign();
                if (!activeCampaign) {
                    console.warn('⚠️ Nenhuma campanha ativa encontrada para atualizar progresso');
                    return false;
                }
                campaignId = activeCampaign.campaignId || activeCampaign.id;
            }
            
            // Usar DataManager para atualizar no MongoDB
            if (window.dataManager) {
                
                // Buscar campanha atual
                const response = await window.dataManager.getAllCampaigns();
                const campaigns = response.campaigns || response; // Suportar ambas as estruturas
                const campaign = campaigns.find(c => (c.campaignId === campaignId) || (c.id === campaignId));
                
                console.log('🔍 [updateProgressGlobal] Buscando campanha:', campaignId);
                console.log('📊 [updateProgressGlobal] Total de campanhas encontradas:', campaigns.length);
                console.log('🎯 [updateProgressGlobal] Campanha encontrada:', campaign ? 'SIM' : 'NÃO');
                
                if (campaign) {
                    // Preparar apenas os campos de progresso para atualização
                    const progressUpdate = {
                        currentProgress: Math.max(campaign.currentProgress || 0, step)
                    };
                    
                    // Preparar progressSteps preservando estrutura existente
                    const existingProgressSteps = campaign.progressSteps || {
                        1: { name: 'index', completed: false, description: 'Dados básicos preenchidos na index' },
                        2: { name: 'config-campaign', completed: false, description: 'Configuração da campanha' },
                        3: { name: 'payment-generated', completed: false, description: 'Pedido gerado' },
                        4: { name: 'payment-completed', completed: false, description: 'Pagamento concluído' }
                    };
                    
                    // Marcar apenas a etapa atual como completa
                    if (existingProgressSteps[step]) {
                        existingProgressSteps[step].completed = true;
                    } else {
                        existingProgressSteps[step] = { completed: true };
                    }
                    
                    progressUpdate.progressSteps = existingProgressSteps;
                    
                    // Se for etapa 4 (pagamento), marcar como completa
                    if (step === 4) {
                        progressUpdate.isCompleted = true;
                        progressUpdate.completionTime = new Date().toISOString();
                    }
                    
                    console.log(`🔄 [GLOBAL] Atualizando apenas progresso para campanha ${campaignId}:`, progressUpdate);
                    
                    // Usar updateCampaign em vez de saveCampaign para fazer merge
                    const result = await window.dataManager.updateCampaign(campaignId, progressUpdate);
                    if (result) {
                        console.log(`📈 [GLOBAL] Etapa ${step} marcada como concluída no MongoDB para campanha ${campaignId}`);
                        return true;
                    } else {
                        console.error('❌ [GLOBAL] Erro ao salvar progresso no MongoDB');
                        return false;
                    }
                } else {
                    console.warn(`⚠️ Campanha ${campaignId} não encontrada no MongoDB`);
                    return false;
                }
            } else {
                console.warn('⚠️ DataManager não disponível para atualizar progresso');
                return false;
            }
        } catch (error) {
            console.error('❌ [GLOBAL] Erro ao atualizar progresso no MongoDB:', error);
            return false;
        }
    }
    
    static async saveCampaign(campaignData) {
        try {
            console.log('💾 [STATIC] Salvando campanha exclusivamente via MongoDB:', campaignData);
            
            // Gerar ID único se não existir
            const campaignId = campaignData.campaignId || campaignData.id || `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            campaignData.campaignId = campaignId;
            campaignData.id = campaignId;
            
            // Obter userId do sessionManager se não estiver presente nos dados
            if (!campaignData.userId && window.sessionManager && typeof window.sessionManager.getUserData === 'function') {
                const userData = window.sessionManager.getUserData();
                if (userData && userData.userId) {
                    campaignData.userId = userData.userId;
                    console.log('✅ [STATIC] UserId obtido do sessionManager:', userData.userId);
                }
            }
            
            // Garantir startTime válido
            if (!campaignData.startTime) {
                campaignData.startTime = new Date().toISOString();
            }
            
            // Usar DataManager exclusivamente para MongoDB
            if (window.dataManager) {
                console.log('💾 [STATIC] Usando DataManager para salvar no MongoDB');
                const result = await window.dataManager.saveCampaign(campaignData);
                
                if (result) {
                    console.log('💾 [STATIC] Campanha salva com sucesso no MongoDB');
                    
                    // IMPORTANTE: Definir como campanha ativa no localStorage
                    localStorage.setItem('activeCampaignId', campaignId);
                    console.log('✅ [STATIC] Campanha definida como ativa:', campaignId);
                    
                    return true;
                } else {
                    console.error('❌ [STATIC] Falha ao salvar no MongoDB via DataManager');
                    return false;
                }
            }
            
            console.error('❌ [STATIC] DataManager não disponível - não é possível salvar no MongoDB');
            return false;
        } catch (e) {
            console.error('❌ [STATIC] Erro ao salvar campanha no MongoDB:', e);
            return false;
        }
    }
    
    static clearActiveCampaign() {
        console.log('🗑️ [STATIC] Sistema agora usa apenas MongoDB - não há dados locais para limpar');
        // Método mantido para compatibilidade, mas não executa ações pois usamos apenas MongoDB
    }
}

// Exportar para uso global
window.CampaignTracker = CampaignTracker;