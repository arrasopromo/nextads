// Função para capturar parâmetros UTM da URL
function captureUTMParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = {
        utm_source: urlParams.get('utm_source') || '',
        utm_medium: urlParams.get('utm_medium') || '',
        utm_campaign: urlParams.get('utm_campaign') || '',
        utm_term: urlParams.get('utm_term') || '',
        utm_content: urlParams.get('utm_content') || ''
    };
    
    // Salvar UTMs no localStorage APENAS se houver parâmetros na URL
    if (Object.values(utmParams).some(value => value !== '')) {
        setLocalStorageItem('utm_parameters', JSON.stringify(utmParams));
        console.log('📊 Parâmetros UTM capturados da URL:', utmParams);
    } else {
        // Se não há UTMs na URL, limpar qualquer UTM salva anteriormente
        localStorage.removeItem('utm_parameters');
        console.log('🧹 UTMs removidas - nenhum parâmetro na URL');
    }
    
    return utmParams;
}

// Função para obter parâmetros UTM salvos
function getUTMParameters() {
    const savedUTMs = getLocalStorageItem('utm_parameters');
    if (savedUTMs) {
        try {
            const parsed = JSON.parse(savedUTMs);
            console.log('📊 UTMs recuperadas do localStorage:', parsed);
            return parsed;
        } catch (e) {
            console.warn('⚠️ Erro ao parsear UTMs do localStorage:', e);
            localStorage.removeItem('utm_parameters');
        }
    }
    
    // Retornar objeto vazio se não há UTMs salvas
    console.log('📊 Nenhuma UTM salva - retornando valores vazios');
    return {
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_term: '',
        utm_content: ''
    };
}

// Função para verificar disponibilidade do localStorage
function checkLocalStorageAvailability() {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

// Wrapper para localStorage.getItem com fallback
function getLocalStorageItem(key) {
    if (!checkLocalStorageAvailability()) {
        console.log(`💾 [Fallback] Tentando acessar ${key} em guia anônima`);
        return null;
    }
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn('Erro ao acessar localStorage:', e);
        return null;
    }
}

// Wrapper para localStorage.setItem com fallback
function setLocalStorageItem(key, value) {
    if (!checkLocalStorageAvailability()) {
        console.log(`💾 [Fallback] Tentando salvar ${key} em guia anônima:`, value);
        return;
    }
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
    }
}

class CampaignCreator {
    constructor() {
        
        this.selectedObjective = null;
        this.selectedDirection = null;
        this.selectedLocation = null;
        this.selectedGender = 'todos';
        this.selectedAgeMin = 18;
        this.selectedAgeMax = 65;
        this.uploadedFiles = [];
        this.municipios = [];
        this.estados = [];
        this.fileUploadConfigured = false;
        
        // Inicializar tracking de campanha
        this.campaignTracker = null;
        this.initializeCampaignTracking();
        
        // Estado para duplo clique em mobile
        this.mobileClickState = {
            objective: null,
            direction: null,
            location: null,
            gender: null,
            confirmButton: false
        };
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        

        
        this.init();
        this.setupMobileHints();
    }
    

    
    // Inicializar sistema de tracking
    initializeCampaignTracking() {
        console.log('🚀 Inicializando sistema de tracking...');
        
        // Não limpar activeCampaignId se estivermos na página payment-mobile
        if (checkLocalStorageAvailability() && !window.location.pathname.includes('payment-mobile.html')) {
            localStorage.removeItem('activeCampaignId');
            console.log('🗑️ activeCampaignId removido - nova campanha será criada');
        } else if (window.location.pathname.includes('payment-mobile.html')) {
            console.log('🔄 Preservando activeCampaignId para payment-mobile');
        }
        
        // CampaignTracker agora detecta sessão e gerencia campanhas internamente
        this.initializeCampaignTracker(null, true);
    }
    
    // Método para inicializar o CampaignTracker
    initializeCampaignTracker(campaignIdToUse, isNewSession, fileName = null) {
        if (typeof CampaignTracker !== 'undefined') {
            if (campaignIdToUse) {
                // Se há um campaignId específico, sempre reutilizar
                this.campaignTracker = new CampaignTracker(campaignIdToUse);
                console.log('✅ CampaignTracker initialized with existing campaign:', campaignIdToUse);
            } else if (fileName) {
                // Se temos um nome de arquivo e não há campanha ativa, criar nova com nome do arquivo
                this.campaignTracker = new CampaignTracker();
                this.campaignTracker.campaignId = this.campaignTracker.generateCampaignId(fileName);
                console.log('✅ CampaignTracker initialized with file name:', fileName);
            } else {
                // CampaignTracker agora detecta sessão internamente
                this.campaignTracker = new CampaignTracker();
                console.log('✅ CampaignTracker initialized successfully:', this.campaignTracker);
            }
            console.log('📝 Campaign ID being used:', this.campaignTracker.campaignId);
        } else if (typeof window.CampaignTracker !== 'undefined') {
            if (campaignIdToUse) {
                // Se há um campaignId específico, sempre reutilizar
                this.campaignTracker = new window.CampaignTracker(campaignIdToUse);
                console.log('✅ CampaignTracker initialized from window with existing campaign:', campaignIdToUse);
            } else if (fileName) {
                this.campaignTracker = new window.CampaignTracker();
                this.campaignTracker.campaignId = this.campaignTracker.generateCampaignId(fileName);
                console.log('✅ CampaignTracker initialized from window with file name:', fileName);
            } else {
                // CampaignTracker agora detecta sessão internamente
                this.campaignTracker = new window.CampaignTracker();
                console.log('✅ CampaignTracker initialized from window:', this.campaignTracker);
            }
            console.log('📝 Campaign ID being used:', this.campaignTracker.campaignId);
        } else {
            console.error('❌ CampaignTracker not available - will retry in 100ms');
            // Tentar novamente após um pequeno delay
            setTimeout(() => {
                if (typeof CampaignTracker !== 'undefined') {
                    if (campaignIdToUse) {
                        // Se há um campaignId específico, sempre reutilizar
                        this.campaignTracker = new CampaignTracker(campaignIdToUse);
                        console.log('✅ CampaignTracker initialized on retry with existing campaign:', campaignIdToUse);
                    } else if (fileName) {
                        this.campaignTracker = new CampaignTracker();
                        this.campaignTracker.campaignId = this.campaignTracker.generateCampaignId(fileName);
                        console.log('✅ CampaignTracker initialized on retry with file name:', fileName);
                    } else {
                        this.campaignTracker = new CampaignTracker();
                        console.log('✅ CampaignTracker initialized on retry:', this.campaignTracker);
                    }
                    console.log('📝 Campaign ID being used:', this.campaignTracker.campaignId);
                } else {
                    console.error('❌ CampaignTracker still not available after retry');
                }
            }, 100);
        }
        
        // Sincronizar dados existentes do localStorage apenas se não for nova sessão
        if (!isNewSession) {
            this.syncLocalStorageData();
        }
    }
    
    // Detectar se é uma nova sessão

    
    // Limpar dados de sessão anterior
    clearPreviousSessionData() {
        console.log('🗑️ Limpando dados de sessão anterior');
        
        // Se localStorage não está disponível, não há dados para limpar
        if (!checkLocalStorageAvailability()) {
            console.log('💾 [Fallback] Sem localStorage - nada para limpar');
            return;
        }
        
        // SEMPRE limpar dados de campanha para garantir nova campanha
        try {
            if (checkLocalStorageAvailability()) {
                console.log('🗑️ Limpando todos os dados de campanha para nova sessão');
                localStorage.removeItem('campaignData');
                localStorage.removeItem('activeCampaignId');
                localStorage.removeItem('campaigns');
            }
        } catch (e) {
            console.warn('Erro ao limpar dados temporários:', e);
        }
        
        // Nota: Dados de campanha agora são salvos exclusivamente no MongoDB
        // localStorage limpo para garantir nova campanha a cada acesso
        
        console.log('✅ Dados de sessão anterior limpos - nova campanha será criada');
    }
    
    // Sincronizar dados entre campaigns array e campaignData object
    syncLocalStorageData() {
        // Se localStorage não está disponível, não há dados para sincronizar
        if (!checkLocalStorageAvailability()) {
            console.log('💾 [Fallback] Sem localStorage - nada para sincronizar');
            return;
        }
        
        try {
            // Limpar dados antigos para garantir nova campanha
            console.log('🧹 Limpando dados antigos do localStorage para nova campanha');
            setLocalStorageItem('campaignData', '{}');
            console.log('✅ campaignData limpo - nova campanha será criada');
            
        } catch (error) {
            console.error('❌ Erro ao limpar dados do localStorage:', error);
        }
    }

    async init() {
        await this.loadMunicipios();
        this.populateAgeSelects();
        this.setupEventListeners();
        // Municípios carregados
    }

    async loadMunicipios() {
        try {
            console.log('🔄 Iniciando carregamento de municípios...');
            const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
            const apiUrl = '/api/municipios';
            const response = await fetch(apiUrl);
            console.log('📡 Resposta recebida:', response.status, response.statusText);

            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            if (!text) {
                throw new Error('Resposta vazia do servidor');
            }
            
            const data = JSON.parse(text);
            console.log('📊 Dados recebidos:', data ? `${data.length} municípios` : 'dados inválidos');

            
            // Verificar se é array
            if (Array.isArray(data)) {
                this.municipios = data;
                console.log('✅ Municípios carregados com sucesso:', this.municipios.length);

            } else {
                console.error('❌ Erro: dados de municípios inválidos');
                this.municipios = [];
            }
            
            this.processEstados();
            this.populateEstados();
            
        } catch (error) {
            console.warn('⚠️ API de municípios falhou, tentando fallback local:', error?.message || error);
            try {
                const localUrl = '/municipios.json';
                const localResponse = await fetch(localUrl);
                if (!localResponse.ok) {
                    throw new Error(`HTTP error! status: ${localResponse.status}`);
                }
                const localText = await localResponse.text();
                if (!localText) {
                    throw new Error('Resposta vazia do arquivo local');
                }
                const localData = JSON.parse(localText);
                if (Array.isArray(localData)) {
                    this.municipios = localData;
                    console.log('✅ Municípios carregados via fallback local:', this.municipios.length);
                    this.processEstados();
                    this.populateEstados();
                } else {
                    throw new Error('Dados locais de municípios inválidos');
                }
            } catch (fallbackError) {
                console.error('❌ Falha ao carregar municípios (API e local):', fallbackError?.message || fallbackError);
                this.municipios = [];
                this.estados = [];
            }
        }
    }

    processEstados() {
        if (!Array.isArray(this.municipios) || this.municipios.length === 0) {
            this.estados = [];
            return;
        }
        
        const estadosMap = new Map();
        
        this.municipios.forEach((municipio, index) => {
            const codigoUf = municipio.codigo_uf;
            if (!estadosMap.has(codigoUf)) {
                estadosMap.set(codigoUf, {
                    codigo: codigoUf,
                    nome: this.getEstadoNome(codigoUf),
                    ddd: municipio.ddd
                });
            }
        });
        
        this.estados = Array.from(estadosMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }

    getEstadoNome(codigoUf) {
        const estados = {
            11: 'Rondônia', 12: 'Acre', 13: 'Amazonas', 14: 'Roraima', 15: 'Pará',
            16: 'Amapá', 17: 'Tocantins', 21: 'Maranhão', 22: 'Piauí', 23: 'Ceará',
            24: 'Rio Grande do Norte', 25: 'Paraíba', 26: 'Pernambuco', 27: 'Alagoas',
            28: 'Sergipe', 29: 'Bahia', 31: 'Minas Gerais', 32: 'Espírito Santo',
            33: 'Rio de Janeiro', 35: 'São Paulo', 41: 'Paraná', 42: 'Santa Catarina',
            43: 'Rio Grande do Sul', 50: 'Mato Grosso do Sul', 51: 'Mato Grosso',
            52: 'Goiás', 53: 'Distrito Federal'
        };
        return estados[codigoUf] || 'Estado Desconhecido';
    }

    setupEventListeners() {
        // Objetivo - Adicionar suporte touch
        document.querySelectorAll('[data-option]').forEach(card => {
            card.addEventListener('click', (e) => this.handleOptionSelection(e));
            card.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleOptionSelection(e);
            });
        });

        // Direcionamento - Adicionar suporte touch
        document.querySelectorAll('.social-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleSocialSelection(e));
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleSocialSelection(e);
            });
        });

        // Instagram profile input
        const profileInput = document.getElementById('instagram-profile');
        if (profileInput) {
            profileInput.addEventListener('input', (e) => this.handleProfileInput(e));
        }

        // Validate profile button - Adicionar suporte touch
        const validateBtn = document.getElementById('validate-profile');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateProfile());
            validateBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.validateProfile();
            });
        }

        // Site URL input
        const siteInput = document.getElementById('site-url');
        if (siteInput) {
            siteInput.addEventListener('input', (e) => this.validateSiteUrl(e));
        }

        // Slider de raio/quilometragem
        const radiusSlider = document.getElementById('radius-slider');
        if (radiusSlider) {
            radiusSlider.addEventListener('input', (e) => this.handleRadiusChange(e));
        }

        // Checkbox cidade inteira
        const cidadeTodaCheckbox = document.getElementById('cidade-toda-checkbox');
        if (cidadeTodaCheckbox) {
            cidadeTodaCheckbox.addEventListener('change', (e) => this.handleCidadeTodaToggle(e));
        }

        // Estado selection (para estado específico)
        const estadoSelect = document.getElementById('estado-select');
        if (estadoSelect) {
            estadoSelect.addEventListener('change', (e) => this.handleEstadoSelection(e));
        }

        // Estado selection (para cidade específica)
        const estadoSelectCidade = document.getElementById('estado-select-cidade');
        if (estadoSelectCidade) {
            estadoSelectCidade.addEventListener('change', (e) => this.handleEstadoSelectionForCidade(e));
        }

        // Cidade search
        const cidadeSearch = document.getElementById('cidade-search');
        if (cidadeSearch) {
            cidadeSearch.addEventListener('input', (e) => this.handleCidadeSearch(e));
        }

        // Gender selection - Adicionar suporte touch
        document.querySelectorAll('.gender-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleGenderSelection(e));
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleGenderSelection(e);
            });
        });

        // Age selection
        const idadeMinima = document.getElementById('idade-minima');
        if (idadeMinima) {
            idadeMinima.addEventListener('change', (e) => this.handleAgeSelection());
        }
        const idadeMaxima = document.getElementById('idade-maxima');
        if (idadeMaxima) {
            idadeMaxima.addEventListener('change', (e) => this.handleAgeSelection());
        }

        // File upload
        this.setupFileUpload();

        // Plataformas: checkboxes e modal de informações
        const metaCheckbox = document.getElementById('platform-meta');
        const sitesCheckbox = document.getElementById('platform-sites');
        const sitesInfoIcon = document.getElementById('sites-info-icon');
        const siteInfoOverlay = document.getElementById('site-info-overlay');
        const siteInfoModal = document.getElementById('site-info-modal');
        const siteInfoClose = document.getElementById('site-info-close');
        const prevBtn = document.getElementById('site-carousel-prev');
        const nextBtn = document.getElementById('site-carousel-next');
        const siteSlides = document.querySelectorAll('.site-slide');
        let currentSiteSlide = 0;

        const showSiteSlide = (index) => {
            if (!siteSlides || siteSlides.length === 0) return;
            siteSlides.forEach(slide => slide.classList.remove('active'));
            currentSiteSlide = (index + siteSlides.length) % siteSlides.length;
            siteSlides[currentSiteSlide].classList.add('active');
        };

        const openSiteInfo = () => {
            if (siteInfoOverlay) {
                siteInfoOverlay.classList.add('active');
                siteInfoOverlay.style.display = 'flex';
                showSiteSlide(currentSiteSlide);
            }
        };

        const closeSiteInfo = () => {
            if (siteInfoOverlay) {
                siteInfoOverlay.classList.remove('active');
                siteInfoOverlay.style.display = 'none';
            }
        };

        // Atualizar tracker com seleção de plataformas
        const updatePlatformsTracking = () => {
            const platforms = {
                meta: !!(metaCheckbox && metaCheckbox.checked),
                sites: !!(sitesCheckbox && sitesCheckbox.checked)
            };
            if (this.campaignTracker && typeof this.campaignTracker.updateCampaign === 'function') {
                try {
                    this.campaignTracker.updateCampaign('platforms', platforms);
                } catch (err) {
                    console.error('❌ Erro ao atualizar plataformas no CampaignTracker:', err);
                }
            }
        };

        // Mensagem de validação quando ambas plataformas ficam desmarcadas
        const showPlatformSelectionError = () => {
            const message = 'Pelo menos uma plataforma para divulgação deve ser escolhida';
            try {
                if (window.campaignCreator && typeof window.campaignCreator.createSectionError === 'function') {
                    window.campaignCreator.createSectionError('plataformas', [message]);
                } else {
                    // Fallback simples
                    alert(message);
                }
            } catch (err) {
                console.error('❌ Erro ao exibir mensagem de plataforma:', err);
                alert(message);
            }
        };

        // Impedir que ambas plataformas fiquem desmarcadas
        const enforcePlatformSelection = (e) => {
            // Estado após a alteração do checkbox
            const metaChecked = !!(metaCheckbox && metaCheckbox.checked);
            const sitesChecked = !!(sitesCheckbox && sitesCheckbox.checked);

            if (!metaChecked && !sitesChecked) {
                // Reverter a ação: manter o último marcado
                if (e && e.target) {
                    e.target.checked = true;
                }
                showPlatformSelectionError();
            }

            // Sempre atualizar o tracker com o estado final (corrigido se necessário)
            updatePlatformsTracking();
        };

        if (metaCheckbox) metaCheckbox.addEventListener('change', enforcePlatformSelection);
        if (sitesCheckbox) sitesCheckbox.addEventListener('change', enforcePlatformSelection);
        // Salvar estado inicial (Meta vem marcado por padrão)
        updatePlatformsTracking();

        // Abrir/fechar modal de informações
        if (sitesInfoIcon) sitesInfoIcon.addEventListener('click', openSiteInfo);
        if (siteInfoClose) siteInfoClose.addEventListener('click', closeSiteInfo);
        if (siteInfoOverlay) siteInfoOverlay.addEventListener('click', (e) => {
            if (e.target === siteInfoOverlay) closeSiteInfo();
        });
        if (siteInfoModal) siteInfoModal.addEventListener('click', (e) => e.stopPropagation());

        // Navegação do carrossel
        if (prevBtn) prevBtn.addEventListener('click', () => showSiteSlide(currentSiteSlide - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => showSiteSlide(currentSiteSlide + 1));

        // Suporte a swipe no mobile
        if (siteInfoModal) {
            let startX = null;
            let lastTouchTime = 0;
            
            // Prevenir duplo toque que causa zoom
            siteInfoModal.addEventListener('touchstart', (e) => {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTouchTime;
                
                // Se for duplo toque (menos de 300ms), prevenir
                if (tapLength < 300 && tapLength > 0) {
                    e.preventDefault();
                    return false;
                }
                
                lastTouchTime = currentTime;
                startX = e.touches[0].clientX;
            }, { passive: false });
            
            siteInfoModal.addEventListener('touchend', (e) => {
                if (startX !== null) {
                    const deltaX = e.changedTouches[0].clientX - startX;
                    if (Math.abs(deltaX) > 30) {
                        if (deltaX < 0) {
                            showSiteSlide(currentSiteSlide + 1);
                        } else {
                            showSiteSlide(currentSiteSlide - 1);
                        }
                    }
                    startX = null;
                }
            }, { passive: true });
        }

        // Suporte a arraste com mouse (desktop)
        if (siteInfoModal) {
            let mouseDown = false;
            let mouseStartX = 0;

            siteInfoModal.addEventListener('mousedown', (e) => {
                mouseDown = true;
                mouseStartX = e.clientX;
            });

            siteInfoModal.addEventListener('mouseup', (e) => {
                if (!mouseDown) return;
                const deltaX = e.clientX - mouseStartX;
                if (Math.abs(deltaX) > 30) {
                    if (deltaX < 0) {
                        showSiteSlide(currentSiteSlide + 1);
                    } else {
                        showSiteSlide(currentSiteSlide - 1);
                    }
                }
                mouseDown = false;
            });

            siteInfoModal.addEventListener('mouseleave', () => {
                mouseDown = false;
            });
        }

        // Confirm button - Adicionar suporte touch e duplo clique mobile
        const confirmBtn = document.getElementById('confirm-campaign');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', (e) => this.handleConfirmClick(e));
            confirmBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleConfirmClick(e);
            });
        }
    }

    setupMobileHints() {
        // Mostrar dica apenas no mobile
        if (this.isMobile) {
            const mobileHint = document.querySelector('.mobile-hint');
            if (mobileHint) {
                mobileHint.style.display = 'block';
            }
        }
    }

    handleOptionSelection(e) {
        const card = e.currentTarget;
        const option = card.dataset.option;
        const section = card.closest('.form-section');
        const sectionTitle = section.querySelector('h2').textContent;
        
        // Remover mensagem de confirmação ao selecionar card do site
        if (option === 'site') {
            this.removeValidationConfirmation();
        }
        
        // Verificar se é mobile e implementar duplo clique
        if (this.isMobile) {
            let clickStateKey = null;
            if (sectionTitle === 'Objetivo') {
                clickStateKey = 'objective';
            } else if (sectionTitle === 'Direcionamento') {
                clickStateKey = 'direction';
            } else if (sectionTitle === 'Localização') {
                clickStateKey = 'location';
            }
            
            if (clickStateKey && this.mobileClickState[clickStateKey] === option) {
                // Segundo clique - selecionar
                this.selectOption(card, option, section, sectionTitle);
                this.mobileClickState[clickStateKey] = null;
                card.classList.remove('first-click');
            } else if (clickStateKey) {
                // Primeiro clique - destacar
                section.querySelectorAll('.option-card').forEach(c => {
                    c.classList.remove('first-click');
                });
                card.classList.add('first-click');
                this.mobileClickState[clickStateKey] = option;
                
                // Remover destaque após 3 segundos se não houver segundo clique
                setTimeout(() => {
                    if (this.mobileClickState[clickStateKey] === option) {
                        card.classList.remove('first-click');
                        this.mobileClickState[clickStateKey] = null;
                    }
                }, 3000);
            }
        } else {
            // Desktop - seleção direta
            this.selectOption(card, option, section, sectionTitle);
        }
    }
    
    selectOption(card, option, section, sectionTitle) {
        // Remove selection from siblings
        section.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
    
        if (sectionTitle === 'Objetivo') {
            this.selectedObjective = option;
            console.log('🎯 Objetivo selecionado:', option);
            
            // Inicializar CampaignTracker se não estiver disponível
            if (!this.campaignTracker) {
                console.log('🚀 Inicializando CampaignTracker para objetivo selecionado...');
                this.initializeCampaignTracker(null, false);
            }
            
            console.log('🔍 this.campaignTracker disponível?', !!this.campaignTracker);
            console.log('🔍 window.campaignCreator disponível?', !!window.campaignCreator);
            console.log('🔍 window.campaignCreator.campaignTracker disponível?', !!(window.campaignCreator && window.campaignCreator.campaignTracker));
            
            // Tracking: capturar objetivo selecionado
            if (this.campaignTracker) {
                console.log('✅ Salvando objetivo via this.campaignTracker:', option);
                this.campaignTracker.updateCampaign('objective', option);
            } else if (window.campaignCreator && window.campaignCreator.campaignTracker) {
                console.log('✅ Salvando objetivo via window.campaignCreator.campaignTracker:', option);
                window.campaignCreator.campaignTracker.updateCampaign('objective', option);
            } else {
                console.error('❌ CampaignTracker não disponível para criar campanha!');
            }
            // Bloquear/desbloquear cards de direcionamento baseado no objetivo
            this.updateDirectionAvailability(option);
        } else if (sectionTitle === 'Direcionamento') {
            this.selectedDirection = option;
            console.log('🎯 Direcionamento selecionado:', option);
            
            // Tracking: capturar direcionamento selecionado
            if (this.campaignTracker) {
                console.log('✅ Salvando direcionamento via this.campaignTracker:', option);
                this.campaignTracker.updateCampaign('direction', option);
            } else if (window.campaignCreator && window.campaignCreator.campaignTracker) {
                console.log('✅ Salvando direcionamento via window.campaignCreator.campaignTracker:', option);
                window.campaignCreator.campaignTracker.updateCampaign('direction', option);
            } else {
                console.error('❌ CampaignTracker não disponível para salvar direcionamento!');
            }
            this.toggleDirectionSections(option);
        } else if (sectionTitle === 'Localização') {
            this.selectedLocation = option;
            console.log('🎯 Localização selecionada:', option);
            
            // Se a opção for 'brasil', salvar imediatamente
            if (option === 'brasil') {
                const locationValue = 'Todo o Brasil';
                console.log('🗺️ [LOCATION-FIX] Salvando localização Brasil:', locationValue);
                
                // Tracking: capturar localização Brasil
                if (this.campaignTracker) {
                    console.log('✅ Salvando localização via this.campaignTracker:', locationValue);
                    this.campaignTracker.updateCampaign('location', locationValue);
                } else if (window.campaignCreator && window.campaignCreator.campaignTracker) {
                    console.log('✅ Salvando localização via window.campaignCreator.campaignTracker:', locationValue);
                    window.campaignCreator.campaignTracker.updateCampaign('location', locationValue);
                } else {
                    console.error('❌ CampaignTracker não disponível para salvar localização!');
                }
            }
            // Para outras opções (estado/cidade), aguardar seleção específica
            // A localização será salva quando uma cidade/estado específico for escolhido
            this.toggleLocationSections(option);
        }
    }
    
    // Nova função para gerenciar disponibilidade dos cards de direcionamento
    updateDirectionAvailability(objective) {
        const siteCard = document.querySelector('[data-option="site"]');
        const redeSocialCard = document.querySelector('[data-option="rede-social"]');
        const whatsappBtn = document.querySelector('[data-social="whatsapp"]');
        const instagramBtn = document.querySelector('[data-social="instagram"]');
        
        if (objective === 'engajamento') {
            // Bloquear card Site quando Engajamento for selecionado
            siteCard.classList.add('disabled');
            siteCard.style.opacity = '0.5';
            siteCard.style.pointerEvents = 'none';
            siteCard.style.cursor = 'not-allowed';
            
            // Se o Site estava selecionado, remover seleção e selecionar Rede Social
            if (siteCard.classList.contains('selected')) {
                siteCard.classList.remove('selected');
                redeSocialCard.classList.add('selected');
                this.selectedDirection = 'rede-social';
                this.toggleDirectionSections('rede-social');
            }
            
            // Bloquear botão WhatsApp quando Engajamento for selecionado
            if (whatsappBtn) {
                whatsappBtn.classList.add('disabled');
                whatsappBtn.style.opacity = '0.5';
                whatsappBtn.style.pointerEvents = 'none';
                whatsappBtn.style.cursor = 'not-allowed';
                whatsappBtn.title = 'WhatsApp não disponível para campanhas de engajamento';
                
                // Se WhatsApp estava selecionado, forçar seleção do Instagram
                if (whatsappBtn.classList.contains('active')) {
                    whatsappBtn.classList.remove('active');
                    if (instagramBtn) {
                        instagramBtn.classList.add('active');
                        // Simular clique no Instagram para atualizar interface
                        const event = new Event('click', { bubbles: true });
                        instagramBtn.dispatchEvent(event);
                    }
                }
            }
            
            // Adicionar tooltip explicativo
            siteCard.title = 'Opção não disponível para campanhas de engajamento';
            
        } else {
            // Desbloquear card Site para outros objetivos
            siteCard.classList.remove('disabled');
            siteCard.style.opacity = '1';
            siteCard.style.pointerEvents = 'auto';
            siteCard.style.cursor = 'pointer';
            siteCard.title = '';
            
            // Desbloquear botão WhatsApp para outros objetivos
            if (whatsappBtn) {
                whatsappBtn.classList.remove('disabled');
                whatsappBtn.style.opacity = '1';
                whatsappBtn.style.pointerEvents = 'auto';
                whatsappBtn.style.cursor = 'pointer';
                whatsappBtn.title = '';
            }
        }
    }

    toggleDirectionSections(option) {
        const instagramSection = document.getElementById('instagram-section');
        const siteSection = document.getElementById('site-section');
        
        if (option === 'rede-social') {
            instagramSection.classList.remove('hidden');
            siteSection.classList.add('hidden');
        } else if (option === 'site') {
            instagramSection.classList.add('hidden');
            siteSection.classList.remove('hidden');
        }
    }

    toggleLocationSections(option) {
        const estadoSection = document.getElementById('estado-selection');
        const cidadeSection = document.getElementById('cidade-selection');
        
        estadoSection.classList.add('hidden');
        cidadeSection.classList.add('hidden');
        
        if (option === 'estado') {
            estadoSection.classList.remove('hidden');
            // Popular estados quando a seção se torna visível
            this.populateEstadosIfNeeded();
        } else if (option === 'cidade') {
            cidadeSection.classList.remove('hidden');
            // Popular estados quando a seção se torna visível
            this.populateEstadosIfNeeded();
        }
    }

    handleSocialSelection(e) {
        const btn = e.currentTarget;
        const social = btn.dataset.social;
        
        // Remover mensagem de confirmação ao trocar de rede social
        this.removeValidationConfirmation();
        
        document.querySelectorAll('.social-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Tracking: capturar rede social selecionada
        if (this.campaignTracker) {
            this.campaignTracker.updateCampaign('direction', social);
        }
        
        const profileInput = document.getElementById('instagram-profile');
        
        if (social === 'instagram') {
            profileInput.placeholder = 'Digite seu nome de usuário ou cole o link do seu perfil';
            profileInput.type = 'text';
            profileInput.removeAttribute('maxlength');
            profileInput.value = ''; // Limpa completamente o campo
            
            // Remove máscara do WhatsApp se existir
            const cleanInput = this.removePhoneMask(profileInput);
            
            // Reaplica apenas o event listener do Instagram
            cleanInput.addEventListener('input', (e) => this.handleProfileInput(e));
            
        } else {
            profileInput.placeholder = '+55 (11) 99999-9999';
            profileInput.type = 'tel';
            profileInput.maxlength = 19;
            
            // Remove qualquer conteúdo anterior e aplica máscara do WhatsApp
            profileInput.value = ''; // Limpa primeiro
            this.applyPhoneMask(profileInput);
        }
        
        // Esconde o botão de validação ao trocar
        const validateBtn = document.getElementById('validate-profile');
        if (validateBtn) {
            validateBtn.classList.add('hidden');
        }
        
        // Esconde informações de perfil se estiverem visíveis
        const profileInfo = document.getElementById('profile-info');
        const errorDiv = document.getElementById('profile-validation-error');
        profileInfo.classList.add('hidden');
        errorDiv.classList.add('hidden');
    }
    
    handleProfileInput(e) {
        const value = e.target.value.trim();
        const validateBtn = document.getElementById('validate-profile');
        const activeSocialBtn = document.querySelector('.social-btn.active');
        
        if (!activeSocialBtn) return; // Proteção caso não tenha botão ativo
        
        const activeSocial = activeSocialBtn.dataset.social;
        
        if (activeSocial === 'instagram') {
            // Formatação automática para links do Instagram
            const formattedValue = this.formatInstagramInput(value);
            if (formattedValue !== value) {
                e.target.value = formattedValue;
            }
            
            // Tracking: capturar perfil do Instagram
            if (this.campaignTracker) {
                this.campaignTracker.updateCampaign('instagramProfile', formattedValue);
                this.campaignTracker.updateCampaign('profile', formattedValue);
            }
            
            // Mostra botão se tem conteúdo
            if (validateBtn) {
                if (formattedValue.length > 0) {
                    validateBtn.classList.remove('hidden');
                } else {
                    validateBtn.classList.add('hidden');
                }
            }
        } else if (activeSocial === 'whatsapp') {
            // Tracking: capturar perfil do WhatsApp
            if (this.campaignTracker) {
                this.campaignTracker.updateCampaign('whatsappProfile', value);
                this.campaignTracker.updateCampaign('profile', value);
            }
            
            // Para WhatsApp, verificar se tem conteúdo além do +55
            if (validateBtn) {
                if (value.length > 4) {
                    validateBtn.classList.remove('hidden');
                } else {
                    validateBtn.classList.add('hidden');
                }
            }
        }
    }
    
    // Nova função para formatar entrada do Instagram
    formatInstagramInput(input) {
        if (!input) return '';
        
        // Remove espaços
        input = input.trim();
        
        // Verifica se é um link do Instagram
        const instagramUrlRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/;
        const match = input.match(instagramUrlRegex);
        
        if (match) {
            // Extrai apenas o username do link
            return match[1];
        }
        
        // Se não é um link, retorna o input original (assumindo que é um username)
        // Remove caracteres especiais exceto underscore e ponto
        return input.replace(/[^a-zA-Z0-9_.]/g, '');
    }
    
    // Função melhorada para aplicar máscara de telefone brasileiro
    applyPhoneMask(input) {
        // Remove event listeners anteriores para evitar conflitos
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        // Define valor inicial APENAS para WhatsApp
        newInput.value = '+55 ';
        
        newInput.addEventListener('input', (e) => {
            let value = e.target.value;
            
            // Remove tudo exceto números
            let numbers = value.replace(/\D/g, '');
            
            // Se o usuário deletou o 55, restaura
            if (!numbers.startsWith('55')) {
                numbers = '55' + numbers.replace(/^55/, '');
            }
            
            // Limita a 13 dígitos (55 + 11 dígitos do número)
            numbers = numbers.substring(0, 13);
            
            // Aplica a formatação
            let formatted = '+55 ';
            const phoneDigits = numbers.substring(2); // Remove o 55
            
            if (phoneDigits.length > 0) {
                if (phoneDigits.length <= 2) {
                    // Apenas DDD
                    formatted += `(${phoneDigits}`;
                } else if (phoneDigits.length <= 7) {
                    // DDD + parte do número
                    formatted += `(${phoneDigits.substring(0, 2)}) ${phoneDigits.substring(2)}`;
                } else {
                    // Número completo
                    formatted += `(${phoneDigits.substring(0, 2)}) ${phoneDigits.substring(2, 7)}-${phoneDigits.substring(7)}`;
                }
            }
            
            e.target.value = formatted;
            
            // Chama a validação
            this.handleProfileInput(e);
        });
        
        // Previne que o usuário delete o +55
        newInput.addEventListener('keydown', (e) => {
            const cursorPosition = e.target.selectionStart;
            const value = e.target.value;
            
            if ((e.key === 'Backspace' || e.key === 'Delete')) {
                // Se está tentando deletar dentro do "+55 ", previne
                if (cursorPosition <= 4) {
                    e.preventDefault();
                    return;
                }
                
                // Se está deletando o último caractere e sobrou só "+55", mantém o espaço
                if (value.length === 5 && cursorPosition === 5) {
                    e.preventDefault();
                    e.target.value = '+55 ';
                    return;
                }
            }
            
            // Permite apenas números após o +55
            if (cursorPosition > 4 && e.key.length === 1 && !/\d/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                e.preventDefault();
            }
        });
        
        // Previne colar conteúdo inválido
        newInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            const numbers = paste.replace(/\D/g, '');
            
            if (numbers) {
                // Simula digitação dos números
                const event = new Event('input', { bubbles: true });
                newInput.value = '+55 ' + numbers;
                newInput.dispatchEvent(event);
            }
        });
        
        return newInput;
    }
    
    handleSocialSelection(e) {
        const btn = e.currentTarget;
        const social = btn.dataset.social;
        
        // Verificar se WhatsApp está bloqueado para objetivo Engajamento
        if (social === 'whatsapp' && this.selectedObjective === 'engajamento') {
            // Não permitir seleção do WhatsApp para engajamento
            return;
        }
        
        document.querySelectorAll('.social-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const profileInput = document.getElementById('instagram-profile');
        const profileLabel = document.querySelector('label[for="instagram-profile"]');
        const validateBtn = document.getElementById('validate-profile');
        const inputHint = document.querySelector('.input-hint small');
        
        if (social === 'instagram') {
            profileLabel.textContent = 'Seu perfil na rede social:';
            profileInput.placeholder = 'Digite seu nome de usuário ou cole o link do seu perfil';
            profileInput.type = 'text';
            profileInput.removeAttribute('maxlength');
            profileInput.value = '';
            
            // Atualizar texto do botão de validação
            if (validateBtn) {
                validateBtn.innerHTML = '<i class="fab fa-instagram"></i> Validar Perfil';
                validateBtn.style.backgroundColor = '';
                validateBtn.style.borderColor = '';
            }
            
            // Atualizar mensagem de dica para Instagram
            inputHint.textContent = '💡 Você pode colar o link completo do Instagram que extrairemos o usuário automaticamente';
            
            // Atualizar dica mobile para Instagram
            if (this.isMobile) {
                const mobileHintText = document.getElementById('mobile-hint-text');
                if (mobileHintText) {
                    mobileHintText.textContent = '💡 Você pode colar o link completo do Instagram que extrairemos o usuário automaticamente';
                }
            }
            
            const cleanInput = this.removePhoneMask(profileInput);
            cleanInput.addEventListener('input', (e) => this.handleProfileInput(e));
            
        } else if (social === 'whatsapp') {
            profileLabel.textContent = 'Digite seu whatsapp:';
            profileInput.placeholder = '+55 (11) 99999-9999';
            profileInput.type = 'tel';
            profileInput.maxlength = 19;
            
            // Atualizar texto do botão de validação e cor verde do WhatsApp
            if (validateBtn) {
                validateBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Validar WhatsApp';
                validateBtn.style.backgroundColor = '#25D366';
                validateBtn.style.borderColor = '#25D366';
            }
            
            // Atualizar mensagem de dica para WhatsApp
            inputHint.textContent = '💡 Caso você tenha configurado seu WhatsApp para ocultar a foto do perfil, ela não será carregada aqui.';
            
            // Atualizar dica mobile para WhatsApp
            if (this.isMobile) {
                const mobileHintText = document.getElementById('mobile-hint-text');
                if (mobileHintText) {
                    mobileHintText.textContent = '💡 Caso você tenha configurado seu WhatsApp para ocultar a foto do perfil, ela não será carregada aqui.';
                }
            }
            
            profileInput.value = '';
            this.applyPhoneMask(profileInput);
        }
        
        // Esconder o botão de validação ao trocar de rede social
        if (validateBtn) {
            validateBtn.classList.add('hidden');
        }
        
        // Esconder informações de perfil se estiverem visíveis
        const profileInfo = document.getElementById('profile-info');
        const errorDiv = document.getElementById('profile-validation-error');
        profileInfo.classList.add('hidden');
        errorDiv.classList.add('hidden');
    }
    
    handleProfileInput(e) {
        const value = e.target.value.trim();
        const validateBtn = document.getElementById('validate-profile');
        const activeSocial = document.querySelector('.social-btn.active').dataset.social;
        
        if (activeSocial === 'instagram') {
            // Formatação automática para links do Instagram
            const formattedValue = this.formatInstagramInput(value);
            if (formattedValue !== value) {
                e.target.value = formattedValue;
            }
            
            if (formattedValue.length > 0) {
                validateBtn.classList.remove('hidden');
            } else {
                validateBtn.classList.add('hidden');
            }
        } else {
            // Para WhatsApp, verificar se tem conteúdo além do +55
            if (value.length > 4) {
                validateBtn.classList.remove('hidden');
            } else {
                validateBtn.classList.add('hidden');
            }
        }
    }
    
    // Nova função para formatar entrada do Instagram
    formatInstagramInput(input) {
        if (!input) return '';
        
        // Remove espaços
        input = input.trim();
        
        // Verifica se é um link do Instagram
        const instagramUrlRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/;
        const match = input.match(instagramUrlRegex);
        
        if (match) {
            // Extrai apenas o username do link
            return match[1];
        }
        
        // Se não é um link, retorna o input original (assumindo que é um username)
        // Remove caracteres especiais exceto underscore e ponto
        return input.replace(/[^a-zA-Z0-9_.]/g, '');
    }
    
    // Função melhorada para remover máscara de telefone
    removePhoneMask(input) {
        // Cria um novo input limpo
        const newInput = input.cloneNode(true);
        newInput.value = ''; // Garante que está vazio
        newInput.removeAttribute('maxlength');
        
        // Substitui o input antigo
        input.parentNode.replaceChild(newInput, input);
        
        return newInput;
    }

    async validateProfile() {
        const activeSocial = document.querySelector('.social-btn.active')?.dataset.social;
        
        if (activeSocial === 'instagram') {
            await this.validateInstagramProfile();
        } else if (activeSocial === 'whatsapp') {
            await this.validateWhatsAppProfile();
        }
    }

    async validateInstagramProfile(retryCount = 0) {
        // Iniciando validação do perfil Instagram
        
        const profileInput = document.getElementById('instagram-profile');
        const username = profileInput.value.trim();
        const errorDiv = document.getElementById('profile-validation-error');
        const profileInfo = document.getElementById('profile-info');
        const maxRetries = 2;
        
        if (!username) {
            this.showError(errorDiv, 'Por favor, digite um nome de usuário.');
            return;
        }
    
        try {
            // Fazendo requisição para API Instagram
            const profileData = await this.fetchInstagramProfile(username);

            
            if (profileData && profileData.data && profileData.data.user) {
                this.displayInstagramProfileInfo(profileData.data.user);
                errorDiv.classList.add('hidden');
                profileInfo.classList.remove('hidden');
                
                // Tracking: capturar perfil validado
                if (this.campaignTracker) {
                    this.campaignTracker.updateCampaign('profile', username);
                }
            } else {
                // Tentar novamente se for a primeira tentativa
                if (retryCount < maxRetries) {
                    console.log(`Tentativa ${retryCount + 1} falhou, tentando novamente...`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
                    return this.validateInstagramProfile(retryCount + 1);
                }
                this.showError(errorDiv, 'Perfil não encontrado ou privado.');
                profileInfo.classList.add('hidden');
            }
        } catch (error) {
            console.error('Erro ao validar perfil Instagram:', error);
            
            // Tentar novamente se for a primeira tentativa
            if (retryCount < maxRetries) {
                console.log(`Tentativa ${retryCount + 1} falhou, tentando novamente...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
                return this.validateInstagramProfile(retryCount + 1);
            }
            
            this.showError(errorDiv, 'Erro ao validar perfil. Tente novamente.');
            profileInfo.classList.add('hidden');
        }
    }

    async validateWhatsAppProfile() {
        // Iniciando validação do perfil WhatsApp
        
        const profileInput = document.getElementById('instagram-profile');
        const phoneNumber = profileInput.value.trim();
        const errorDiv = document.getElementById('profile-validation-error');
        const profileInfo = document.getElementById('profile-info');
        

        
        if (!phoneNumber || phoneNumber.length <= 4) {
            this.showError(errorDiv, 'Por favor, digite um número de WhatsApp válido.');
            return;
        }
    
        try {
            // Fazendo requisição para API WhatsApp
            const profileData = await this.fetchWhatsAppProfile(phoneNumber);

            
            if (profileData && profileData.exists) {
                this.displayWhatsAppProfileInfo(profileData);
                errorDiv.classList.add('hidden');
                profileInfo.classList.remove('hidden');
                
                // Tracking: capturar perfil WhatsApp validado
                if (this.campaignTracker) {
                    this.campaignTracker.updateCampaign('profile', phoneNumber);
                }
            } else {
                this.showError(errorDiv, 'Número não encontrado no WhatsApp.');
                profileInfo.classList.add('hidden');
            }
        } catch (error) {
            console.error('Erro ao validar perfil WhatsApp');
            this.showError(errorDiv, 'Erro ao validar número. Tente novamente.');
            profileInfo.classList.add('hidden');
        }
    }

    async fetchInstagramProfile(username) {

        
        const response = await fetch('/api/validate-instagram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
    
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        return await response.json();
    }

    async fetchWhatsAppProfile(phoneNumber) {
        // Fazendo requisição para Evolution API
        
        const response = await fetch('/api/validate-whatsapp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber })
        });
    
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        return await response.json();
    }

    displayInstagramProfileInfo(user) {
        // Exibindo perfil
        
        // Carregar imagem do perfil
        const profileImage = document.getElementById('profile-image');
        const profileInfo = document.getElementById('profile-info');
        
        // Mostrar o card do perfil
        profileInfo.classList.remove('hidden');
        
        // Estratégia para carregar a imagem
        const loadProfileImage = () => {
            // URLs disponíveis (prioridade: HD > normal)
            const imageUrls = [
                user.profile_pic_url_hd,
                user.profile_pic_url
            ].filter(url => url && url.trim() !== '');
            
            if (imageUrls.length === 0) {
                profileImage.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&size=150&background=405de6&color=ffffff&bold=true`;
                profileImage.style.display = 'block';
                return;
            }
            
            let currentUrlIndex = 0;
            
            const tryNextUrl = () => {
                if (currentUrlIndex >= imageUrls.length) {
                    profileImage.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&size=150&background=405de6&color=ffffff&bold=true`;
                    return;
                }
                
                const currentUrl = imageUrls[currentUrlIndex];
                
                // Tentar carregar via proxy primeiro
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(currentUrl)}`;
                
                profileImage.onload = function() {
                    this.style.display = 'block';
                };
                
                profileImage.onerror = function() {
                    // Tentar URL direta
                    this.onload = function() {
                        this.style.display = 'block';
                    };
                    
                    this.onerror = function() {
                        currentUrlIndex++;
                        tryNextUrl();
                    };
                    
    
                    this.src = currentUrl;
                };
                
                profileImage.src = proxyUrl;
            };
            
            tryNextUrl();
        };
        
        // Iniciar carregamento da imagem
        loadProfileImage();
        
        // Nome de usuário com ícone de verificado
        const usernameElement = document.getElementById('profile-username');
        
        if (user.is_verified) {
            const verifiedIcon = `
                <svg width="16" height="16" viewBox="0 0 40 40" style="margin-left: 5px; vertical-align: middle;">
                    <path d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z" 
                          fill="#1DA1F2" fill-rule="evenodd"></path>
                </svg>`;
            
            usernameElement.innerHTML = `@${user.username} ${verifiedIcon}`;
        } else {
            usernameElement.textContent = `@${user.username}`;
        }
        
        // Contadores de seguidores e seguindo
        document.getElementById('followers-count').textContent = `${this.formatNumber(user.follower_count)} seguidores`;
        document.getElementById('following-count').textContent = `${this.formatNumber(user.following_count)} seguindo`;
        
        // Adicionar mensagem de confirmação visual no mobile
        this.addValidationConfirmation();
        
        // Perfil configurado
    }

    addValidationConfirmation() {
        // Função removida - não exibe mais mensagem de validação no mobile

        return;
    }
    
    removeValidationConfirmation() {
        const existingConfirmation = document.querySelector('.validation-confirmation');
        if (existingConfirmation) {
            existingConfirmation.remove();
        }
    }

    displayWhatsAppProfileInfo(profileData) {
        // Exibindo perfil WhatsApp
        
        const profileImage = document.getElementById('profile-image');
        const profileInfo = document.getElementById('profile-info');
        
        // Mostrar o card do perfil
        profileInfo.classList.remove('hidden');
        
        // Carregar imagem do perfil ou usar avatar padrão
        const loadProfileImage = () => {
            if (profileData.profilePicUrl && profileData.profilePicUrl.trim() !== '') {
                // Carregando foto do perfil WhatsApp
                
                profileImage.onload = function() {
                    // Foto carregada
                    this.style.display = 'block';
                };
                
                profileImage.onerror = function() {
        
                    this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.profileName)}&size=150&background=25D366&color=ffffff&bold=true`;
                };
                
                profileImage.src = profileData.profilePicUrl;
            } else {
                // Sem foto de perfil, usando avatar padrão
                profileImage.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.profileName)}&size=150&background=25D366&color=ffffff&bold=true`;
                profileImage.style.display = 'block';
            }
        };
        
        // Iniciar carregamento da imagem
        loadProfileImage();
        
        // Nome do usuário
        const usernameElement = document.getElementById('profile-username');
        usernameElement.innerHTML = `
            <i class="fab fa-whatsapp" style="color: #25D366; margin-right: 5px;"></i>
            ${profileData.profileName}
        `;
        
        // Informações específicas do WhatsApp
        const followersElement = document.getElementById('followers-count');
        const followingElement = document.getElementById('following-count');
        
        followersElement.innerHTML = `
            <i class="fas fa-phone" style="color: #25D366; margin-right: 5px;"></i>
            ${this.formatPhoneNumber(profileData.phoneNumber)}
        `;
        
        followingElement.innerHTML = `
            <i class="fas fa-check-circle" style="color: #25D366; margin-right: 5px;"></i>
            WhatsApp Ativo
        `;
        
        // Adicionar mensagem de confirmação visual no mobile
        this.addValidationConfirmation();
        
        // Perfil WhatsApp configurado
    }

    formatPhoneNumber(phoneNumber) {
        // Remove caracteres não numéricos
        const numbers = phoneNumber.replace(/\D/g, '');
        
        // Formatar como +55 (11) 99999-9999
        if (numbers.length >= 13) {
            const countryCode = numbers.substring(0, 2);
            const areaCode = numbers.substring(2, 4);
            const firstPart = numbers.substring(4, 9);
            const secondPart = numbers.substring(9, 13);
            return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
        }
        
        return phoneNumber; // Retorna original se não conseguir formatar
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    validateSiteUrl(e) {
        const url = e.target.value.trim();
        const errorDiv = document.getElementById('site-validation-error');
        
        if (url && !url.startsWith('https://')) {
            this.showError(errorDiv, 'A URL deve começar com https://');
        } else {
            errorDiv.classList.add('hidden');
        }
        
        // Atualizar tracking com URL do site
        if (url && this.campaignTracker) {
            this.campaignTracker.updateCampaign('siteUrl', url);
            console.log('Site URL tracked:', url);
        }
    }

    populateEstados() {
        const estadoSelect = document.getElementById('estado-select');
        const estadoSelectCidade = document.getElementById('estado-select-cidade');
        
        // Se nenhum dos elementos existe, não há nada para popular agora
        if (!estadoSelect && !estadoSelectCidade) {
            return;
        }
        
        // Limpar opções existentes (exceto a primeira) apenas se os elementos existem
        if (estadoSelect) {
            estadoSelect.innerHTML = '<option value="">Escolha um estado</option>';
        }
        if (estadoSelectCidade) {
            estadoSelectCidade.innerHTML = '<option value="">Escolha um estado</option>';
        }
        
        if (this.estados.length === 0) {
            return;
        }
        
        this.estados.forEach((estado, index) => {
            
            // Para seleção de estado específico
            if (estadoSelect) {
                const option1 = document.createElement('option');
                option1.value = estado.codigo;
                option1.textContent = estado.nome;
                estadoSelect.appendChild(option1);
            }
            
            // Para seleção de cidade específica
            if (estadoSelectCidade) {
                const option2 = document.createElement('option');
                option2.value = estado.codigo;
                option2.textContent = estado.nome;
                estadoSelectCidade.appendChild(option2);
            }
        });
        

    }
    
    populateEstadosIfNeeded() {
        const estadoSelect = document.getElementById('estado-select');
        const estadoSelectCidade = document.getElementById('estado-select-cidade');
        
        // Verificar se os elementos existem e ainda não foram populados
        const needsPopulation = (estadoSelect && estadoSelect.children.length <= 1) || 
                               (estadoSelectCidade && estadoSelectCidade.children.length <= 1);
        
        if (needsPopulation && this.estados.length > 0) {
            this.populateEstados();
        }
    }

    toggleLocationSections(option) {
        const estadoSection = document.getElementById('estado-selection');
        const cidadeSection = document.getElementById('cidade-selection');
        
        estadoSection.classList.add('hidden');
        cidadeSection.classList.add('hidden');
        
        if (option === 'estado') {
            estadoSection.classList.remove('hidden');
        } else if (option === 'cidade') {
            cidadeSection.classList.remove('hidden');
        }
    }

    handleEstadoSelectionForCidade(e) {
        const codigoUf = parseInt(e.target.value);
        console.log('🏙️ Estado selecionado para cidade:', codigoUf);
        console.log('🏙️ Total de municípios carregados:', this.municipios.length);
        
        this.estadoSelecionadoParaCidade = codigoUf;
        
        // Limpar busca de cidade quando estado mudar
        const cidadeSearch = document.getElementById('cidade-search');
        const cidadeResults = document.getElementById('cidade-results');
        const cidadeSelecionada = document.getElementById('cidade-selecionada');
        
        console.log('🏙️ Elementos encontrados:', {
            cidadeSearch: !!cidadeSearch,
            cidadeResults: !!cidadeResults,
            cidadeSelecionada: !!cidadeSelecionada
        });
        
        if (cidadeSearch) cidadeSearch.value = '';
        if (cidadeResults) cidadeResults.innerHTML = '';
        if (cidadeSelecionada) cidadeSelecionada.classList.add('hidden');
        
        if (codigoUf) {
            const cidadesDoEstado = this.municipios.filter(m => m.codigo_uf === codigoUf);
            console.log('🏙️ Cidades encontradas para o estado:', cidadesDoEstado.length);
            
            if (cidadeSearch) {
                cidadeSearch.placeholder = `Digite o nome da cidade (${cidadesDoEstado.length} opções)`;
                // Habilitar o campo de busca
                cidadeSearch.disabled = false;
                cidadeSearch.style.backgroundColor = '';
            }
        } else {
            if (cidadeSearch) {
                cidadeSearch.placeholder = 'Selecione um estado primeiro';
                cidadeSearch.disabled = true;
                cidadeSearch.style.backgroundColor = '#f5f5f5';
            }
        }
    }

    // Adicionar esta nova função para o select de estado específico
    handleEstadoSelection(e) {
        const codigoUf = parseInt(e.target.value);
        this.estadoSelecionado = codigoUf;
        
        if (codigoUf) {
            const estadoNome = this.getEstadoNome(codigoUf);
            const cidadesDoEstado = this.municipios.filter(m => m.codigo_uf === codigoUf);
            
            // Tracking: capturar estado selecionado
            if (this.campaignTracker) {
                this.campaignTracker.updateCampaign('selectedState', estadoNome);
                // Também atualizar o campo location para compatibilidade
                this.campaignTracker.updateCampaign('location', estadoNome);
                console.log('🗺️ [LOCATION-FIX] Estado selecionado:', estadoNome);
            }
            
            // Você pode adicionar aqui lógica adicional para mostrar informações do estado
            // Por exemplo, mostrar quantas cidades o estado tem
        } else {
            this.estadoSelecionado = null;
            
            // Limpar tracking do estado
            if (this.campaignTracker) {
                this.campaignTracker.updateCampaign('selectedState', null);
            }
        }
    }

    handleRadiusChange(e) {
        // Se estiver selecionado "cidade inteira", não atualizar por raio
        if (this.cidadeInteira) {
            if (this.cidadeSelecionada && this.campaignTracker) {
                // Cidade inteira: salvar apenas o nome da cidade
                const onlyCityName = this.cidadeSelecionada.nome;
                this.campaignTracker.updateCampaign('location', onlyCityName);
            }
            return;
        }
        const value = e.target.value;
        
        // Atualizar o display do valor
        const radiusValueSpan = document.getElementById('radius-value');
        const radiusTextSpan = document.getElementById('radius-text');
        
        if (radiusValueSpan) {
            radiusValueSpan.textContent = value;
        }
        
        if (radiusTextSpan) {
            radiusTextSpan.textContent = value;
        }
        
        // Salvar o valor selecionado
        this.selectedRadius = parseInt(value);
        
        // Atualizar o círculo no mapa
        if (typeof updateMapRadius === 'function') {
            updateMapRadius();
        }
        
        // IMPORTANTE: Atualizar location com o novo raio se há uma cidade selecionada
        if (this.cidadeSelecionada && this.campaignTracker) {
            const updatedCityText = `${this.cidadeSelecionada.nome} - ${this.getEstadoNome(this.cidadeSelecionada.codigo_uf)} (${value}km)`;
            this.campaignTracker.updateCampaign('location', updatedCityText);
            console.log('🔄 [RADIUS-UPDATE] location atualizado:', updatedCityText);
        }

    }

    // Alternar "cidade inteira" para esconder/mostrar raio e mapa
    handleCidadeTodaToggle(e) {
        const checked = e.target.checked;
        this.cidadeInteira = checked;

        const radiusSelection = document.querySelector('#cidade-selecionada .radius-selection');
        const mapContainer = document.querySelector('#cidade-selecionada .map-container');
        if (radiusSelection) radiusSelection.classList.toggle('hidden', checked);
        if (mapContainer) mapContainer.classList.toggle('hidden', checked);

        // Atualizar texto da localização
        if (this.cidadeSelecionada && this.campaignTracker) {
            const cidade = this.cidadeSelecionada;
            const radiusSlider = document.getElementById('radius-slider');
            const radiusKm = radiusSlider ? radiusSlider.value : '25';
            const estado = this.getEstadoNome(cidade.codigo_uf);
            const locationText = checked
                ? `${cidade.nome}`
                : `${cidade.nome} - ${estado} (${radiusKm}km)`;
            this.campaignTracker.updateCampaign('location', locationText);
        }
    }

    handleCidadeSearch(e) {
        const searchTerm = e.target.value.trim().toLowerCase();
        const resultsDiv = document.getElementById('cidade-results');
        
        console.log('🔍 Busca de cidade:', {
            searchTerm,
            termLength: searchTerm.length,
            estadoSelecionado: this.estadoSelecionadoParaCidade,
            resultsDiv: !!resultsDiv
        });
        
        if (searchTerm.length < 2) {
            if (resultsDiv) resultsDiv.innerHTML = '';
            return;
        }
        
        // Se não há estado selecionado, mostrar aviso
        if (!this.estadoSelecionadoParaCidade) {
            console.log('⚠️ Nenhum estado selecionado para busca de cidade');
            if (resultsDiv) resultsDiv.innerHTML = '<div class="cidade-item aviso">Selecione um estado primeiro</div>';
            return;
        }
        
        // Filtrar cidades do estado selecionado
        const filteredCidades = this.municipios
            .filter(cidade => 
                cidade.codigo_uf === this.estadoSelecionadoParaCidade &&
                cidade.nome.toLowerCase().includes(searchTerm)
            )
            .slice(0, 10);
        
        console.log('🏙️ Cidades filtradas:', filteredCidades.length);
        
        if (resultsDiv) resultsDiv.innerHTML = '';
        
        if (filteredCidades.length === 0) {
            console.log('❌ Nenhuma cidade encontrada para o termo:', searchTerm);
            if (resultsDiv) resultsDiv.innerHTML = '<div class="cidade-item aviso">Nenhuma cidade encontrada</div>';
            return;
        }
        
        console.log('✅ Exibindo', filteredCidades.length, 'cidades');
        filteredCidades.forEach(cidade => {
            const item = document.createElement('div');
            item.className = 'cidade-item';
            item.innerHTML = `
                <div class="cidade-nome-resultado">
                    <strong>${cidade.nome}</strong>
                    <small>DDD: ${cidade.ddd}</small>
                </div>
                <div class="cidade-coordenadas-resultado">
                    <small>Lat: ${cidade.latitude}, Lng: ${cidade.longitude}</small>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.selecionarCidade(cidade);
            });
            
            if (resultsDiv) resultsDiv.appendChild(item);
        });
    }
    
    selecionarCidade(cidade) {
        const cidadeSearch = document.getElementById('cidade-search');
        const cidadeResults = document.getElementById('cidade-results');
        const cidadeSelecionada = document.getElementById('cidade-selecionada');
        
        // Atualizar campo de busca
        cidadeSearch.value = cidade.nome;
        cidadeResults.innerHTML = '';
        
        // Mostrar informações da cidade selecionada
        cidadeSelecionada.querySelector('.cidade-nome').textContent = `${cidade.nome} - ${this.getEstadoNome(cidade.codigo_uf)}`;
        cidadeSelecionada.querySelector('.lat').textContent = cidade.latitude;
        cidadeSelecionada.querySelector('.lng').textContent = cidade.longitude;
        cidadeSelecionada.classList.remove('hidden');
        
        // Armazenar cidade selecionada
        this.cidadeSelecionada = cidade;
        
        // Tracking: capturar cidade selecionada com raio
        if (this.campaignTracker) {
            const radiusSlider = document.getElementById('radius-slider');
            const radiusKm = radiusSlider ? radiusSlider.value : '25';
            this.campaignTracker.updateCampaign('location', `${cidade.nome} - ${this.getEstadoNome(cidade.codigo_uf)} (${radiusKm}km)`);
        }
        
        // Mostrar e inicializar o mapa
        if (typeof showMapWhenCitySelected === 'function') {
            showMapWhenCitySelected();
        }
        
        // Atualizar o mapa com a nova cidade
        setTimeout(() => {
            if (typeof geocodeCity === 'function') {
                const estadoNome = this.getEstadoNome(cidade.codigo_uf);
                geocodeCity(cidade.nome, estadoNome, cidade.latitude, cidade.longitude);
            }
        }, 500);
    }

    handleGenderSelection(e) {
        const btn = e.currentTarget;
        const gender = btn.dataset.gender;
        
        // Verificar se é mobile e implementar duplo clique
        if (this.isMobile) {
            if (this.mobileClickState.gender === gender) {
                // Segundo clique - selecionar
                this.selectGender(btn, gender);
                this.mobileClickState.gender = null;
                btn.classList.remove('first-click');
            } else {
                // Primeiro clique - destacar
                document.querySelectorAll('.gender-btn').forEach(b => {
                    b.classList.remove('first-click');
                });
                btn.classList.add('first-click');
                this.mobileClickState.gender = gender;
                
                // Remover destaque após 3 segundos se não houver segundo clique
                setTimeout(() => {
                    if (this.mobileClickState.gender === gender) {
                        btn.classList.remove('first-click');
                        this.mobileClickState.gender = null;
                    }
                }, 3000);
            }
        } else {
            // Desktop - seleção direta
            this.selectGender(btn, gender);
        }
    }
    
    selectGender(btn, gender) {
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.selectedGender = gender;
        
        // Tracking: capturar gênero selecionado
        if (this.campaignTracker) {
            this.campaignTracker.updateCampaign('gender', gender);
        }
    }

    populateAgeSelects() {
        const minSelect = document.getElementById('idade-minima');
        const maxSelect = document.getElementById('idade-maxima');
        
        if (!minSelect || !maxSelect) {

            return;
        }
        
        for (let age = 18; age <= 65; age++) {
            const minOption = document.createElement('option');
            minOption.value = age;
            minOption.textContent = age === 65 ? '65+' : age;
            minSelect.appendChild(minOption);
            
            const maxOption = document.createElement('option');
            maxOption.value = age;
            maxOption.textContent = age === 65 ? '65+' : age;
            maxSelect.appendChild(maxOption);
        }
        
        minSelect.value = 18;
        maxSelect.value = 65;
        
        // Atualizar as propriedades da classe com os valores iniciais
        this.handleAgeSelection();

        // Adicionar validação em tempo real
        minSelect.addEventListener('change', () => {
            const minAge = parseInt(minSelect.value);
            const maxAge = parseInt(maxSelect.value);
            
            if (minAge > maxAge) {
                maxSelect.value = minAge;
            }
            this.handleAgeSelection();
        });
        
        maxSelect.addEventListener('change', () => {
            const minAge = parseInt(minSelect.value);
            const maxAge = parseInt(maxSelect.value);
            
            if (maxAge < minAge) {
                minSelect.value = maxAge;
            }
            this.handleAgeSelection();
        });
    }

    handleAgeSelection() {
        const minAge = parseInt(document.getElementById('idade-minima').value);
        const maxAge = parseInt(document.getElementById('idade-maxima').value);
        
        if (minAge > maxAge) {
            // Corrigir automaticamente ajustando a idade máxima
            document.getElementById('idade-maxima').value = minAge;
            this.selectedAgeMax = minAge;
            this.selectedAgeMin = minAge;
        } else {
            this.selectedAgeMin = minAge;
            this.selectedAgeMax = maxAge;
        }
        
        // Tracking: registrar seleção de faixa etária
        if (this.campaignTracker) {
            const ageGroup = `${minAge} - ${maxAge} anos`;
            this.campaignTracker.updateCampaign('ageGroup', ageGroup);
            this.campaignTracker.updateCampaign('age', ageGroup);
            this.campaignTracker.addCompletedStep('age_selection');
        }
    }

    setupFileUpload() {
        // Verificar se já foi configurado para evitar duplicação
        if (this.fileUploadConfigured) {
            // setupFileUpload já foi configurado, pulando...
            return;
        }
        
        // Configurando upload de arquivos...
        this.fileUploadConfigured = true;
        
        const uploadZone = document.getElementById('upload-zone');
        const selectFilesBtn = document.getElementById('select-files-btn');
        const imageUpload = document.getElementById('image-upload');
        const videoUpload = document.getElementById('video-upload');
        
        // Upload cards - Corrigir duplo disparo em mobile
        if (imageUpload && videoUpload) {
            document.querySelectorAll('.upload-card').forEach(card => {
                const handleUploadClick = (e) => {
                    const type = e.currentTarget.dataset.type;
                    if (type === 'imagens') {
                        imageUpload.click();
                    } else {
                        videoUpload.click();
                    }
                };
                
                // Usar apenas touch events em mobile para evitar duplo disparo
                if (this.isMobileDevice()) {
                    card.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUploadClick(e);
                    });
                } else {
                    card.addEventListener('click', handleUploadClick);
                }
            });
        }
        
        // Drag and drop - apenas para desktop
        if (uploadZone && !this.isMobileDevice()) {
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });
            
            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('dragover');
            });
            
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                this.handleFiles(e.dataTransfer.files);
            });
        } else if (uploadZone && this.isMobileDevice()) {
            // Bloquear completamente drag and drop em mobile
            ['dragstart', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(eventType => {
                uploadZone.addEventListener(eventType, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }, { passive: false });
            });
        }
        
        // Click to select - Corrigir duplo disparo em mobile
        if (selectFilesBtn) {
            const handleSelectFiles = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = false;
                input.accept = 'image/*,video/*';
                input.addEventListener('change', (e) => {
                    this.handleFiles(e.target.files);
                });
                input.click();
            };
            
            // Usar apenas touch events em mobile para evitar duplo disparo
            if (this.isMobileDevice()) {
                selectFilesBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectFiles();
                });
            } else {
                selectFilesBtn.addEventListener('click', handleSelectFiles);
            }
        }
        
        // File inputs
        if (imageUpload) {
            imageUpload.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }

        if (videoUpload) {
            videoUpload.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }
    }

    async handleFiles(files) {
        // Verificar se há arquivos válidos
        if (!files || files.length === 0) {
            return;
        }
        
        // Se já existe arquivo, remover automaticamente para permitir substituição
        if (this.uploadedFiles.length > 0) {
            this.clearAllFiles();
        }
        
        // Processar apenas o primeiro arquivo
        const file = files[0];
        
        // Verificar se o arquivo é válido antes de prosseguir
        if (!file || !file.name || file.name === '') {
            return;
        }
        
        if (file && await this.validateFile(file)) {
            try {
                let fileToUpload = file;
                
                // Verificar se é vídeo para compressão de preview
                const isVideo = file.type.startsWith('video/');
                if (isVideo) {
                    try {
                        console.log('🎥 Processando vídeo para otimização...');
                        const compressionResult = await this.compressVideoForPreview(file);
                        
                        // Usar arquivo original para upload (compressão é só para preview)
                        fileToUpload = compressionResult.originalFile;
                        
                        if (compressionResult.previewBlob) {
                            console.log('✅ Preview de vídeo gerado com sucesso');
                        }
                    } catch (error) {
                        console.log('⚠️ Erro na otimização de vídeo, usando arquivo original:', error);
                        fileToUpload = file;
                    }
                }
                
                // Enviar arquivo para o backend para processamento (incluindo conversão HEIC)
                const processedFile = await this.uploadFileToServer(fileToUpload);
                
                // Para vídeos, usar o arquivo original para display
                // Para imagens, tentar otimizar (exceto HEIC que já foi convertido no servidor)
                let displayFile = file;
                
                if (processedFile.type && processedFile.type.startsWith('image/')) {
                    // Verificar se é arquivo HEIC original
                    const isHEIC = file.name.toLowerCase().endsWith('.heic') || 
                                  file.name.toLowerCase().endsWith('.heif') ||
                                  file.type === 'image/heic' || 
                                  file.type === 'image/heif';
                    
                    if (isHEIC) {
                        // Para arquivos HEIC, usar o arquivo convertido do servidor
                        console.log('📸 Arquivo HEIC detectado, usando versão convertida do servidor');
                        displayFile = file; // Usar arquivo original, pois o servidor já converteu
                    } else {
                        try {
                            // Iniciando otimização da imagem para visualização...
                            displayFile = await this.optimizeImage(file);
                            // Imagem otimizada para visualização
                        } catch (error) {
                            console.error('❌ Erro na otimização da imagem:', error);
                            // Usar arquivo original se a otimização falhar
                            displayFile = file;
                        }
                    }
                }
                // Para vídeos, usar arquivo original diretamente
                
                // Verificar se é o primeiro arquivo e se deve usar nome do arquivo como ID
                const isFirstFile = this.uploadedFiles.length === 0;
                const activeCampaignId = getLocalStorageItem('activeCampaignId');
                
                // Se é o primeiro arquivo e não há CampaignTracker inicializado, inicializar
                if (isFirstFile && !this.campaignTracker) {
                    if (activeCampaignId) {
                        console.log('🔄 Primeiro arquivo carregado - reutilizando campanha existente:', activeCampaignId);
                        this.initializeCampaignTracker(activeCampaignId);
                    } else {
                        console.log('🆔 Primeiro arquivo carregado - criando nova campanha com base no nome:', processedFile.name);
                        this.initializeCampaignTracker(null, false, processedFile.name);
                        // Atualizar o activeCampaignId no localStorage
                        setLocalStorageItem('activeCampaignId', this.campaignTracker.campaignId);
                    }
                }
                
                // Adicionando arquivo à lista e exibindo...
                this.uploadedFiles.push(processedFile);
                
                // Para arquivos HEIC, passar informações do servidor para o display
                if (displayFile.name && (displayFile.name.toLowerCase().endsWith('.heic') || displayFile.name.toLowerCase().endsWith('.heif'))) {
                    displayFile.processedFile = processedFile;
                }
                
                this.displayUploadedFile(displayFile);
                document.getElementById('uploaded-files').classList.remove('hidden');
                
                // Tracking: registrar upload de arquivo
                if (this.campaignTracker) {
                    this.campaignTracker.updateCampaign('filesUploaded', this.uploadedFiles.length);
                    this.campaignTracker.updateCampaign('uploadedFiles', this.uploadedFiles);
                    this.campaignTracker.addCompletedStep('file_upload');
                    console.log('Files tracked:', this.uploadedFiles.length, 'files');
                }
                
            } catch (error) {
                console.error('❌ Erro no processamento do arquivo:', error);
                alert('Erro ao processar arquivo: ' + error.message);
            }
        } else {
            // Arquivo não passou na validação
        }
    }

    async uploadFileToServer(file) {
        return new Promise((resolve, reject) => {
            // Iniciando upload para o servidor...
            
            const formData = new FormData();
            formData.append('files', file);
            
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    // Upload progress
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success && response.files && response.files.length > 0) {
                            const uploadedFile = response.files[0];
                            // Upload concluído com sucesso
                            
                            // Remover barra de progresso após upload bem-sucedido
                            const progressContainer = document.querySelector('.upload-progress-container');
                            if (progressContainer) {
                                // Mostrar "Concluído!" por 2 segundos antes de remover
                                const progressText = progressContainer.querySelector('.upload-progress-text');
                                if (progressText) {
                                    progressText.textContent = 'Upload concluído!';
                                    progressText.style.color = '#22543d';
                                }
                                
                                setTimeout(() => {
                                    progressContainer.remove();
                                }, 2000);
                            }
                            
                            // Criar objeto compatível com o formato esperado
                            const processedFile = {
                                name: uploadedFile.originalName,
                                size: uploadedFile.size,
                                type: uploadedFile.mimetype,
                                url: uploadedFile.url,
                                filename: uploadedFile.filename,
                                converted: uploadedFile.converted || false,
                                originalFormat: uploadedFile.originalFormat || null
                            };
                            
                            console.log('🔍 [DEBUG] Arquivo processado do servidor:', {
                                originalName: uploadedFile.originalName,
                                mimetype: uploadedFile.mimetype,
                                filename: uploadedFile.filename,
                                processedFile: processedFile
                            });
                            
                            resolve(processedFile);
                        } else {
                            reject(new Error('Resposta inválida do servidor'));
                        }
                    } catch (error) {
                        reject(new Error('Erro ao processar resposta do servidor: ' + error.message));
                    }
                } else {
                    // Remover barra de progresso em caso de erro HTTP
                    const progressContainer = document.querySelector('.upload-progress-container');
                    if (progressContainer) {
                        progressContainer.remove();
                    }
                    reject(new Error(`Erro no upload: ${xhr.status} - ${xhr.statusText}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                // Remover barra de progresso em caso de erro de rede
                const progressContainer = document.querySelector('.upload-progress-container');
                if (progressContainer) {
                    progressContainer.remove();
                }
                reject(new Error('Erro de rede durante o upload'));
            });
            
            xhr.addEventListener('timeout', () => {
                // Remover barra de progresso em caso de timeout
                const progressContainer = document.querySelector('.upload-progress-container');
                if (progressContainer) {
                    progressContainer.remove();
                }
                reject(new Error('Timeout durante o upload'));
            });
            
            // PROGRESS FEEDBACK MELHORADO - Mostrar progresso real do upload
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    console.log(`📤 Upload progress: ${percentComplete.toFixed(2)}%`);
                    
                    // Criar ou atualizar barra de progresso visual
                    let progressContainer = document.querySelector('.upload-progress-container');
                    if (!progressContainer) {
                        progressContainer = document.createElement('div');
                        progressContainer.className = 'upload-progress-container';
                        progressContainer.innerHTML = `
                            <div class="upload-progress-bar">
                                <div class="upload-progress-fill"></div>
                            </div>
                            <div class="upload-progress-text">Enviando... 0%</div>
                        `;
                        document.body.appendChild(progressContainer);
                        
                        // Adicionar estilos CSS inline
                        const style = document.createElement('style');
                        style.textContent = `
                            .upload-progress-container {
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                background: white;
                                padding: 15px;
                                border-radius: 8px;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                                z-index: 10000;
                                min-width: 250px;
                            }
                            .upload-progress-bar {
                                width: 100%;
                                height: 8px;
                                background: #f0f0f0;
                                border-radius: 4px;
                                overflow: hidden;
                                margin-bottom: 8px;
                            }
                            .upload-progress-fill {
                                height: 100%;
                                background: linear-gradient(90deg, #4CAF50, #45a049);
                                transition: width 0.3s ease;
                                width: 0%;
                            }
                            .upload-progress-text {
                                font-size: 14px;
                                color: #333;
                                text-align: center;
                            }
                        `;
                        document.head.appendChild(style);
                    }
                    
                    // Atualizar progresso visual
                    const progressFill = progressContainer.querySelector('.upload-progress-fill');
                    const progressText = progressContainer.querySelector('.upload-progress-text');
                    
                    if (progressFill && progressText) {
                        progressFill.style.width = `${percentComplete}%`;
                        progressText.textContent = `Enviando... ${Math.round(percentComplete)}%`;
                    }
                }
            });
            
            xhr.timeout = 120000; // 2 minutos - TIMEOUT AUMENTADO PARA VÍDEOS GRANDES
            xhr.open('POST', '/api/upload');
            xhr.send(formData);
        });
    }

    async loadHeic2Any() {
        // Método mantido para compatibilidade, mas não mais usado
        // loadHeic2Any chamado, mas conversão HEIC agora é feita no servidor
        return Promise.resolve();
    }

    async convertHeicToJpg(file) {
        // Método mantido para compatibilidade, mas conversão HEIC agora é feita no servidor
        // convertHeicToJpg chamado, mas conversão HEIC agora é feita no servidor
        return file;
    }

    // COMPRESSÃO DE VÍDEO NO FRONTEND - Para otimização e preview
    async compressVideoForPreview(file) {
        return new Promise((resolve) => {
            // Esta compressão é apenas para preview/otimização, não afeta o arquivo original
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let objectURL = null;
            
            const cleanup = () => {
                if (objectURL) {
                    URL.revokeObjectURL(objectURL);
                    objectURL = null;
                }
            };
            
            video.onloadedmetadata = () => {
                // Reduzir resolução para preview (máximo 720p)
                const maxWidth = 1280;
                const maxHeight = 720;
                
                let { videoWidth, videoHeight } = video;
                
                // Calcular nova resolução mantendo proporção
                if (videoWidth > maxWidth || videoHeight > maxHeight) {
                    const ratio = Math.min(maxWidth / videoWidth, maxHeight / videoHeight);
                    videoWidth *= ratio;
                    videoHeight *= ratio;
                }
                
                canvas.width = videoWidth;
                canvas.height = videoHeight;
                
                // Capturar frame para thumbnail
                video.currentTime = 1; // 1 segundo do vídeo
            };
            
            video.onseeked = () => {
                try {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // Converter para blob com qualidade reduzida (apenas para preview)
                    canvas.toBlob((blob) => {
                        console.log(`🎥 Vídeo otimizado para preview: ${file.size} → ${blob?.size || 'N/A'} bytes`);
                        
                        // Limpar recursos
                        cleanup();
                        
                        // Retornar arquivo original (não comprimido) para upload real
                        // A compressão é apenas para preview/thumbnail
                        resolve({
                            originalFile: file, // Arquivo original para upload
                            previewBlob: blob,  // Blob comprimido apenas para preview
                            compressed: false   // Indica que o upload será do arquivo original
                        });
                    }, 'image/jpeg', 0.7);
                } catch (error) {
                    console.log('⚠️ Erro ao processar frame do vídeo:', error);
                    cleanup();
                    resolve({
                        originalFile: file,
                        previewBlob: null,
                        compressed: false
                    });
                }
            };
            
            video.onerror = (error) => {
                console.log('⚠️ Erro na compressão de vídeo:', error);
                cleanup();
                resolve({
                    originalFile: file,
                    previewBlob: null,
                    compressed: false
                });
            };
            
            // Timeout para evitar travamento
            const timeout = setTimeout(() => {
                console.log('⚠️ Timeout na compressão de vídeo');
                cleanup();
                resolve({
                    originalFile: file,
                    previewBlob: null,
                    compressed: false
                });
            }, 10000); // 10 segundos
            
            try {
                // Usar URL.createObjectURL para carregar o vídeo
                objectURL = URL.createObjectURL(file);
                video.src = objectURL;
                video.load();
                
                // Limpar timeout quando o processamento for concluído
                const originalResolve = resolve;
                resolve = (result) => {
                    clearTimeout(timeout);
                    originalResolve(result);
                };
                
            } catch (error) {
                console.log('⚠️ Erro ao criar object URL:', error);
                clearTimeout(timeout);
                resolve({
                    originalFile: file,
                    previewBlob: null,
                    compressed: false
                });
            }
        });
    }

    async validateFile(file) {
        // Validando arquivo
        
        const maxImageSize = 10 * 1024 * 1024; // 10MB
        const maxVideoSize = 500 * 1024 * 1024; // 500MB
        
        // Obter extensão do arquivo
        const fileName = file.name.toLowerCase();
        const fileExtension = fileName.split('.').pop();
        
        // Nome do arquivo e extensão obtidos
        
        // Extensões de imagem suportadas
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'webp', 'dng'];
        // Extensões de vídeo suportadas
        const videoExtensions = ['mp4', 'mov', 'avi', 'webm', '3gp', 'mkv', 'ts'];
        
        // Verificar se é HEIC original (não convertido)
        const isHEIC = (fileExtension === 'heic' || fileExtension === 'heif' || fileExtension === 'HEIC' || fileExtension === 'HEIF') && 
                       !file.type.startsWith('image/jpeg');
        const isImage = file.type.startsWith('image/') || imageExtensions.includes(fileExtension) || 
                       file.type === 'image/heic' || file.type === 'image/heif' || file.type === 'image/heic-sequence';
        const isVideo = file.type.startsWith('video/') || videoExtensions.includes(fileExtension);
        
        // Verificações de tipo de arquivo
        
        if (isImage) {
            // Arquivo é uma imagem
            if (file.size > maxImageSize) {
                // Imagem muito grande
                alert('Imagem muito grande. Máximo 10MB.');
                return false;
            }
            // Tamanho da imagem OK
            
        } else if (isVideo) {
            // Arquivo é um vídeo
            if (file.size > maxVideoSize) {
                // Vídeo muito grande
                alert('Vídeo muito grande. Máximo 500MB.');
                return false;
            }
            // Tamanho do vídeo OK
            
            // Validação de proporção removida - aceita qualquer proporção de vídeo
            
        } else {
            // Tipo de arquivo não suportado
            alert('Tipo de arquivo não suportado. Formatos aceitos: JPG, PNG, HEIC, WebP, DNG, MP4, MOV, AVI, WEBM, 3GP, MKV, TS.');
            return false;
        }
        
        // Arquivo validado com sucesso
        return true;
    }

    // Validar proporção 9:16 para imagens
    validateImageAspectRatio(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const aspectRatio = this.width / this.height;
                const targetRatio = 9 / 16;
                const tolerance = 0.05; // 5% de tolerância
                
                const isValid = Math.abs(aspectRatio - targetRatio) <= tolerance;
                URL.revokeObjectURL(img.src);
                resolve(isValid);
            };
            img.onerror = function() {
                URL.revokeObjectURL(img.src);
                resolve(false);
            };
            img.src = URL.createObjectURL(file);
        });
    }

    // Função de validação de proporção de vídeo removida

    // Função para redimensionar e otimizar imagem
    // Função para converter HEIC para JPG usando heic2any


    async optimizeImage(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = function() {
                try {
                    // Definir dimensões para 9:16 com qualidade otimizada
                    const maxWidth = 1080;
                    const maxHeight = 1920;
                    
                    let { width, height } = img;
                    
                    // Redimensionar mantendo a proporção 9:16
                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width *= ratio;
                        height *= ratio;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Aplicar filtros para melhorar qualidade
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const optimizedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            URL.revokeObjectURL(img.src);
                            resolve(optimizedFile);
                        } else {
                            console.error('Falha ao gerar blob da imagem');
                            URL.revokeObjectURL(img.src);
                            resolve(file); // Retorna arquivo original em caso de erro
                        }
                    }, 'image/jpeg', 0.9); // 90% de qualidade
                } catch (error) {
                    console.error('Erro na otimização da imagem:', error);
                    URL.revokeObjectURL(img.src);
                    resolve(file); // Retorna arquivo original em caso de erro
                }
            };
            
            img.onerror = function() {
                console.error('Erro ao carregar imagem para otimização');
                URL.revokeObjectURL(img.src);
                resolve(file); // Retorna arquivo original em caso de erro
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    displayUploadedFile(file) {
        // INICIANDO displayUploadedFile
        
        const uploadedFilesDiv = document.getElementById('uploaded-files');
        // Container uploaded-files encontrado
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.style.background = 'transparent';
        fileItem.style.backgroundColor = 'transparent';
        
        // Criar preview do arquivo - usar mesma lógica da validação
        const fileName = file.name.toLowerCase();
        const fileExtension = fileName.split('.').pop();
        
        // Extensões de imagem suportadas
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'webp', 'dng'];
        // Extensões de vídeo suportadas
        const videoExtensions = ['mp4', 'mov', 'avi', 'webm', '3gp', 'mkv', 'ts'];
        
        // Arquivos HEIC podem não ter MIME type correto, forçar detecção por extensão
        const isHEIC = fileExtension === 'heic' || fileExtension === 'heif' || fileExtension === 'HEIC' || fileExtension === 'HEIF';
        const isImage = file.type.startsWith('image/') || imageExtensions.includes(fileExtension) || isHEIC || 
                       file.type === 'image/heic' || file.type === 'image/heif' || file.type === 'image/heic-sequence';
        const isVideo = file.type.startsWith('video/') || videoExtensions.includes(fileExtension);
        

        
        // Criar preview visual - definir variáveis comuns primeiro
        const formatFileSize = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        // Tamanho responsivo: mobile usa viewport, desktop usa tamanho fixo
        const isMobile = window.innerWidth <= 768;
        const containerWidth = isMobile ? 'min(90vw, 400px)' : '338px';
        const containerHeight = isMobile ? 'min(calc(90vw * 16/9), calc(400px * 16/9))' : '601px';
        
        let previewHTML = '';
        
        if (isImage) {
            // Preview de imagem usando FileReader para base64
            // Processando imagem
            
            // Verificação especial para arquivos HEIC convertidos
            if (isHEIC && file.processedFile && file.processedFile.url) {
                // Arquivo HEIC convertido - usar URL do servidor
                console.log('📸 Usando URL do servidor para HEIC convertido:', file.processedFile.url);
                
                previewHTML = `
                    <div style="position: relative; width: ${containerWidth}; height: ${containerHeight}; border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 auto; background: white;">
                        <div class="image-placeholder" style="width: 100%; height: 100%; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #666; text-align: center; padding: 0; box-sizing: border-box;">
                            <i class="fas fa-image" style="font-size: 32px; margin-bottom: 8px;"></i>
                            <div style="font-size: 12px;">Carregando HEIC...</div>
                        </div>
                        <button class="remove-file" data-filename="${file.name}" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;">
                            <i class="fas fa-trash" style="font-size: 12px;"></i>
                        </button>
                    </div>
                `;
                
                // Definir HTML primeiro
                fileItem.innerHTML = previewHTML;
                
                // Agora acessar o elemento que já existe no DOM
                const previewContainer = fileItem.querySelector('.image-placeholder');
                if (previewContainer) {
                    const img = document.createElement('img');
                    img.src = file.processedFile.url;
                    img.alt = 'Preview';
                    img.className = 'file-preview-image';
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; background: none;';
                    
                    img.addEventListener('load', function() {
                        console.log('✅ HEIC convertido carregado com sucesso');
                        previewContainer.innerHTML = '';
                        previewContainer.appendChild(img);
                    });
                    
                    img.addEventListener('error', function() {
                        console.error('❌ Erro ao carregar HEIC convertido do servidor');
                        // Fallback para ícone
                        previewContainer.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; text-align: center;"><i class="fas fa-image" style="font-size: 32px; margin-bottom: 8px;"></i><div style="font-size: 12px;">HEIC</div></div>`;
                    });
                }
                
                // Adicionar ao container e sair da função
                uploadedFilesDiv.appendChild(fileItem);
                return;
            }
            
            // Processar imagem diretamente com FileReader (para não-HEIC)
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64Url = e.target.result;
                // Base64 criado
                
                const previewContainer = fileItem.querySelector('.image-placeholder');
                if (previewContainer) {
                    previewContainer.innerHTML = ''; // Limpar conteúdo anterior
                    
                    // Tentar carregar preview para imagens não-HEIC
                    const img = document.createElement('img');
                    img.src = base64Url;
                    img.alt = 'Preview';
                    img.className = 'file-preview-image';
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; background: none;';
                    
                    img.addEventListener('load', function() {
                        // Imagem carregada com sucesso
                    });
                    
                    img.addEventListener('error', function() {
                        console.error('❌ Erro ao carregar imagem');
                        console.error('📋 Detalhes do erro:', {
                            fileName: file.name,
                            fileType: file.type,
                            isHEIC: isHEIC,
                            base64Length: base64Url ? base64Url.length : 'N/A'
                        });
                        
                        // Para arquivos HEIC que falharam, mostrar ícone
                        if (isHEIC) {
                            this.parentElement.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; text-align: center;"><i class="fas fa-image" style="font-size: 32px; margin-bottom: 8px;"></i><div style="font-size: 12px;">HEIC</div></div>`;
                        } else {
                            this.style.display = 'none';
                            this.parentElement.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; text-align: center;"><i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i><div>Erro ao carregar imagem</div></div>`;
                        }
                    });
                    
                    previewContainer.appendChild(img);
                    

                }
            };
            reader.onerror = function() {
                // Erro ao ler arquivo como base64
                const previewContainer = fileItem.querySelector('.image-placeholder');
                if (previewContainer) {
                    previewContainer.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; text-align: center;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                            <div>Erro ao processar imagem</div>
                        </div>
                    `;
                }
            };
            reader.readAsDataURL(file);
            
            previewHTML = `
                <div style="position: relative; width: ${containerWidth}; height: ${containerHeight}; border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 auto; background: white;">
                    <div class="image-placeholder" style="width: 100%; height: 100%; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #666; text-align: center; padding: 0; box-sizing: border-box;">
                        <div style="background: rgba(102, 126, 234, 0.1); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                            <i class="fas fa-image" style="font-size: 24px;"></i>
                        </div>
                        <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; word-break: break-word; line-height: 1.2;">
                            ${file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name}
                        </div>
                        <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                            ${fileExtension.toUpperCase()} • ${formatFileSize(file.size)}
                        </div>
                        <div style="font-size: 10px; opacity: 0.7;">
                            Arquivo de imagem
                        </div>
                    </div>
                    <button class="remove-file" data-filename="${file.name}" style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 100;">
                        <i class="fas fa-trash" style="color: #dc3545; font-size: 12px;"></i>
                    </button>
                </div>
            `;
            // HTML placeholder criado, aguardando base64...
        } else if (isVideo) {
            // Preview de vídeo usando FileReader para gerar thumbnail
            // Processando vídeo
            
            previewHTML = `
                <div style="position: relative; width: ${containerWidth}; height: ${containerHeight}; border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 auto; background: white;">
                    <div class="video-placeholder" style="width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #666; flex-direction: column;">
                        <i class="fas fa-video" style="font-size: 48px; margin-bottom: 10px; color: #999;"></i>
                        <div>Gerando thumbnail...</div>
                    </div>
                    <button class="remove-file" data-filename="${file.name}" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 100;">
                        <i class="fas fa-trash" style="font-size: 12px;"></i>
                    </button>
                </div>
            `;
            
        }
        
        // Definindo innerHTML do fileItem...
        fileItem.innerHTML = previewHTML;
        // Adicionando fileItem ao container...
        uploadedFilesDiv.appendChild(fileItem);
        
        // Gerar thumbnail real para vídeo APÓS adicionar ao DOM
        if (isVideo) {
            const self = this;
            setTimeout(() => {
                self.generateVideoThumbnail(fileItem, file);
            }, 100);
        }
        
        // Verificar se a imagem foi criada corretamente
        if (isImage) {
            const img = fileItem.querySelector('.file-preview-image');
        }
        
        // Adicionar event listener para o botão de remoção
        const removeBtn = fileItem.querySelector('.remove-file');
        if (removeBtn) {
            const handleRemove = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const filename = removeBtn.getAttribute('data-filename');
                this.removeFile(filename);
            };
            
            // Adicionar suporte touch para mobile
            if (this.isMobileDevice()) {
                removeBtn.addEventListener('touchend', handleRemove);
            } else {
                removeBtn.addEventListener('click', handleRemove);
            }
        }
        
        // Preview para vídeo já foi configurado no setTimeout acima
    }

    generateVideoThumbnail(fileItem, file) {
        console.log('🚀 [THUMBNAIL] Iniciando geração de thumbnail para:', file.name);
        
        // Validar se o file é um objeto File/Blob válido
        if (!file || !(file instanceof File) || !file.name) {
            console.log('❌ [THUMBNAIL] Arquivo inválido, usando preview simples');
            this.generateSimpleVideoPreview(fileItem, file);
            return;
        }
        
        const fileExtension = file.name.split('.').pop();
        
        const formatFileSize = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        const placeholder = fileItem.querySelector('.video-placeholder');
        console.log('🔍 [THUMBNAIL] Buscando placeholder:', placeholder);
        if (!placeholder) {
            console.log('❌ [THUMBNAIL] Placeholder não encontrado!');
            return;
        }
        console.log('✅ [THUMBNAIL] Placeholder encontrado, continuando...');
        
        // Criar elemento de vídeo para extrair frame
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.onloadedmetadata = () => {
            console.log('📹 [THUMBNAIL] Metadados do vídeo carregados:', {
                duration: video.duration,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            });
            console.log('🔧 [THUMBNAIL] Placeholder encontrado:', placeholder);
            
            // Definir dimensões do canvas para aspect ratio 9:16
            const targetWidth = 338;
            const targetHeight = 601;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            // Ir para 1 segundo do vídeo (ou 10% da duração, o que for menor)
            const seekTime = Math.min(1, video.duration * 0.1);
            console.log('⏰ [THUMBNAIL] Buscando frame no tempo:', seekTime);
            video.currentTime = seekTime;
        };
        
        video.onseeked = () => {
            console.log('🎯 [THUMBNAIL] Frame capturado, iniciando desenho no canvas');
            
            try {
                // Calcular dimensões para manter aspect ratio
                const videoAspect = video.videoWidth / video.videoHeight;
                const canvasAspect = canvas.width / canvas.height;
                
                let drawWidth, drawHeight, drawX, drawY;
                
                if (videoAspect > canvasAspect) {
                    // Vídeo é mais largo, ajustar pela altura
                    drawHeight = canvas.height;
                    drawWidth = drawHeight * videoAspect;
                    drawX = (canvas.width - drawWidth) / 2;
                    drawY = 0;
                } else {
                    // Vídeo é mais alto, ajustar pela largura
                    drawWidth = canvas.width;
                    drawHeight = drawWidth / videoAspect;
                    drawX = 0;
                    drawY = (canvas.height - drawHeight) / 2;
                }
                
                // Preencher fundo preto
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Desenhar o frame do vídeo
                ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
                
                // Converter canvas para base64
                const thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.8);
                console.log('🖼️ [THUMBNAIL] Thumbnail gerada com sucesso, tamanho:', thumbnailBase64.length, 'caracteres');
                
                // Atualizar o placeholder com o thumbnail real
                console.log('🔄 [THUMBNAIL] Atualizando placeholder com thumbnail real');
                placeholder.innerHTML = `
                    <div class="video-thumbnail-container" style="position: relative; width: 100%; height: 100%; border-radius: 8px; overflow: hidden;">
                        <img src="${thumbnailBase64}" 
                             class="video-thumbnail-img"
                             style="width: 100%; height: 100%; object-fit: contain; display: block; margin: 0 auto;" 
                             alt="Thumbnail do vídeo"
                             onload=""
                             onerror="">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-play" style="color: white; font-size: 20px; margin-left: 3px;"></i>
                        </div>
                        <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.8); color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px;">
                            ${fileExtension.toUpperCase()} • ${formatFileSize(file.size)}
                        </div>
                        <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px;">
                            ${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}
                        </div>
                    </div>
                `;
                
                // Recursos de base64 são automaticamente gerenciados pelo navegador
                
            } catch (error) {
                this.generateSimpleVideoPreview(fileItem, file);
            }
        };
        
        video.onerror = (error) => {
            this.generateSimpleVideoPreview(fileItem, file);
        };
        
        // Usar URL.createObjectURL para vídeos (mais eficiente que data URL)
        let objectURL = null;
        
        const cleanup = () => {
            if (objectURL) {
                URL.revokeObjectURL(objectURL);
                objectURL = null;
            }
        };
        
        // Timeout para evitar travamento
        const timeout = setTimeout(() => {
            console.log('⚠️ [THUMBNAIL] Timeout na geração de thumbnail');
            cleanup();
            this.generateSimpleVideoPreview(fileItem, file);
        }, 8000); // 8 segundos
        
        // Interceptar handlers para incluir cleanup
        const originalOnSeeked = video.onseeked;
        const originalOnError = video.onerror;
        
        video.onseeked = () => {
            clearTimeout(timeout);
            if (originalOnSeeked) originalOnSeeked();
            cleanup();
        };
        
        video.onerror = (error) => {
            clearTimeout(timeout);
            cleanup();
            if (originalOnError) originalOnError(error);
        };
        
        try {
            objectURL = URL.createObjectURL(file);
            
            video.preload = 'metadata';
            video.muted = true;
            video.src = objectURL;
            
        } catch (error) {
            clearTimeout(timeout);
            console.log('⚠️ [THUMBNAIL] Erro ao criar object URL:', error);
            this.generateSimpleVideoPreview(fileItem, file);
        }
    }
    
    generateSimpleVideoPreview(fileItem, file) {
        
        const formatFileSize = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        const fileExtension = file.name.split('.').pop();
        
        const placeholder = fileItem.querySelector('.video-placeholder');
        if (!placeholder) return;
        
        // Preview simples e direto
        placeholder.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 20px; box-sizing: border-box; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                    <i class="fas fa-video" style="font-size: 24px;"></i>
                </div>
                <div style="font-weight: bold; font-size: 13px; margin-bottom: 5px; word-break: break-word; line-height: 1.2;">
                    ${file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name}
                </div>
                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 3px;">
                    ${fileExtension.toUpperCase()} • ${formatFileSize(file.size)}
                </div>
                <div style="font-size: 10px; opacity: 0.7;">
                    Arquivo de vídeo
                </div>
                <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.5); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-play" style="font-size: 10px;"></i>
                </div>
            </div>
        `;
        
        // Preview simples de vídeo criado
    }
    


    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    }

    clearAllFiles() {
        // clearAllFiles chamada - removendo todos os arquivos
        
        const uploadedFilesDiv = document.getElementById('uploaded-files');
        const fileItems = uploadedFilesDiv.querySelectorAll('.file-item');
        
        // Remover elementos do DOM (não precisamos mais limpar blob URLs)
        fileItems.forEach(item => {
            item.remove();
        });
        
        // Limpar array de arquivos
        this.uploadedFiles = [];
        
        // Resetar inputs de arquivo para permitir nova seleção
        // Usar setTimeout para evitar conflitos com eventos residuais
        setTimeout(() => {
            const imageInput = document.getElementById('image-upload');
            const videoInput = document.getElementById('video-upload');
            if (imageInput) {
                imageInput.value = '';
                // Forçar reset do input
                imageInput.type = 'text';
                imageInput.type = 'file';
            }
            if (videoInput) {
                videoInput.value = '';
                // Forçar reset do input
                videoInput.type = 'text';
                videoInput.type = 'file';
            }
        }, 100);
        
        // Esconder container de arquivos
        uploadedFilesDiv.classList.add('hidden');
        
        // Todos os arquivos removidos e inputs resetados
    }

    removeFile(fileName) {
        // removeFile chamada
        
        this.uploadedFiles = this.uploadedFiles.filter(file => file.name !== fileName);
        
        // Arquivos após remoção
        
        const uploadedFilesDiv = document.getElementById('uploaded-files');
        const fileItems = uploadedFilesDiv.querySelectorAll('.file-item');
        
        // Procurando elemento DOM para remover...
        
        fileItems.forEach(item => {
            const removeBtn = item.querySelector('.remove-file');
            if (removeBtn && removeBtn.getAttribute('data-filename') === fileName) {
                // Elemento DOM encontrado, removendo...
                
                // Remover elemento do DOM (não precisamos mais limpar blob URLs)
                item.remove();
            }
        });
        
        // Resetar inputs de arquivo para permitir nova seleção do mesmo arquivo
        // Usar setTimeout para evitar conflitos com eventos residuais
        setTimeout(() => {
            const imageInput = document.getElementById('image-upload');
            const videoInput = document.getElementById('video-upload');
            if (imageInput) {
                imageInput.value = '';
                // Forçar reset do input
                imageInput.type = 'text';
                imageInput.type = 'file';
            }
            if (videoInput) {
                videoInput.value = '';
                // Forçar reset do input
                videoInput.type = 'text';
                videoInput.type = 'file';
            }
        }, 100);
        
        if (this.uploadedFiles.length === 0) {
            uploadedFilesDiv.classList.add('hidden');
        }
        
        // Arquivo removido e inputs resetados para permitir nova seleção
    }



    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showError(errorDiv, message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    handleConfirmClick(e) {
        const confirmBtn = document.getElementById('confirm-campaign');
        
        if (this.isMobile) {
            if (this.mobileClickState.confirmButton) {
                // Segundo clique - confirmar campanha
                this.mobileClickState.confirmButton = false;
                confirmBtn.classList.remove('first-click');
                this.confirmCampaign();
            } else {
                // Primeiro clique - destacar botão
                confirmBtn.classList.add('first-click');
                this.mobileClickState.confirmButton = true;
                
                // Remover destaque após 3 segundos se não houver segundo clique
                setTimeout(() => {
                    if (this.mobileClickState.confirmButton) {
                        confirmBtn.classList.remove('first-click');
                        this.mobileClickState.confirmButton = false;
                    }
                }, 3000);
            }
        } else {
            // Desktop - confirmação direta
            this.confirmCampaign();
        }
    }

    confirmCampaign() {
        // Verificar se há upload em andamento
        const progressContainer = document.querySelector('.upload-progress-container');
        if (progressContainer) {
            // Mostrar mensagem de bloqueio
            showUploadInProgressMessage();
            return;
        }
        
        // Validar campos obrigatórios
        const validationErrors = this.validateRequiredFields();
        
        if (validationErrors.length > 0) {
            this.showValidationErrors(validationErrors);
            return;
        }
        
        // Coletar dados detalhados do perfil
        const profileData = this.getProfileData();
        
        // Coletar localização específica
        let locationText = this.selectedLocation;
        if (this.selectedLocation === 'estado' && this.estadoSelecionado) {
            locationText = this.getEstadoNome(this.estadoSelecionado);
        } else if (this.selectedLocation === 'cidade') {
                if (this.cidadeSelecionada) {
                if (this.cidadeInteira || (document.getElementById('cidade-toda-checkbox') && document.getElementById('cidade-toda-checkbox').checked)) {
                    // Cidade inteira: salvar apenas o nome da cidade
                    locationText = `${this.cidadeSelecionada.nome}`;
                } else {
                    const radiusSlider = document.getElementById('radius-slider');
                    const radiusKm = radiusSlider ? radiusSlider.value : '25';
                    locationText = `${this.cidadeSelecionada.nome} - ${this.getEstadoNome(this.cidadeSelecionada.codigo_uf)} (${radiusKm}km)`;
                }
            } else if (this.campaignTracker && this.campaignTracker.campaignData.location) {
                // Tentar recuperar localização do CampaignTracker
                locationText = this.campaignTracker.campaignData.location;
            } else if (this.campaignTracker && this.campaignTracker.location) {
                // Tentar recuperar localização diretamente do CampaignTracker
                locationText = this.campaignTracker.location;
            }
        }
        
        // Obter mercados selecionados da instância OpenAI
        const selectedMarkets = openAIIntegration ? openAIIntegration.getMercadosSelecionados() : [];
        let marketsText = 'Público Ad+';
        let audienceData = 'ad+';
        if (selectedMarkets.length > 0) {
            const marketTitles = selectedMarkets.map(market => market.nome).join(', ');
            marketsText = `Público Ad+ • ${marketTitles}`;
            audienceData = `ad+ • ${marketTitles}`;
        }

        // Obter duração selecionada do campaignTracker
        console.log('🔍 Checking duration data:', {
            campaignTracker: this.campaignTracker,
            campaignTrackerData: this.campaignTracker?.data,
            savedDuration: this.campaignTracker?.data?.duration
        });
        const duration = this.campaignTracker?.data?.duration || '7 dias';
        console.log('📊 Final duration used:', duration);
        
        // Capturar parâmetros UTM
        const utmParams = getUTMParameters();
        
        const campaignData = {
            objective: this.selectedObjective,
            direction: this.selectedDirection,
            profile: profileData ? (profileData.username || profileData.profileName || profileData.siteUrl || profileData.phoneNumber || 'Perfil validado') : 'Não informado',
            profileData: profileData,
            location: locationText,
            gender: this.selectedGender,
            age: `${this.selectedAgeMin} - ${this.selectedAgeMax} anos`,
            markets: marketsText,
            audience: audienceData,
            duration: duration,
            platforms: {
                meta: !!(document.getElementById('platform-meta') && document.getElementById('platform-meta').checked),
                sites: !!(document.getElementById('platform-sites') && document.getElementById('platform-sites').checked)
            },
            utm_source: utmParams.utm_source,
            utm_medium: utmParams.utm_medium,
            utm_campaign: utmParams.utm_campaign,
            utm_term: utmParams.utm_term,
            utm_content: utmParams.utm_content,
            files: this.uploadedFiles.map(file => {
                console.log('🔍 [DEBUG] Mapeando arquivo para salvar:', {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: file.url,
                    filename: file.filename,
                    converted: file.converted,
                    originalFormat: file.originalFormat
                });
                return {
                    nome: file.name,
                    tipo: file.type,
                    tamanho: file.size,
                    url: file.url,
                    filename: file.filename,
                    converted: file.converted || false,
                    originalFormat: file.originalFormat || null
                };
            })
        };
        
        // Adicionar URL do site se o direcionamento for 'site'
        if (this.selectedDirection === 'site') {
            const siteInput = document.getElementById('site-url');
            if (siteInput && siteInput.value) {
                campaignData.siteUrl = siteInput.value;
            }
        }
        
        // Adicionar timestamp aos dados
        campaignData.timestamp = Date.now();
        
        console.log('💾 Salvando dados da campanha:', campaignData);
        
        // Salvar no localStorage com timestamp
        setLocalStorageItem('campaignData', JSON.stringify(campaignData));
        
        // Atualizar o CampaignTracker com os dados completos
        console.log('  - CampaignTracker available?', !!this.campaignTracker);
        if (this.campaignTracker) {
            console.log('  - Updating CampaignTracker with complete data...');
            // Atualizar campos individuais no tracker
            this.campaignTracker.updateCampaign('objective', campaignData.objective);
            this.campaignTracker.updateCampaign('direction', campaignData.direction);
            this.campaignTracker.updateCampaign('profile', campaignData.profile);
            this.campaignTracker.updateCampaign('profileData', campaignData.profileData);
            this.campaignTracker.updateCampaign('location', campaignData.location);
            this.campaignTracker.updateCampaign('gender', campaignData.gender);
            this.campaignTracker.updateCampaign('age', campaignData.age);
            this.campaignTracker.updateCampaign('markets', campaignData.markets);
            this.campaignTracker.updateCampaign('audience', campaignData.audience);
            this.campaignTracker.updateCampaign('duration', campaignData.duration);
            this.campaignTracker.updateCampaign('platforms', campaignData.platforms);
            this.campaignTracker.updateCampaign('files', campaignData.files);
            if (campaignData.siteUrl) {
                this.campaignTracker.updateCampaign('siteUrl', campaignData.siteUrl);
            }
            
            // Marcar etapa como concluída
            this.campaignTracker.addCompletedStep('profile_validation');
            
            // Progresso da etapa 1 (index) é atualizado automaticamente pela detecção de página
            console.log('📈 Etapa 1 (index) será marcada automaticamente');
            
            // NÃO marcar como completa ainda - apenas salvar o progresso
            // A campanha só deve ser marcada como completa quando o pagamento for validado
            console.log('💾 Salvando progresso da etapa 1 sem marcar como completa');
            
            // Salvar explicitamente para garantir que os dados sejam persistidos
            this.campaignTracker.saveCampaign();
            console.log('💾 Campaign explicitly saved');
            
            console.log('✅ CampaignTracker updated with campaign data:', this.campaignTracker.campaignData);
            
            // Verificar estado final do localStorage
            const finalCampaigns = JSON.parse(getLocalStorageItem('campaigns') || '[]');
            console.log('  - Final campaigns in localStorage:', finalCampaigns.length, 'campaigns');
            console.log('  - Final campaigns details:', finalCampaigns);
        } else {
            console.log('❌ CampaignTracker not available - data may not be saved properly');
        }
        
        console.log('🚀 Redirecting to campaign-config.html...');
        
        // Salvar dados explicitamente no localStorage antes do redirecionamento
        console.log('💾 Salvando campaignData no localStorage antes do redirecionamento');
        setLocalStorageItem('campaignData', JSON.stringify(campaignData));
        
        // Verificar se os dados foram salvos corretamente
        const savedData = getLocalStorageItem('campaignData');
        console.log('✅ Dados salvos no localStorage:', savedData ? 'Sucesso' : 'Falha');
        console.log('📊 Tamanho dos dados salvos:', savedData ? savedData.length : 0, 'caracteres');
        
        // Redirecionar para a página de configuração
        window.location.href = 'campaign-config.html';
    }
    
    getProfileData() {
        const profileInfo = document.querySelector('.profile-info');
        const activeSocial = document.querySelector('.social-btn.active');
        
        // Se não há rede social ativa, verificar se é direcionamento para site
        if (!activeSocial) {
            if (this.selectedDirection === 'site') {
                const siteInput = document.getElementById('site-url');
                if (siteInput && siteInput.value) {
                    return {
                        platform: 'site',
                        siteUrl: siteInput.value,
                        profilePicUrl: null,
                        isValidated: true
                    };
                }
            }
            return null;
        }
        
        // Verificar também se o direcionamento é 'site' mesmo com rede social ativa
        if (this.selectedDirection === 'site') {
            const siteInput = document.getElementById('site-url');
            if (siteInput && siteInput.value) {
                return {
                    platform: 'site',
                    siteUrl: siteInput.value,
                    profilePicUrl: null,
                    isValidated: true
                };
            }
        }
        
        if (!profileInfo) return null;
        
        const platform = activeSocial.dataset.social;
        const profileImage = profileInfo.querySelector('.profile-image');
        
        const data = {
            platform: platform,
            profilePicUrl: profileImage ? profileImage.src : null,
            isValidated: true
        };
        
        if (platform === 'instagram') {
            // Para Instagram, pegar o username do elemento correto
            const usernameElement = document.getElementById('profile-username');
            const followersElement = document.getElementById('followers-count');
            const followingElement = document.getElementById('following-count');
            
            if (usernameElement) {
                // Extrair apenas o username, removendo @ e ícones de verificação
                const usernameText = usernameElement.textContent || usernameElement.innerText;
                data.username = usernameText.replace('@', '').split(' ')[0]; // Pega apenas a primeira parte antes de espaços
            }
            
            // Para Instagram, não temos nome de exibição separado na estrutura atual
            data.displayName = data.username;
            
            if (followersElement) {
                data.followers = followersElement.textContent;
            }
            if (followingElement) {
                data.following = followingElement.textContent;
            }
        } else if (platform === 'whatsapp') {
            // Para WhatsApp, o número está no followers-count e o nome no profile-username
            const usernameElement = document.getElementById('profile-username');
            const phoneElement = document.getElementById('followers-count');
            
            if (usernameElement) {
                // Extrair o nome do perfil, removendo o ícone do WhatsApp
                const usernameText = usernameElement.textContent || usernameElement.innerText;
                data.profileName = usernameText.replace(/\s*\uD83D\uDCF1.*/, '').trim();
            }
            
            if (phoneElement) {
                // Extrair o número de telefone, removendo o ícone
                const phoneText = phoneElement.textContent || phoneElement.innerText;
                data.phoneNumber = phoneText.replace(/\s*\uD83D\uDCF1.*/, '').trim();
            }
        }
        
        return data;
    }
    
    validateRequiredFields() {
        const errors = [];
        
        // 1. Validar objetivo (obrigatório)
        if (!this.selectedObjective) {
            errors.push('Selecione um objetivo para sua campanha');
        }
        
        // 2. Validar direcionamento (obrigatório)
        if (!this.selectedDirection) {
            errors.push('Selecione um direcionamento para sua campanha');
        }
        
        // 3. Validar contato baseado no direcionamento
        if (this.selectedDirection === 'rede-social') {
            const profileInput = document.getElementById('instagram-profile');
            if (!profileInput || !profileInput.value.trim()) {
                errors.push('Preencha seu perfil do WhatsApp ou Instagram');
            }
        } else if (this.selectedDirection === 'site') {
            const siteInput = document.getElementById('site-url');
            if (!siteInput || !siteInput.value.trim()) {
                errors.push('Preencha a URL do seu site');
            }
        }
        
        // 4. Validar localização (obrigatório)
        if (!this.selectedLocation) {
            errors.push('Selecione uma localização para sua campanha');
        } else {
            // Validar seleções específicas de localização
            if (this.selectedLocation === 'estado') {
                const estadoSelect = document.getElementById('estado-select');
                if (!estadoSelect || !estadoSelect.value) {
                    errors.push('Selecione um estado');
                }
            } else if (this.selectedLocation === 'cidade') {
                const cidadeSelecionada = document.getElementById('cidade-selecionada');
                if (!cidadeSelecionada || cidadeSelecionada.classList.contains('hidden')) {
                    errors.push('Selecione uma cidade');
                }
            }
        }
        
        return errors;
    }
    
    showValidationErrors(errors) {
        // Remove mensagens de erro anteriores
        document.querySelectorAll('.section-error').forEach(error => error.remove());
        
        // Mapear erros para suas respectivas seções
        const errorMap = {
            'Selecione um objetivo para sua campanha': 'objetivo',
            'Selecione um direcionamento para sua campanha': 'direcionamento',
            'Preencha seu perfil do WhatsApp ou Instagram': 'direcionamento',
            'Preencha a URL do seu site': 'direcionamento',
            'Selecione uma localização para sua campanha': 'localização',
            'Selecione um estado': 'localização',
            'Selecione uma cidade': 'localização'
        };
        
        // Agrupar erros por seção
        const errorsBySection = {};
        errors.forEach(error => {
            const section = errorMap[error];
            if (section) {
                if (!errorsBySection[section]) {
                    errorsBySection[section] = [];
                }
                errorsBySection[section].push(error);
            }
        });
        
        // Criar mensagens de erro para cada seção
        Object.keys(errorsBySection).forEach(sectionName => {
            this.createSectionError(sectionName, errorsBySection[sectionName]);
        });
        
        // Scroll para a primeira seção com erro
        const firstErrorSection = document.querySelector('.section-error');
        if (firstErrorSection) {
            firstErrorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    createSectionError(sectionName, errors) {
        // Encontrar a seção correspondente
        const sections = document.querySelectorAll('.form-section, .platforms-section');
        let targetSection = null;
        
        sections.forEach(section => {
            const title = section.querySelector('h2').textContent.toLowerCase();
            if (title.includes(sectionName)) {
                targetSection = section;
            }
        });
        
        if (!targetSection) return;
        
        // Criar container de erro
        const errorContainer = document.createElement('div');
        errorContainer.className = 'section-error';
        errorContainer.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-circle"></i>
                <div class="error-messages">
                    ${errors.map(error => `<span class="error-message">${error}</span>`).join('')}
                </div>
            </div>
        `;
        
        // Inserir após o título da seção
        const sectionTitle = targetSection.querySelector('h2');
        sectionTitle.parentNode.insertBefore(errorContainer, sectionTitle.nextSibling);
        
        // Remove automaticamente após 8 segundos
        setTimeout(() => {
            if (errorContainer.parentNode) {
                errorContainer.remove();
            }
        }, 8000);
    }
}

// Variáveis globais para o mapa
let map;
let radiusCircle;
let cityMarker;
let currentCityCoords = null;

// Função para inicializar o mapa usando Leaflet
function initMap() {
    // Inicializa o mapa centrado no Brasil
    map = L.map('map').setView([-14.2350, -51.9253], 5);
    
    // Adiciona camada do OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
}

// Função para geocodificar uma cidade usando coordenadas do banco de dados
function geocodeCity(cityName, stateName, latitude, longitude) {
    
    
    // Aguarda o mapa estar inicializado antes de prosseguir
    function waitForMapAndGeocode() {
        if (!map) {
            setTimeout(waitForMapAndGeocode, 100);
            return;
        }
        
        currentCityCoords = {
            lat: parseFloat(latitude),
            lng: parseFloat(longitude)
        };
        

        
        // Remove marcador anterior se existir
        if (cityMarker) {
            map.removeLayer(cityMarker);

        }
        
        // Remove círculo anterior se existir
        if (radiusCircle) {
            map.removeLayer(radiusCircle);

        }
        
        // Centraliza o mapa na nova cidade com animação
        map.setView([currentCityCoords.lat, currentCityCoords.lng], 11, {
            animate: true,
            duration: 1
        });
        

        
        // Adiciona marcador da nova cidade
        cityMarker = L.marker([currentCityCoords.lat, currentCityCoords.lng])
            .addTo(map)
            .bindPopup(`<b>${cityName}</b><br>${stateName}`);
        

        
        // Desenha o círculo do raio para a nova cidade
        updateMapRadius();
        

    }
    
    waitForMapAndGeocode();
}

// Função para atualizar o círculo do raio no mapa
function updateMapRadius() {
    if (!currentCityCoords || !map) return;
    
    // Remove círculo anterior se existir
    if (radiusCircle) {
        map.removeLayer(radiusCircle);
    }
    
    // Obtém o valor atual do slider
    const radiusKm = parseInt(document.getElementById('radius-slider').value);
    
    // Cria novo círculo
    radiusCircle = L.circle([currentCityCoords.lat, currentCityCoords.lng], {
        color: '#4285f4',
        fillColor: '#4285f4',
        fillOpacity: 0.15,
        radius: radiusKm * 1000 // Converte km para metros
    }).addTo(map);
    
    // Ajusta o zoom para mostrar todo o círculo
    const bounds = radiusCircle.getBounds();
    map.fitBounds(bounds);
}

// Inicializar o mapa quando uma cidade for selecionada
function showMapWhenCitySelected() {
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.style.display = 'block';
        
        // Aguarda o carregamento do Leaflet e força a atualização do tamanho do mapa
        function waitForLeaflet() {
            if (typeof L !== 'undefined' && document.getElementById('map')) {
                // Só inicializa o mapa se ele ainda não existir
                if (!map) {
                    initMap();
                }
                // Força o redimensionamento do mapa após ele ser exibido
                setTimeout(() => {
                    if (map) {
                        map.invalidateSize();
                    }
                }, 100);
            } else {
                setTimeout(waitForLeaflet, 100);
            }
        }
        waitForLeaflet();
    }
}

// Configuração da OpenAI API
class OpenAIIntegration {
    constructor() {
        this.selectedMarkets = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const buscarBtn = document.getElementById('buscar-mercado-btn');
        const nichoInput = document.getElementById('nicho-input');
        const charCountElement = document.getElementById('char-count');
        
        if (buscarBtn) {
            buscarBtn.addEventListener('click', () => this.buscarMercadosSemelhantes());
        }
        
        if (nichoInput) {
            nichoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.buscarMercadosSemelhantes();
                }
            });
            
            // Contador de caracteres
            nichoInput.addEventListener('input', (e) => {
                if (charCountElement) {
                    const maxChars = 120;
                    const currentLength = e.target.value.length;
                    
                    // Limita o input a 120 caracteres
                    if (currentLength > maxChars) {
                        e.target.value = e.target.value.substring(0, maxChars);
                        charCountElement.textContent = maxChars;
                    } else {
                        charCountElement.textContent = currentLength;
                    }
                    
                    // Muda a cor baseado na proximidade do limite
                    const counter = charCountElement.parentElement;
                    if (currentLength >= maxChars) {
                        counter.style.color = '#e74c3c'; // Vermelho quando no limite
                    } else if (currentLength >= maxChars * 0.8) {
                        counter.style.color = '#f39c12'; // Laranja quando próximo (80%)
                    } else {
                        counter.style.color = '#666'; // Cor padrão
                    }
                }
            });
        }
    }

    async buscarMercadosSemelhantes() {
        const nichoInput = document.getElementById('nicho-input');
        const loadingDiv = document.getElementById('mercado-loading');
        const resultsDiv = document.getElementById('mercado-results');
        const buscarBtn = document.getElementById('buscar-mercado-btn');
        
        const nicho = nichoInput.value.trim();
        
        // Validações de entrada
        if (!nicho) {
            this.exibirErro('Por favor, digite um nicho ou interesse.');
            return;
        }
        
        if (nicho.length < 3) {
            this.exibirErro('O nicho deve ter pelo menos 3 caracteres.');
            return;
        }
        
        if (nicho.length > 120) {
            this.exibirErro('O nicho deve ter no máximo 120 caracteres.');
            return;
        }
        
        // Validação de conteúdo ofensivo
        if (!this.validarConteudo(nicho)) {
            this.exibirErroConteudoInadequado();
            return;
        }
        
        // Verificar se há conexão com a internet
        if (!navigator.onLine) {
            this.exibirErro('Sem conexão com a internet. Verifique sua conexão e tente novamente.');
            return;
        }
        
        // Mostrar loading
        loadingDiv.classList.remove('hidden');
        resultsDiv.classList.add('hidden');
        buscarBtn.disabled = true;
        buscarBtn.textContent = 'Buscando...';
        
        try {
            const mercados = await this.consultarOpenAI(nicho);
            this.exibirResultados(mercados);
        } catch (error) {
            console.error('Erro ao buscar mercados:', error);
            
            // Se for conteúdo inadequado, exibir mensagem específica
            if (error.message === 'CONTEUDO_INADEQUADO') {
                this.exibirErroConteudoInadequado();
                return;
            }
            
            let mensagemErro = 'Erro ao buscar mercados semelhantes. Tente novamente.';
            
            if (error.message.includes('401')) {
                mensagemErro = 'Erro de autenticação. Verifique a chave da API.';
            } else if (error.message.includes('429')) {
                mensagemErro = 'Muitas solicitações. Aguarde um momento e tente novamente.';
            } else if (error.message.includes('500')) {
                mensagemErro = 'Erro no servidor. Tente novamente em alguns minutos.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                mensagemErro = 'Erro de conexão. Verifique sua internet e tente novamente.';
            }
            
            this.exibirErro(mensagemErro);
        } finally {
            loadingDiv.classList.add('hidden');
            buscarBtn.disabled = false;
            buscarBtn.innerHTML = '<i class="fas fa-search"></i> Buscar Mercado';
        }
    }

    async consultarOpenAI(nicho) {
        // Criar AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

        try {
            const response = await fetch('/api/buscar-mercado', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nicho: nicho
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Erro da API:', response.status, errorData);
                
                // Se for conteúdo inadequado, exibir mensagem específica
                if (errorData.error === 'conteudo_inadequado') {
                    throw new Error('CONTEUDO_INADEQUADO');
                }
                
                throw new Error(errorData.error || `Erro na API: ${response.status}`);
            }

            const data = await response.json();
            
            // Validar estrutura da resposta
            if (!data.mercados || !Array.isArray(data.mercados)) {
                throw new Error('Formato de mercados inválido');
            }
            
            if (data.mercados.length === 0) {
                throw new Error('Nenhum mercado válido encontrado');
            }
            
            return data.mercados;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Timeout: A requisição demorou muito para responder');
            }
            
            throw error;
        }
    }

    exibirResultados(mercados) {
        const resultsDiv = document.getElementById('mercado-results');
        
        if (!mercados || mercados.length === 0) {
            this.exibirErro('Nenhum mercado semelhante encontrado.');
            return;
        }
        
        // Limpar seleções anteriores
        this.selectedMarkets = [];
        resultsDiv.innerHTML = '';
        
        // Adicionar contador de mercados selecionados
        const counterDiv = document.createElement('div');
        counterDiv.className = 'mercados-counter';
        counterDiv.id = 'mercados-counter';
        counterDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>0 mercados selecionados</span>
        `;
        resultsDiv.appendChild(counterDiv);

        mercados.forEach((mercado, index) => {
            const mercadoDiv = document.createElement('div');
            mercadoDiv.className = 'mercado-option';
            mercadoDiv.dataset.mercado = index;

            mercadoDiv.innerHTML = `
                <div class="mercado-checkbox">
                    <i class="fas fa-check"></i>
                </div>
                <div class="mercado-content">
                    <h4>${mercado.nome}</h4>
                    <p>${mercado.descricao}</p>
                </div>
            `;

            mercadoDiv.addEventListener('click', () => this.toggleMercado(mercadoDiv, mercado));

            resultsDiv.appendChild(mercadoDiv);
        });
        
        resultsDiv.classList.remove('hidden');
    }
    
    toggleMercado(element, mercado) {
        const isSelected = element.classList.contains('selected');
        
        if (isSelected) {
            // Remove da seleção
            element.classList.remove('selected');
            this.selectedMarkets = this.selectedMarkets.filter(m => m.nome !== mercado.nome);
        } else {
            // Adiciona à seleção
            element.classList.add('selected');
            this.selectedMarkets.push(mercado);
        }
        
        // Tracking: salvar mercados selecionados
        if (window.campaignCreator && window.campaignCreator.campaignTracker) {
            window.campaignCreator.campaignTracker.updateCampaign('selectedMarkets', this.selectedMarkets);
            const marketTitles = this.selectedMarkets.map(market => market.nome).join(', ');
            const audienceText = this.selectedMarkets.length > 0 ? `Público Ad+ • ${marketTitles}` : 'Público Ad+';
            window.campaignCreator.campaignTracker.updateCampaign('audience', audienceText);
        }
        
        this.updateCounter();

    }
    
    updateCounter() {
        const counter = document.getElementById('mercados-counter');
        if (counter) {
            const count = this.selectedMarkets.length;
            const span = counter.querySelector('span');
            span.textContent = `${count} mercado${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
            
            if (count > 0) {
                counter.classList.add('has-selection');
            } else {
                counter.classList.remove('has-selection');
            }
        }
    }
    
    // Lista de palavras e termos inadequados
    getPalavrasProibidas() {
        return [
            // Palavrões e termos ofensivos
            'golpe', 'golpes', 'fraude', 'fraudar', 'enganar', 'trapacear',
            'vai se fuder', 'vá se fuder', 'se foder', 'foder', 'fuder',
            'não quero', 'nao quero', 'não', 'nao', 'recuso', 'nego',
            'merda', 'bosta', 'porra', 'caralho', 'cacete', 'droga',
            'idiota', 'burro', 'estúpido', 'imbecil', 'otário', 'babaca',
            'filho da puta', 'fdp', 'desgraça', 'desgraçado', 'maldito',
            'piranha', 'vagabundo', 'safado', 'canalha', 'sacana',
            'lixo', 'nojento', 'asqueroso', 'repugnante', 'horrível',
            // Termos relacionados a atividades ilegais
            'drogas', 'maconha', 'cocaína', 'crack', 'heroína', 'ecstasy',
            'tráfico', 'trafico', 'contrabando', 'lavagem de dinheiro',
            'prostituição', 'prostituta', 'cafetão', 'cafetao',
            'assassinato', 'homicídio', 'matar', 'morte', 'suicídio',
            'roubo', 'furto', 'assalto', 'sequestro', 'extorsão',
            // Termos discriminatórios
            'racista', 'racismo', 'preconceito', 'discriminação',
            'homofobia', 'transfobia', 'xenofobia', 'machismo',
            // Termos relacionados a conteúdo adulto
            'pornografia', 'pornô', 'sexo', 'sexual', 'erótico',
            'nudez', 'strip', 'escort', 'acompanhante',
            // Outros termos inadequados
            'hack', 'hacker', 'pirataria', 'crack software', 'warez',
            'spam', 'phishing', 'malware', 'vírus', 'virus',
            'bomba', 'explosivo', 'arma', 'pistola', 'revólver',
            'terrorismo', 'terrorista', 'atentado', 'violência',
            // Termos relacionados ao satanismo e ocultismo
            'satanismo', 'satanista', 'satã', 'satan', 'diabo', 'demônio',
            'demonio', 'lúcifer', 'lucifer', 'belzebu', 'baphomet',
            'anticristo', 'anti-cristo', 'ocultismo', 'ocultista',
            'magia negra', 'bruxaria', 'feitiçaria', 'feiticaria',
            'ritual satânico', 'ritual satanico', 'missa negra',
            'pentagrama invertido', 'cruz invertida', 'número da besta',
            '666', 'seita satânica', 'seita satanica', 'culto satânico',
            'culto satanico', 'adoração ao diabo', 'adoracao ao diabo',
            'pacto com o diabo', 'invocação demoníaca', 'invocacao demoniaca',
            'possessão demoníaca', 'possessao demoniaca', 'exorcismo',
            'grimório', 'grimorio', 'livro das sombras', 'necronomicon',
            'thelema', 'aleister crowley', 'anton lavey', 'igreja de satã',
            'igreja de satan', 'templo satânico', 'templo satanico',
            'capeta', 'adoração ao capeta', 'adoracao ao capeta'
        ];
    }
    
    // Função para validar se o conteúdo é adequado
    validarConteudo(texto) {
        const textoLimpo = texto.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s]/g, ' ') // Remove pontuação
            .replace(/\s+/g, ' ') // Normaliza espaços
            .trim();
        
        const palavrasProibidas = this.getPalavrasProibidas();
        
        // Verifica se alguma palavra proibida está presente
        const palavrasTexto = textoLimpo.split(/\s+/);
        
        for (const palavraProibida of palavrasProibidas) {
            const palavraLimpa = palavraProibida.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Verifica se a palavra proibida é uma palavra completa no texto
            if (palavrasTexto.includes(palavraLimpa)) {
                return false;
            }
        }
        
        return true;
    }
    
    // Função para exibir erro de conteúdo inadequado
    exibirErroConteudoInadequado() {
        const resultsDiv = document.getElementById('mercado-results');
        resultsDiv.innerHTML = `
            <div class="error-message" style="color: #ff6b6b; padding: 1.5rem; text-align: center; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; margin: 1rem 0;">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                <h4 style="margin: 0.5rem 0; color: #c53030;">Conteúdo Inadequado Detectado</h4>
                <p style="margin: 0.5rem 0; color: #742a2a;">O termo pesquisado contém palavras ofensivas ou inadequadas.</p>
                <p style="margin: 0.5rem 0; color: #742a2a; font-weight: 500;">Por favor, digite um nicho, profissão ou interesse válido para sua campanha.</p>
                <div style="margin-top: 1rem; padding: 0.75rem; background: #f7fafc; border-radius: 6px; border-left: 4px solid #4299e1;">
                    <p style="margin: 0; color: #2d3748; font-size: 0.9rem;"><strong>Exemplos válidos:</strong> fitness, culinária, tecnologia, moda, educação, saúde, negócios, arte, música, esportes</p>
                </div>
            </div>
        `;
        resultsDiv.classList.remove('hidden');
        
        // Limpar o campo de entrada após 3 segundos
        setTimeout(() => {
            const nichoInput = document.getElementById('nicho-input');
            if (nichoInput) {
                nichoInput.value = '';
                nichoInput.focus();
            }
        }, 3000);
    }
    
    exibirErro(mensagem) {
        const resultsDiv = document.getElementById('mercado-results');
        resultsDiv.innerHTML = `
            <div class="error-message" style="color: #ff6b6b; padding: 1rem; text-align: center;">
                <i class="fas fa-exclamation-triangle"></i>
                ${mensagem}
            </div>
        `;
        resultsDiv.classList.remove('hidden');
    }
    
    getMercadosSelecionados() {
        return this.selectedMarkets;
    }
    
    // Manter compatibilidade com código existente
    getMercadoSelecionado() {
        return this.selectedMarkets.length > 0 ? this.selectedMarkets[0] : null;
    }
}

// Inicializar as classes
let campaignCreator, openAIIntegration;

// Garantir inicialização após DOM estar pronto
document.addEventListener('DOMContentLoaded', function() {
    // Capturar parâmetros UTM da URL
    captureUTMParameters();
    
    // Registrar timestamp do carregamento da página
    setLocalStorageItem('lastPageLoad', Date.now().toString());
    console.log('⏰ Timestamp de carregamento registrado:', Date.now());
    
    // NÃO instanciar CampaignCreator no dashboard, campaign-config ou payment-mobile para evitar limpeza de dados
    if (window.location.pathname.includes('dashboard.html')) {
        console.log('📊 Dashboard detectado - pulando inicialização do CampaignCreator');
        return;
    }
    
    if (window.location.pathname.includes('campaign-config.html')) {
        console.log('⚙️ Campaign-config detectado - pulando inicialização do CampaignCreator');
        return;
    }
    
    if (window.location.pathname.includes('payment-mobile.html')) {
        console.log('📱 Payment-mobile detectado - pulando inicialização do CampaignCreator');
        return;
    }
    
    try {
        console.log('🚀 Inicializando CampaignCreator...');
        campaignCreator = new CampaignCreator();
        console.log('✅ CampaignCreator criado:', campaignCreator);
        console.log('🔍 CampaignTracker disponível?', !!campaignCreator.campaignTracker);
        
        openAIIntegration = new OpenAIIntegration();
        
        // Tornar disponível globalmente
        window.campaignCreator = campaignCreator;
        window.openAIIntegration = openAIIntegration;
        
        console.log('🌐 window.campaignCreator definido:', !!window.campaignCreator);
        console.log('🌐 window.campaignCreator.campaignTracker:', !!window.campaignCreator.campaignTracker);
        

        
        // Configurar cards de duração (apenas se não estiver na página campaign-config)
        if (!window.location.pathname.includes('campaign-config.html')) {
            setupDurationCards();
        }
        
        // Adicionar eventos touch extras para garantir interatividade mobile
        setTimeout(() => {
            // Garantir que todos os elementos interativos tenham eventos touch
            const interactiveElements = document.querySelectorAll('.option-card, .social-btn, .gender-btn, .upload-card, .confirm-btn, .buscar-mercado-btn, .validate-btn');
            
            interactiveElements.forEach(element => {
                if (!element.hasAttribute('data-touch-enabled')) {
                    element.setAttribute('data-touch-enabled', 'true');
                    
                    let touchStartX = 0;
                    let touchStartY = 0;
                    let touchStartTime = 0;
                    let hasMoved = false;
                    
                    element.addEventListener('touchstart', function(e) {
                        this.classList.add('touch-active');
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                        touchStartTime = Date.now();
                        hasMoved = false;
                    }, { passive: true });
                    
                    element.addEventListener('touchmove', function(e) {
                        const touchX = e.touches[0].clientX;
                        const touchY = e.touches[0].clientY;
                        const deltaX = Math.abs(touchX - touchStartX);
                        const deltaY = Math.abs(touchY - touchStartY);
                        
                        // Se o movimento for maior que 20px em qualquer direção, considerar como scroll
                        if (deltaX > 20 || deltaY > 20) {
                            hasMoved = true;
                            this.classList.remove('touch-active');
                        }
                    }, { passive: true });
                    
                    element.addEventListener('touchend', function(e) {
                        this.classList.remove('touch-active');
                        
                        const touchDuration = Date.now() - touchStartTime;
                        
                        // Só simular clique se:
                        // 1. Não houve movimento significativo
                        // 2. O toque durou menos de 500ms (não é um long press)
                        // 3. Não há evento touchend específico já configurado
                        if (!hasMoved && touchDuration < 500 && !this.hasAttribute('data-has-touchend')) {
                            e.preventDefault();
                            this.click();
                        }
                    });
                    
                    element.addEventListener('touchcancel', function(e) {
                        this.classList.remove('touch-active');
                        hasMoved = true;
                    });
                }
            });
        }, 500);
        
    } catch (error) {
        console.error('❌ Erro ao inicializar classes:', error);
    }
});

// Fallback removido para evitar duplicação de instâncias
// Apenas o DOMContentLoaded será usado para inicialização

// Funcionalidades da segunda tela
function initSecondScreen() {
    // Configurar navegação entre telas
    const confirmBtn = document.getElementById('confirm-campaign');
    const backBtn = document.getElementById('back-to-first');
    const firstScreen = document.getElementById('campaign-form');
    const secondScreen = document.getElementById('campaign-config');
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showSecondScreen();
        });
    }
    
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showFirstScreen();
        });
    }
    
    // Configurar cards de duração (apenas se não estiver na página campaign-config)
    if (!window.location.pathname.includes('campaign-config.html')) {
        setupDurationCards();
    }
    
    // Criar gráfico de alcance

}

function showSecondScreen() {
    const firstScreen = document.getElementById('campaign-form');
    const secondScreen = document.getElementById('campaign-config');
    
    if (firstScreen && secondScreen) {
        firstScreen.style.display = 'none';
        secondScreen.style.display = 'block';
        
        // Atualizar métricas baseadas no objetivo
        updateMetricsBasedOnObjective();
        
        // Atualizar resumo das configurações
        updateCampaignSummary();
        
        // Scroll para o topo
        window.scrollTo(0, 0);
    }
}

function showFirstScreen() {
    const firstScreen = document.getElementById('campaign-form');
    const secondScreen = document.getElementById('campaign-config');
    
    if (firstScreen && secondScreen) {
        firstScreen.style.display = 'block';
        secondScreen.style.display = 'none';
        
        // Scroll para o topo
        window.scrollTo(0, 0);
    }
}

function updateMetricsBasedOnObjective() {
    const selectedObjective = document.querySelector('.option-card.selected');
    const metricsContainer = document.querySelector('.metrics-container');
    
    if (!selectedObjective || !metricsContainer) return;
    
    const objective = selectedObjective.textContent.trim();
    
    // Métricas baseadas na duração padrão de 7 dias
    const metricas = {
        1: { alcanceMin: 1500, alcanceMax: 3000, vendas: '5 – 10', cliques: '150 – 300', cadastros: '10 – 20' },
        3: { alcanceMin: 3750, alcanceMax: 7500, vendas: '10 – 15', cliques: '375 – 750', cadastros: '25 – 50' },
        7: { alcanceMin: 7000, alcanceMax: 14000, vendas: '15 – 25', cliques: '700 – 1.4K', cadastros: '45 – 90' },
        14: { alcanceMin: 10500, alcanceMax: 21000, vendas: '25 – 40', cliques: '1.1K – 2.1K', cadastros: '70 – 140' },
        30: { alcanceMin: 15000, alcanceMax: 30000, vendas: '25 – 60', cliques: '1.5K – 3K', cadastros: '100 – 200' }
    };
    
    // Usar métricas de 7 dias como padrão para a primeira tela
    const metricaEscolhida = metricas[7];
    const alcanceFormatado = `${(metricaEscolhida.alcanceMin / 1000).toFixed(1)}K – ${(metricaEscolhida.alcanceMax / 1000).toFixed(0)}K`;
    
    let metrics = [];
    
    switch(objective) {
        case 'Vendas':
            metrics = [
                { title: 'Alcance Estimado', value: alcanceFormatado, label: 'pessoas alcançadas' },
                { title: 'Conversões Esperadas', value: metricaEscolhida.vendas, label: 'vendas estimadas' }
            ];
            break;
        case 'Engajamento':
            metrics = [
                { title: 'Alcance Estimado', value: alcanceFormatado, label: 'pessoas alcançadas' },
                { title: 'Cliques no Link', value: metricaEscolhida.cliques, label: 'cliques esperados' }
            ];
            break;
        case 'Cadastros':
            metrics = [
                { title: 'Alcance Estimado', value: alcanceFormatado, label: 'pessoas alcançadas' },
                { title: 'Conversões Esperadas', value: metricaEscolhida.cadastros, label: 'cadastros estimados' }
            ];
            break;
        default:
            metrics = [
                { title: 'Alcance Estimado', value: alcanceFormatado, label: 'pessoas alcançadas' },
                { title: 'Interações', value: '450', label: 'interações esperadas' }
            ];
    }
    
    metricsContainer.innerHTML = metrics.map(metric => `
        <div class="metric-card">
            <h4>${metric.title}</h4>
            <div class="metric-value">${metric.value}</div>
            <div class="metric-label">${metric.label}</div>
        </div>
    `).join('');
}

function setupDurationCards() {
    const durationCards = document.querySelectorAll('.duration-card');
    
    durationCards.forEach(card => {
        card.addEventListener('click', function() {
            // Remover seleção de outros cards
            durationCards.forEach(c => c.classList.remove('selected'));
            
            // Adicionar seleção ao card clicado
            this.classList.add('selected');
            
            // Atualizar gráfico baseado na duração selecionada
            const days = parseInt(this.dataset.days);
            
            // Salvar duração no tracking
            if (window.campaignCreator && window.campaignCreator.campaignTracker) {
                window.campaignCreator.campaignTracker.updateCampaign('duration', `${days} dias`);
                console.log('Duration tracked:', `${days} dias`);
            }

        });
    });
}









function updateCampaignSummary() {
    // Objetivo
    const selectedObjective = document.querySelector('.option-card.selected');
    const objectiveSummary = document.getElementById('summary-objective');
    if (selectedObjective && objectiveSummary) {
        objectiveSummary.textContent = selectedObjective.textContent.trim();
    }
    
    // Perfil social ou Site
    const selectedDirection = document.querySelector('[data-option="rede-social"].selected, [data-option="site"].selected');
    const profileSummary = document.getElementById('summary-profile');
    
    if (selectedDirection && profileSummary) {
        if (selectedDirection.dataset.option === 'site') {
            // Direcionamento para site
            const siteInput = document.getElementById('site-url');
            if (siteInput && siteInput.value) {
                // Abreviar URL se for muito longa
                let url = siteInput.value;
                // Remove protocolo para economizar espaço
                url = url.replace(/^https?:\/\//, '');
                // Se ainda for muito longa, truncar
                if (url.length > 25) {
                    url = url.substring(0, 22) + '...';
                }
                profileSummary.innerHTML = `<p>Site: ${url}</p>`;
            } else {
                profileSummary.textContent = 'Site: -';
            }
        } else {
            // Direcionamento para rede social
            const selectedSocial = document.querySelector('.social-btn.selected');
            const profileInput = document.querySelector('.profile-input:not([style*="display: none"]) input');
            if (selectedSocial && profileInput) {
                const platform = selectedSocial.textContent.includes('Instagram') ? 'Instagram' : 'WhatsApp';
                profileSummary.textContent = `${platform}: ${profileInput.value}`;
            }
        }
    }
    
    // Localização
    const selectedLocation = document.querySelector('input[name="location"]:checked');
    const locationSummary = document.getElementById('summary-location');
    if (selectedLocation && locationSummary) {
        if (selectedLocation.value === 'estado') {
            const estado = document.getElementById('estado-select').value;
            locationSummary.textContent = estado || 'Não selecionado';
        } else if (selectedLocation.value === 'cidade') {
            const cidade = document.querySelector('.cidade-selecionada');
            locationSummary.textContent = cidade ? cidade.textContent : 'Não selecionada';
        } else {
            locationSummary.textContent = 'Todo o Brasil';
        }
    }
    
    // Gênero
    const selectedGender = document.querySelector('.gender-btn.selected');
    const genderSummary = document.getElementById('summary-gender');
    if (selectedGender && genderSummary) {
        genderSummary.textContent = selectedGender.textContent.trim();
    }
    
    // Idade
    const ageMin = document.getElementById('idade-minima').value;
    const ageMax = document.getElementById('idade-maxima').value;
    const ageSummary = document.getElementById('summary-age');
    if (ageSummary) {
        ageSummary.textContent = `${ageMin} - ${ageMax} anos`;
    }
    
    // Mercados
    const marketsSummary = document.getElementById('summary-markets');
    if (marketsSummary) {
        // Obter mercados selecionados da instância OpenAI
        const selectedMarkets = openAIIntegration ? openAIIntegration.getMercadosSelecionados() : [];
        let marketsText = 'Público Ad+';
        if (selectedMarkets.length > 0) {
            const marketTitles = selectedMarkets.map(market => market.nome).join(', ');
            marketsText = `Público Ad+ • ${marketTitles}`;
        }
        marketsSummary.textContent = marketsText;
    }
    
    // Tracking: salvar todos os dados coletados no CampaignTracker
    console.log('🔍 updateCampaignSummary - Verificando campaignCreator:', {
        windowCampaignCreator: !!window.campaignCreator,
        campaignTracker: !!(window.campaignCreator && window.campaignCreator.campaignTracker),
        campaignCreatorType: typeof window.campaignCreator
    });
    
    if (window.campaignCreator && window.campaignCreator.campaignTracker) {
        const tracker = window.campaignCreator.campaignTracker;
        console.log('✅ CampaignTracker encontrado, salvando dados...');
        
        // Salvar objetivo
        if (selectedObjective) {
            tracker.updateCampaign('objective', selectedObjective.textContent.trim());
        }
        
        // Salvar direcionamento e perfil
        if (selectedDirection) {
            if (selectedDirection.dataset.option === 'site') {
                tracker.updateCampaign('direction', 'site');
                const siteInput = document.getElementById('site-url');
                if (siteInput && siteInput.value) {
                    tracker.updateCampaign('profile', siteInput.value);
                }
            } else {
                tracker.updateCampaign('direction', 'rede-social');
                const selectedSocial = document.querySelector('.social-btn.selected');
                const profileInput = document.querySelector('.profile-input:not([style*="display: none"]) input');
                if (selectedSocial && profileInput) {
                    const platform = selectedSocial.textContent.includes('Instagram') ? 'Instagram' : 'WhatsApp';
                    tracker.updateCampaign('socialNetwork', platform);
                    tracker.updateCampaign('profile', profileInput.value);
                }
            }
        }
        
        // Salvar localização
        if (selectedLocation) {
            if (selectedLocation.value === 'estado') {
                const estado = document.getElementById('estado-select').value;
                tracker.updateCampaign('location', estado || 'Todo o Brasil');
            } else if (selectedLocation.value === 'cidade') {
                // Usar this.cidadeSelecionada se disponível, senão tentar buscar no DOM
                if (window.campaignCreator && window.campaignCreator.cidadeSelecionada) {
                    const cidade = window.campaignCreator.cidadeSelecionada;
                    const estadoNome = window.campaignCreator.getEstadoNome(cidade.codigo_uf);
                    if (window.campaignCreator.cidadeInteira || (document.getElementById('cidade-toda-checkbox') && document.getElementById('cidade-toda-checkbox').checked)) {
                        // Cidade inteira: salvar apenas o nome da cidade
                        tracker.updateCampaign('location', `${cidade.nome}`);
                    } else {
                        const radiusSlider = document.getElementById('radius-slider');
                        const radiusKm = radiusSlider ? radiusSlider.value : '25';
                        tracker.updateCampaign('location', `${cidade.nome} - ${estadoNome} (${radiusKm}km)`);
                    }
                } else {
                    const cidadeElement = document.querySelector('#cidade-selecionada .cidade-nome');
                    if (cidadeElement) {
                        const cidadeText = cidadeElement.textContent;
                        let locationText = cidadeText;
                        const isCidadeInteira = (document.getElementById('cidade-toda-checkbox') && document.getElementById('cidade-toda-checkbox').checked);
                        if (!cidadeText.includes('(')) {
                            if (isCidadeInteira) {
                                // Cidade inteira: salvar apenas o nome exibido
                                locationText = `${cidadeText}`;
                            } else {
                                const radiusSlider = document.getElementById('radius-slider');
                                const radiusKm = radiusSlider ? radiusSlider.value : '25';
                                locationText = `${cidadeText} (${radiusKm}km)`;
                            }
                        }
                        tracker.updateCampaign('location', locationText);
                    } else {
                        tracker.updateCampaign('location', 'Todo o Brasil');
                    }
                }
            } else {
                tracker.updateCampaign('location', 'Todo o Brasil');
            }
        }
        
        // Salvar gênero
        if (selectedGender) {
            tracker.updateCampaign('gender', selectedGender.textContent.trim());
        }
        
        // Salvar idade
        if (ageMin && ageMax) {
            tracker.updateCampaign('age', `${ageMin} - ${ageMax} anos`);
        }
        
        // Salvar mercados
        if (selectedMarkets.length > 0) {
            tracker.updateCampaign('selectedMarkets', selectedMarkets);
            const marketTitles = selectedMarkets.map(market => market.nome).join(', ');
            tracker.updateCampaign('audience', `Público Ad+ • ${marketTitles}`);
        } else {
            tracker.updateCampaign('audience', 'Público Ad+');
        }
        
        console.log('✅ Dados salvos na segunda tela:', tracker.getCampaignData());
    } else {
        console.error('❌ CampaignTracker não encontrado em updateCampaignSummary!');
        console.log('🔍 Tentando criar CampaignTracker diretamente...');
        
        // Tentar criar um CampaignTracker diretamente
        if (typeof CampaignTracker !== 'undefined') {
            try {
                const directTracker = new CampaignTracker();
                console.log('✅ CampaignTracker criado diretamente, salvando dados básicos...');
                
                // Salvar pelo menos o objetivo se disponível
                if (selectedObjective) {
                    directTracker.updateCampaign('objective', selectedObjective.textContent.trim());
                    directTracker.saveCampaign();
                    console.log('✅ Objetivo salvo via CampaignTracker direto');
                }
            } catch (error) {
                console.error('❌ Erro ao criar CampaignTracker direto:', error);
            }
        }
    }
    
    console.log('🏁 updateCampaignSummary finalizada');
}

function showFileMessage() {
        const messageElement = document.getElementById('file-exclusivity-message');
        if (messageElement) {
            messageElement.classList.remove('hidden');
            // Auto-hide após 5 segundos
            setTimeout(() => {
                this.hideFileMessage();
            }, 5000);
        }
    }

function hideFileMessage() {
    const messageElement = document.getElementById('file-exclusivity-message');
    if (messageElement) {
        messageElement.classList.add('hidden');
    }
}

// Funcionalidade do pop-up Advantage+
document.addEventListener('DOMContentLoaded', function() {
    const advantageInfoIcon = document.getElementById('advantage-info-icon');
    const advantagePopup = document.getElementById('advantage-popup');
    const advantagePopupClose = document.getElementById('advantage-popup-close');
    const advantagePopupContent = document.querySelector('.advantage-popup-content');
    const advantagePlusBtn = document.getElementById('advantage-plus-btn');

    // Garantir que o overlay esteja no body para cobrir toda a página
    if (advantagePopup && advantagePopup.parentElement && advantagePopup.parentElement !== document.body) {
        try {
            document.body.appendChild(advantagePopup);
        } catch (err) {
            console.warn('Não foi possível mover advantage-popup para o body:', err);
        }
    }
    
    function closeAdvantagePopup() {
        if (advantagePopup && advantagePopup.classList.contains('show')) {
            advantagePopup.classList.remove('show');
        }
    }
    
    // Abrir pop-up ao clicar no ícone de informação
    if (advantageInfoIcon) {
        advantageInfoIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            if (advantagePopup) {
                advantagePopup.classList.add('show');
            }
        });
    }
    
    // Abrir pop-up ao clicar no botão Público Advantage+
    if (advantagePlusBtn) {
        advantagePlusBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (advantagePopup) {
                advantagePopup.classList.add('show');
            }
        });
    }
    
    // Fechar pop-up ao clicar no botão de fechar
    if (advantagePopupClose) {
        advantagePopupClose.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAdvantagePopup();
        });
    }
    
    // Previne que cliques no conteúdo fechem o popup
    if (advantagePopupContent) {
        advantagePopupContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // Fechar pop-up ao clicar fora (no overlay)
    if (advantagePopup) {
        advantagePopup.addEventListener('click', function(e) {
            // Fecha apenas se o clique for no overlay (fora do conteúdo)
            if (e.target === advantagePopup) {
                closeAdvantagePopup();
            }
        });
    }
    
    // Permite que o fundo continue scrollando como no modal de login
    // (sem bloquear o touchmove no overlay)
    
    // Fechar pop-up com a tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAdvantagePopup();
        }
    });
});

// Função para mostrar notificação de upload em andamento
function showUploadInProgressMessage() {
    // Verificar se já existe uma notificação
    const existingNotification = document.querySelector('.upload-notification');
    if (existingNotification) {
        return; // Não criar duplicatas
    }
    
    // Criar notificação lateral
    const notification = document.createElement('div');
    notification.className = 'upload-notification';
    notification.innerHTML = `
        <div class="upload-notification-content">
            <i class="fas fa-exclamation-triangle" style="color: #ffffff; margin-right: 10px; font-size: 18px;"></i>
            <span>Aguarde finalização do upload do arquivo</span>
            <button class="upload-notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Adicionar estilos CSS inline
    const style = document.createElement('style');
    style.textContent = `
        .upload-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc2626;
            border-left: 4px solid #991b1b;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            animation: slideInRight 0.3s ease-out;
            max-width: 350px;
            min-width: 300px;
        }
        .upload-notification-content {
            display: flex;
            align-items: center;
            padding: 16px 20px;
            position: relative;
        }
        .upload-notification-content span {
            color: #ffffff;
            font-weight: 500;
            font-size: 14px;
            flex: 1;
            line-height: 1.4;
        }
        .upload-notification-close {
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            color: #ffffff;
            cursor: pointer;
            padding: 4px;
            border-radius: 3px;
            transition: background 0.2s;
            font-size: 12px;
        }
        .upload-notification-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        @media (max-width: 768px) {
            .upload-notification {
                top: 10px;
                right: 10px;
                left: 10px;
                max-width: none;
                min-width: auto;
            }
            .upload-notification-content {
                padding: 14px 16px;
            }
            .upload-notification-content span {
                font-size: 13px;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Adicionar notificação ao body
    document.body.appendChild(notification);
    
    // Auto-remover após 4 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }, 4000);
}

// Função global para fechar todos os modais e pop-ups
function closeAllModalsAndPopups() {
    // Fechar pop-up Advantage+
    const advantagePopup = document.getElementById('advantage-popup');
    if (advantagePopup && advantagePopup.classList.contains('show')) {
        advantagePopup.classList.remove('show');
    }
    
    // Fechar modal PIX
    const pixModal = document.getElementById('pix-modal');
    if (pixModal && pixModal.style.display !== 'none') {
        pixModal.style.display = 'none';
    }
    
    // Fechar modal de pagamento PIX
    const pixPaymentModal = document.getElementById('pix-payment-modal');
    if (pixPaymentModal && pixPaymentModal.style.display !== 'none') {
        pixPaymentModal.style.display = 'none';
    }
    
    // Fechar overlay do menu mobile
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    if (mobileMenuOverlay && mobileMenuOverlay.classList.contains('active')) {
        mobileMenuOverlay.classList.remove('active');
    }
}

// Event listener global para fechar modais clicando no fundo
document.addEventListener('DOMContentLoaded', function() {
    // Adicionar event listener para todos os overlays e modais
    const modalsAndOverlays = [
        'advantage-popup',
        'pix-modal', 
        'pix-payment-modal',
        'mobile-menu-overlay'
    ];
    
    modalsAndOverlays.forEach(function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', function(e) {
                // Verificar se o clique foi diretamente no overlay/modal (não no conteúdo)
                if (e.target === modal) {
                    closeAllModalsAndPopups();
                }
            });
        }
    });
    
    // Event listener global para tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModalsAndPopups();
        }
    });
});