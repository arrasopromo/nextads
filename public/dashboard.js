// CampaignTracker agora está em campaign-tracker.js

// Dashboard para visualização dos dados
class CampaignDashboard {
    constructor() {
        this.campaigns = [];
        this.filteredCampaigns = [];
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderTable();
        this.updateStats();
        
        // Verificar se veio do pagamento e destacar campanha específica
        this.handlePaymentRedirect();
    }
    
    handlePaymentRedirect() {
        const redirectFromPayment = localStorage.getItem('redirectFromPayment');
        const viewCampaignId = localStorage.getItem('viewCampaignId');
        
        if (redirectFromPayment === 'true' && viewCampaignId) {
            console.log('✅ [Dashboard] Redirecionamento do pagamento detectado para campanha:', viewCampaignId);
            
            // Limpar flags de redirecionamento
            localStorage.removeItem('redirectFromPayment');
            localStorage.removeItem('viewCampaignId');
            
            // Destacar a campanha na tabela
            setTimeout(() => {
                this.highlightCampaign(viewCampaignId);
            }, 500);
        }
    }
    
    highlightCampaign(campaignId) {
        try {
            // Encontrar a linha da campanha na tabela
            const rows = document.querySelectorAll('#campaigns-table tbody tr');
            rows.forEach(row => {
                const idCell = row.querySelector('td:nth-child(2)');
                if (idCell && idCell.textContent.trim() === campaignId) {
                    // Destacar a linha
                    row.style.backgroundColor = '#d4edda';
                    row.style.border = '2px solid #28a745';
                    
                    // Scroll para a linha
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Remover destaque após 5 segundos
                    setTimeout(() => {
                        row.style.backgroundColor = '';
                        row.style.border = '';
                    }, 5000);
                    
                    console.log('✅ [Dashboard] Campanha destacada:', campaignId);
                }
            });
        } catch (error) {
            console.error('❌ [Dashboard] Erro ao destacar campanha:', error);
        }
    }

    async loadData() {
        console.log('🔍 Dashboard loadData - Carregando exclusivamente do MongoDB...');
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        console.log('📱 Dashboard Info:', {
            isMobile: isMobile,
            userAgent: navigator.userAgent,
            domain: window.location.hostname,
            protocol: window.location.protocol,
            mongoDBOnly: true
        });
        
        // 🎯 DASHBOARD MONGODB: Usar exclusivamente CampaignTracker.getAllCampaigns() com MongoDB
        try {
            console.log('🔍 [MongoDB] Carregando campanhas via CampaignTracker...');
            this.campaigns = await CampaignTracker.getAllCampaigns();
            
            console.log(`📊 [MongoDB] Total de campanhas carregadas: ${this.campaigns.length}`);
            console.log('📋 [MongoDB] Campanhas:', this.campaigns.map(c => ({
                id: c.id || c.campaignId,
                status: c.status,
                created: c.created || c.startTime,
                source: 'MongoDB'
            })));
            
            // Processar e filtrar campanhas
            const validCampaigns = [];
            const seenIds = new Set();
            
            this.campaigns.forEach((campaign, index) => {
                // Usar createdAt como startTime se startTime não existir
                const campaignDate = campaign.startTime || campaign.createdAt;
                
                // Verificar se a campanha tem dados mínimos válidos
                if (!campaignDate || campaignDate === 'undefined' || 
                    (typeof campaignDate === 'string' && campaignDate.includes('undefined'))) {
                    console.log(`🗑️ [MongoDB] Campanha ${index + 1} com data inválida removida:`, campaign);
                    return;
                }
                
                // Verificar se a data é válida
                const testDate = new Date(campaignDate);
                if (isNaN(testDate.getTime())) {
                    console.log(`🗑️ [MongoDB] Campanha ${index + 1} com data inválida removida:`, campaignDate);
                    return;
                }
                
                // Definir startTime se não existir
                if (!campaign.startTime) {
                    campaign.startTime = campaign.createdAt;
                }
                
                // Gerar ID único para deduplicação
                const campaignId = campaign.campaignId || campaign.id || `${campaign.startTime}_${campaign.objective}`;
                if (!seenIds.has(campaignId)) {
                    seenIds.add(campaignId);
                    validCampaigns.push(campaign);
                    console.log(`✅ [MongoDB] Campanha ${index + 1} adicionada: ${campaignId}`);
                } else {
                    console.log(`🔄 [MongoDB] Campanha ${index + 1} duplicada removida: ${campaignId}`);
                }
            });
            
            this.campaigns = validCampaigns;
            
            // Ordenar por data de criação decrescente (mais novo primeiro)
            this.campaigns.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            this.filteredCampaigns = [...this.campaigns];
            
            console.log(`🎯 [MongoDB] Dashboard carregado com ${this.campaigns.length} campanhas válidas`);
            console.log('✅ Dashboard: Loaded campaigns from MongoDB:', this.campaigns.length, 'campaigns');
            
            return;
        } catch (error) {
            console.error('❌ [MongoDB] Erro ao carregar campanhas via CampaignTracker:', error);
            this.campaigns = [];
            this.filteredCampaigns = [];
        }
    }

    // Método para atualizar dados sem recriar instância
    refresh() {
        console.log('🔄 Refreshing dashboard data...');
        this.loadData();
        this.renderTable();
        this.updateStats();
    }

    clearFilters() {
        const startDateInput = document.getElementById('date-from');
        const endDateInput = document.getElementById('date-to');
        const statusFilterSelect = document.getElementById('status-filter');
        const searchIdInput = document.getElementById('search-id');

        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        if (statusFilterSelect) statusFilterSelect.value = 'all';
        if (searchIdInput) searchIdInput.value = '';

        this.applyFilters();
    }



    setupEventListeners() {
        const startDateInput = document.getElementById('date-from');
        const endDateInput = document.getElementById('date-to');
        const statusFilterSelect = document.getElementById('status-filter');
        const searchIdInput = document.getElementById('search-id');
        const applyFiltersBtn = document.getElementById('apply-filters');
        const clearFiltersBtn = document.getElementById('clear-filters');
        const exportBtn = document.getElementById('export-excel');
        const clearBtn = document.getElementById('clear-data');
        const refreshBtn = document.getElementById('refresh-data');

        if (startDateInput) startDateInput.addEventListener('change', () => this.applyFilters());
        if (endDateInput) endDateInput.addEventListener('change', () => this.applyFilters());
        if (statusFilterSelect) statusFilterSelect.addEventListener('change', () => this.applyFilters());
        if (searchIdInput) searchIdInput.addEventListener('input', () => this.applyFilters());
        if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel());
        if (clearBtn) clearBtn.addEventListener('click', () => this.showClearDataModal());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshData());
        

        
        // Checkbox "selecionar todos"
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const rowCheckboxes = document.querySelectorAll('.row-checkbox');
                rowCheckboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });
        }
        
        // Auto-refresh quando a página ganha foco (usuário volta de outra página)
        window.addEventListener('focus', () => {
            console.log('Dashboard gained focus, refreshing data...');
            this.refresh();
        });
        
        // Auto-refresh a cada 30 segundos para capturar mudanças do MongoDB
        setInterval(() => {
            this.refresh();
        }, 30000);
        
        // Listener para mudanças via eventos customizados (MongoDB updates)
        window.addEventListener('campaignDataUpdated', () => {
            console.log('🔄 Campaign data updated in MongoDB, refreshing dashboard...');
            this.refresh();
        });
    }

    applyFilters() {
        const startDate = document.getElementById('date-from')?.value;
        const endDate = document.getElementById('date-to')?.value;
        const statusFilter = document.getElementById('status-filter')?.value;
        const searchId = document.getElementById('search-id')?.value?.toLowerCase() || '';

        this.filteredCampaigns = this.campaigns.filter(campaign => {
            let include = true;

            // Filtro de busca por ID (regra "contém")
            if (searchId && searchId.trim() !== '') {
                const campaignId = (campaign.campaignId || campaign.id || '').toLowerCase();
                if (!campaignId.includes(searchId.trim())) {
                    include = false;
                }
            }

            // Filtro de data inicial
            if (startDate) {
                const campaignDate = new Date(campaign.startTime);
                const filterDate = new Date(startDate);
                if (campaignDate < filterDate) include = false;
            }

            // Filtro de data final
            if (endDate) {
                const campaignDate = new Date(campaign.startTime);
                const filterDate = new Date(endDate);
                if (campaignDate > filterDate) include = false;
            }

            if (statusFilter && statusFilter !== 'all') {
                const isCompleted = campaign.completed || campaign.isCompleted || campaign.status === 'completed' || campaign.status === 'concluída';
                const isAbandoned = campaign.abandonedAt || campaign.isAbandoned || campaign.status === 'abandoned' || campaign.status === 'abandonada';
                const isActive = campaign.status === 'active' || campaign.status === 'ativa';
                
                if (statusFilter === 'completed' && !isCompleted) {
                    include = false;
                }
                if (statusFilter === 'abandoned' && !isAbandoned) {
                    include = false;
                }
                if (statusFilter === 'in_progress' && (isCompleted || isAbandoned)) {
                    include = false;
                }
                if (statusFilter === 'active' && !isActive && !(!isCompleted && !isAbandoned)) {
                    include = false;
                }
            }

            return include;
        });
        
        // Manter ordenação decrescente após filtros
        this.filteredCampaigns.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        this.renderTable();
        this.updateStats();
    }

    renderTable() {

        console.log('  - this.campaigns:', this.campaigns ? this.campaigns.length : 'undefined');
        console.log('  - this.filteredCampaigns:', this.filteredCampaigns ? this.filteredCampaigns.length : 'undefined');
        
        const tbody = document.querySelector('#campaigns-tbody');
        if (!tbody) {
            console.error('❌ Dashboard: Table tbody not found');
            return;
        }
        
        console.log('✅ Table tbody found, proceeding with rendering');
        console.log('📊 Rendering table with', this.filteredCampaigns.length, 'campaigns');
        console.log('🔍 Campanhas disponíveis:', this.campaigns.map(c => c.id));
        
        // Limpar conteúdo anterior
        tbody.innerHTML = '';
        
        // Verificar se há campanhas para renderizar
        if (!this.filteredCampaigns || this.filteredCampaigns.length === 0) {
            console.log('⚠️ No campaigns to render - showing empty message');
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="8" class="text-center">Nenhuma campanha encontrada</td>';
            tbody.appendChild(emptyRow);
            return;
        }
        
        this.filteredCampaigns.forEach(campaign => {
            const row = document.createElement('tr');
            
            // Data/Hora - validar se a data é válida
            let startTime = 'Data inválida';
            if (campaign.startTime) {
                const date = new Date(campaign.startTime);
                if (!isNaN(date.getTime())) {
                    startTime = date.toLocaleString('pt-BR');
                }
            }
            
            // Objetivo
            const objective = campaign.objective || 'Não informado';
            
            // Direcionamento
            const direction = campaign.direction || 'Não informado';
            
            // Mapear perfil baseado no profileData, direction ou campos diretos
            let profile = 'N/A';
            
            // Primeiro, tentar usar profileData se disponível
            if (campaign.profileData) {
                if (campaign.profileData.platform === 'instagram') {
                    if (campaign.profileData.username) {
                        profile = `@${campaign.profileData.username}`;
                    } else if (campaign.profileData.displayName) {
                        profile = `@${campaign.profileData.displayName}`;
                    }
                } else if (campaign.profileData.platform === 'whatsapp') {
                    if (campaign.profileData.phoneNumber) {
                        profile = campaign.profileData.phoneNumber;
                    } else if (campaign.profileData.profileName) {
                        profile = campaign.profileData.profileName;
                    }
                } else if (campaign.profileData.platform === 'site' && campaign.profileData.siteUrl) {
                    profile = campaign.profileData.siteUrl;
                }
            }
            // Se profileData não tem dados úteis, usar campo profile direto
            else if (campaign.profile && campaign.profile !== 'Não informado' && campaign.profile !== 'Perfil validado') {
                profile = campaign.profile;
            }
            // Fallback para campos específicos baseados na direção
            else {
                if (campaign.direction === 'instagram') {
                    if (campaign.instagramProfile) {
                        profile = campaign.instagramProfile.startsWith('@') ? campaign.instagramProfile : `@${campaign.instagramProfile}`;
                    } else if (campaign.socialNetwork) {
                        profile = campaign.socialNetwork.startsWith('@') ? campaign.socialNetwork : `@${campaign.socialNetwork}`;
                    }
                } else if (campaign.direction === 'whatsapp') {
                    if (campaign.whatsappProfile) {
                        profile = campaign.whatsappProfile;
                    } else if (campaign.socialNetwork) {
                        profile = campaign.socialNetwork;
                    }
                } else if (campaign.direction === 'site' && campaign.siteUrl) {
                    profile = campaign.siteUrl;
                }
            }
            
            // Profile data mapping completed
            
            // Gênero
            const gender = campaign.gender || 'Todos';
            
            // Idade
            const age = campaign.age || campaign.ageGroup || 'N/A';
            
            // Localização - priorizar estado se selecionado
            let location = 'Não informado';
            if (campaign.selectedState) {
                location = campaign.selectedState;
            } else if (campaign.location === 'brasil') {
                location = 'Brasil';
            } else if (campaign.location) {
                location = campaign.location;
            }
            
            // Mapear criativo - verificar múltiplas fontes de arquivos
            let creative = 'Nenhum arquivo';
            let creativeFiles = [];
            
            // DEBUG: Log da campanha completa para verificar estrutura
            console.log('🔍 [DEBUG] Estrutura completa da campanha:', {
                id: campaign.id || campaign.campaignId,
                files: campaign.files,
                uploadedFiles: campaign.uploadedFiles,
                campaignData: campaign.campaignData,
                allKeys: Object.keys(campaign)
            });
            
            // Buscar arquivos em todas as possíveis localizações
            let allFiles = [];
            
            // 1. Verificar campaign.files
            if (campaign.files && Array.isArray(campaign.files) && campaign.files.length > 0) {
                allFiles = [...allFiles, ...campaign.files];
            }
            
            // 2. Verificar campaign.uploadedFiles
            if (campaign.uploadedFiles && Array.isArray(campaign.uploadedFiles) && campaign.uploadedFiles.length > 0) {
                allFiles = [...allFiles, ...campaign.uploadedFiles];
            }
            
            // 3. Verificar campaign.campaignData.files
            if (campaign.campaignData && campaign.campaignData.files && Array.isArray(campaign.campaignData.files) && campaign.campaignData.files.length > 0) {
                allFiles = [...allFiles, ...campaign.campaignData.files];
            }
            
            // 4. Verificar propriedades diretas que podem conter arquivos
            const fileProps = ['filesUploaded', 'attachments', 'media'];
            fileProps.forEach(prop => {
                if (campaign[prop] && Array.isArray(campaign[prop]) && campaign[prop].length > 0) {
                    allFiles = [...allFiles, ...campaign[prop]];
                }
            });
            
            // Remover duplicatas baseado no nome do arquivo
            const uniqueFiles = allFiles.filter((file, index, self) => 
                index === self.findIndex(f => (f.nome || f.name) === (file.nome || file.name))
            );
            
            if (uniqueFiles.length > 0) {
                creative = `${uniqueFiles.length} arquivo${uniqueFiles.length > 1 ? 's' : ''}`;
                creativeFiles = uniqueFiles;
            }
            
            // Duração
            const duration = campaign.duration || 'Não informado';
            
            // Status - verificar múltiplos campos
            let status = 'Em andamento';
            let statusClass = 'status-progress';
            
            if (campaign.completed || campaign.isCompleted || campaign.status === 'completed' || campaign.status === 'concluída') {
                status = 'Concluída';
                statusClass = 'status-completed';
            } else if (campaign.abandonedAt || campaign.isAbandoned || campaign.status === 'abandoned' || campaign.status === 'abandonada') {
                status = 'Abandonada';
                statusClass = 'status-abandoned';
            } else if (campaign.status === 'active' || campaign.status === 'ativa') {
                status = 'Ativa';
                statusClass = 'status-active';
            }
            
            // Progresso - usar dados reais do currentProgress do MongoDB
            let progressValue = 0;
            
            // Priorizar currentProgress do MongoDB (valor real)
            if (campaign.currentProgress && typeof campaign.currentProgress === 'number') {
                progressValue = campaign.currentProgress;
            } 
            // Fallback: calcular baseado em progressSteps se disponível
            else if (campaign.progressSteps && typeof campaign.progressSteps === 'object') {
                const completedSteps = Object.values(campaign.progressSteps).filter(step => step && step.completed === true);
                progressValue = completedSteps.length;
            }
            // Fallback: usar completedSteps para campanhas antigas
            else if (campaign.completedSteps && Array.isArray(campaign.completedSteps)) {
                progressValue = campaign.completedSteps.length;
            }
            // Último fallback: assumir 1 etapa se tiver startTime válido
            else if (campaign.startTime && campaign.startTime !== 'undefined') {
                progressValue = 1;
            }
            
            // Garantir que o valor seja válido (mínimo 0, máximo 4 para campanhas normais)
            progressValue = Math.max(0, Math.min(progressValue, 4));
            const progress = `${progressValue} etapas`;

            // Público/Audience - priorizar campo audience, depois markets
            let audience = 'Público Ad+';
            
            // Primeiro, verificar se há dados específicos de audience
            if (campaign.audience && campaign.audience !== 'ad+') {
                audience = campaign.audience;
            }
            // Se não, verificar markets
            else if (campaign.markets && campaign.markets !== 'Público Ad+') {
                audience = campaign.markets;
            }
            // Verificar selectedMarkets como fallback
            else if (campaign.selectedMarkets && campaign.selectedMarkets.length > 0) {
                const marketTitles = campaign.selectedMarkets.map(market => market.nome || market).join(', ');
                audience = `Público Ad+ • ${marketTitles}`;
            }
            
            // Audience data mapping completed

            // ID da campanha - usar campaignId se disponível, senão usar id
            const campaignId = campaign.campaignId || campaign.id || 'N/A';
            
            // Extrair dados UTM da campanha
            const utmSource = campaign.utm_source || campaign.campaignData?.utm_source || '-';
            const utmMedium = campaign.utm_medium || campaign.campaignData?.utm_medium || '-';
            const utmCampaign = campaign.utm_campaign || campaign.campaignData?.utm_campaign || '-';
            const utmTerm = campaign.utm_term || campaign.campaignData?.utm_term || '-';
            const utmContent = campaign.utm_content || campaign.campaignData?.utm_content || '-';
            
            row.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-campaign-id="${campaignId}"></td>
                <td style="font-family: monospace; font-size: 0.9em;">${campaignId}</td>
                <td>${startTime}</td>
                <td>${objective}</td>
                <td class="direction-cell" data-direction="${direction}" style="cursor: pointer; color: #007bff;">${direction}</td>
                <td>${audience}</td>
                <td class="profile-cell" data-profile="${profile}" style="cursor: pointer; color: #007bff;">${profile}</td>
                <td>${gender}</td>
                <td>${age}</td>
                <td>${location}</td>
                <td class="creative-cell" data-files='${JSON.stringify(creativeFiles)}' style="cursor: pointer; color: #007bff;">${creative}</td>
                <td>${duration}</td>
                <td style="font-size: 0.85em;">${utmSource}</td>
                <td style="font-size: 0.85em;">${utmMedium}</td>
                <td style="font-size: 0.85em;">${utmCampaign}</td>
                <td style="font-size: 0.85em;">${utmTerm}</td>
                <td style="font-size: 0.85em;">${utmContent}</td>
                <td><span class="status ${statusClass}">${status}</span></td>
                <td>${progress}</td>
            `;
            
            // Adicionar evento de clique para copiar o direcionamento
            const directionCell = row.querySelector('.direction-cell');
            if (directionCell) {
                directionCell.addEventListener('click', () => {
                    const directionText = directionCell.getAttribute('data-direction');
                    navigator.clipboard.writeText(directionText).then(() => {
                        // Feedback visual
                        const originalText = directionCell.textContent;
                        directionCell.textContent = 'Copiado!';
                        directionCell.style.background = '#c6f6d5';
                        directionCell.style.color = '#22543d';
                        
                        setTimeout(() => {
                            directionCell.textContent = originalText;
                            directionCell.style.background = '';
                            directionCell.style.color = '#007bff';
                        }, 1500);
                    }).catch(err => {
                        console.error('Erro ao copiar:', err);
                        alert('Erro ao copiar o direcionamento');
                    });
                });
            }
            
            // Adicionar evento de clique para copiar o perfil
            const profileCell = row.querySelector('.profile-cell');
            if (profileCell) {
                profileCell.addEventListener('click', () => {
                    const profileText = profileCell.getAttribute('data-profile');
                    navigator.clipboard.writeText(profileText).then(() => {
                        // Feedback visual
                        const originalText = profileCell.textContent;
                        profileCell.textContent = 'Copiado!';
                        profileCell.style.background = '#c6f6d5';
                        profileCell.style.color = '#22543d';
                        
                        setTimeout(() => {
                            profileCell.textContent = originalText;
                            profileCell.style.background = '';
                            profileCell.style.color = '#007bff';
                        }, 1500);
                    }).catch(err => {
                        console.error('Erro ao copiar:', err);
                        alert('Erro ao copiar o link');
                    });
                });
            }
            
            tbody.appendChild(row);
        });
        
        // Adicionar event listeners para células de criativo após renderizar
        this.addCreativeClickListeners();
    }

    addCreativeClickListeners() {
        const creativeCells = document.querySelectorAll('.creative-cell');
        creativeCells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                const filesData = e.target.getAttribute('data-files');
                if (filesData && filesData !== '[]') {
                    try {
                        const files = JSON.parse(filesData);
                        this.showCreativeModal(files);
                    } catch (error) {
                        console.error('Erro ao parsear dados dos arquivos:', error);
                    }
                }
            });
        });
    }

    showCreativeModal(files) {
        // Criar modal se não existir
        let modal = document.getElementById('creative-modal');
        if (!modal) {
            modal = this.createCreativeModal();
            document.body.appendChild(modal);
        }

        // Limpar conteúdo anterior
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = '';

        // Adicionar arquivos ao modal
        files.forEach((file, index) => {
            const fileElement = this.createFilePreview(file, index);
            modalBody.appendChild(fileElement);
        });

        // Mostrar modal
        modal.style.display = 'flex';
    }

    createCreativeModal() {
        const modal = document.createElement('div');
        modal.id = 'creative-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3><i class="fas fa-images"></i> Criativos da Campanha</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; padding: 25px;">
                    <!-- Arquivos serão inseridos aqui -->
                </div>
            </div>
        `;

        // Fechar modal ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Adicionar event listener para o botão de fechar
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        return modal;
    }

    createFilePreview(file, index) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'creative-preview';
        fileDiv.style.cssText = `
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px;
            text-align: center;
            background: white;
            transition: all 0.3s ease;
        `;

        const fileName = file.nome || file.name || `Arquivo ${index + 1}`;
        const fileSize = file.size || file.tamanho ? this.formatFileSize(file.size || file.tamanho) : '';
        const fileType = file.type || file.tipo || this.getFileTypeFromName(fileName);
        
        console.log('🔍 [DEBUG] Dados do arquivo no dashboard:', {
            file: file,
            fileName: fileName,
            fileType: fileType,
            originalType: file.type || file.tipo,
            derivedType: this.getFileTypeFromName(fileName)
        });

        let previewContent = '';
        if (fileType.startsWith('image/')) {
            // Construir URL correta para o arquivo
            let imageUrl = '';
            if (file.url) {
                imageUrl = file.url;
            } else if (file.dataUrl) {
                imageUrl = file.dataUrl;
            } else if (file.data) {
                imageUrl = `data:${fileType};base64,${file.data}`;
            } else if (file.filename || fileName) {
                // Usar o nome do arquivo para construir a URL do servidor
                const filename = file.filename || fileName;
                imageUrl = `/uploads/${filename}`;
            }
            
            if (imageUrl) {
                previewContent = `
                    <div style="margin-bottom: 15px;">
                        <img src="${imageUrl}" alt="${fileName}" 
                             style="max-width: 100%; max-height: 200px; border-radius: 8px; object-fit: cover;"
                             class="preview-image">
                        <div style="display: none; padding: 40px; background: #f7fafc; border-radius: 8px; color: #718096;" class="image-error-fallback">
                            <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 10px;"></i>
                            <p>Imagem não disponível</p>
                        </div>
                    </div>
                `;
            }
        } else if (fileType.startsWith('video/')) {
            // Construir URL correta para o arquivo
            let videoUrl = '';
            if (file.url) {
                videoUrl = file.url;
            } else if (file.dataUrl) {
                videoUrl = file.dataUrl;
            } else if (file.data) {
                videoUrl = `data:${fileType};base64,${file.data}`;
            } else if (file.filename || fileName) {
                // Usar o nome do arquivo para construir a URL do servidor
                const filename = file.filename || fileName;
                videoUrl = `/uploads/${filename}`;
            }
            
            if (videoUrl) {
                previewContent = `
                    <div style="margin-bottom: 15px;">
                        <video controls style="max-width: 100%; max-height: 200px; border-radius: 8px;"
                               class="preview-video">
                            <source src="${videoUrl}" type="${fileType}">
                            Seu navegador não suporta vídeo.
                        </video>
                        <div style="display: none; padding: 40px; background: #f7fafc; border-radius: 8px; color: #718096;" class="video-error-fallback">
                            <i class="fas fa-video" style="font-size: 3rem; margin-bottom: 10px;"></i>
                            <p>Vídeo não disponível</p>
                        </div>
                    </div>
                `;
            }
        } else {
            previewContent = `
                <div style="margin-bottom: 15px; padding: 40px; background: #f7fafc; border-radius: 8px;">
                    <i class="fas fa-file" style="font-size: 3rem; color: #cbd5e0; margin-bottom: 10px;"></i>
                </div>
            `;
        }

        fileDiv.innerHTML = `
            ${previewContent}
            <div style="margin-bottom: 15px;">
                <h4 style="font-size: 0.9rem; color: #2d3748; margin-bottom: 5px; word-break: break-word;">${fileName}</h4>
                ${fileSize ? `<p style="font-size: 0.8rem; color: #718096; margin: 0;">${fileSize}</p>` : ''}
            </div>
            <button class="download-btn" 
                    style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; 
                           padding: 8px 16px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; 
                           transition: all 0.3s ease; display: flex; align-items: center; gap: 5px; margin: 0 auto;">
                <i class="fas fa-download"></i> Baixar
            </button>
        `;

        // Adicionar evento de download
        const downloadBtn = fileDiv.querySelector('button');
        downloadBtn.addEventListener('click', () => {
            this.downloadFile(fileName, file.url || file.dataUrl || '', fileType, file.data);
        });

        // Adicionar event listeners para substituir os event handlers inline removidos
        const previewImage = fileDiv.querySelector('.preview-image');
        if (previewImage) {
            previewImage.addEventListener('error', function() {
                this.style.display = 'none';
                const errorFallback = this.nextElementSibling;
                if (errorFallback && errorFallback.classList.contains('image-error-fallback')) {
                    errorFallback.style.display = 'block';
                }
            });
        }

        const previewVideo = fileDiv.querySelector('.preview-video');
        if (previewVideo) {
            previewVideo.addEventListener('error', function() {
                this.style.display = 'none';
                const errorFallback = this.nextElementSibling;
                if (errorFallback && errorFallback.classList.contains('video-error-fallback')) {
                    errorFallback.style.display = 'block';
                }
            });
        }

        return fileDiv;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileTypeFromName(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
        
        if (imageTypes.includes(extension)) {
            return `image/${extension === 'jpg' ? 'jpeg' : extension}`;
        } else if (videoTypes.includes(extension)) {
            return `video/${extension}`;
        }
        return 'application/octet-stream';
    }

    downloadFile(fileName, fileUrl, fileType, fileData) {
        try {
            let downloadUrl = fileUrl;
            
            // Se não há URL mas há dados base64, criar URL
            if (!downloadUrl && fileData) {
                downloadUrl = `data:${fileType};base64,${fileData}`;
            }
            
            if (downloadUrl) {
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = fileName;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert('Arquivo não disponível para download.');
            }
        } catch (error) {
            console.error('Erro ao baixar arquivo:', error);
            alert('Erro ao baixar arquivo.');
        }
    }

    updateStats() {
        const totalElement = document.getElementById('total-campaigns');
        const completedElement = document.getElementById('completed-campaigns');
        const abandonedElement = document.getElementById('abandoned-campaigns');
        const conversionElement = document.getElementById('completion-rate');
        const recordsCountElement = document.getElementById('records-count');

        const total = this.filteredCampaigns.length;
        // Verificar múltiplos campos para campanhas concluídas
        const completed = this.filteredCampaigns.filter(c => 
            c.completed || c.isCompleted || c.status === 'completed' || c.status === 'concluída'
        ).length;
        // Verificar múltiplos campos para campanhas abandonadas
        const abandoned = this.filteredCampaigns.filter(c => 
            c.abandonedAt || c.isAbandoned || c.status === 'abandoned' || c.status === 'abandonada'
        ).length;
        const conversionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

        console.log('📊 Estatísticas atualizadas:', {
            total,
            completed,
            abandoned,
            conversionRate: conversionRate + '%'
        });

        if (totalElement) totalElement.textContent = total;
        if (completedElement) completedElement.textContent = completed;
        if (abandonedElement) abandonedElement.textContent = abandoned;
        if (conversionElement) conversionElement.textContent = conversionRate + '%';
        if (recordsCountElement) recordsCountElement.textContent = `${total} registros encontrados`;
    }

    refresh() {
        this.loadData();
        this.applyFilters();
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refresh-data');
        const refreshIcon = refreshBtn?.querySelector('i');
        
        try {
            // Feedback visual - botão desabilitado e ícone girando
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.style.opacity = '0.7';
            }
            if (refreshIcon) {
                refreshIcon.style.animation = 'spin 1s linear infinite';
            }
            
            console.log('🔄 Atualizando dados do dashboard...');
            
            // Recarregar dados do MongoDB
            await this.loadData();
            this.applyFilters();
            this.updateStats();
            
            console.log('✅ Dados atualizados com sucesso!');
            
            // Mostrar feedback de sucesso
            this.showRefreshFeedback('Dados atualizados com sucesso!', 'success');
            
        } catch (error) {
            console.error('❌ Erro ao atualizar dados:', error);
            this.showRefreshFeedback('Erro ao atualizar dados', 'error');
        } finally {
            // Restaurar botão
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.style.opacity = '1';
            }
            if (refreshIcon) {
                refreshIcon.style.animation = '';
            }
        }
    }
    
    showRefreshFeedback(message, type) {
        // Criar elemento de feedback
        const feedback = document.createElement('div');
        feedback.className = `refresh-feedback ${type}`;
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            ${type === 'success' ? 'background: linear-gradient(135deg, #48bb78, #38a169);' : 'background: linear-gradient(135deg, #f56565, #e53e3e);'}
        `;
        
        document.body.appendChild(feedback);
        
        // Animar entrada
        setTimeout(() => {
            feedback.style.transform = 'translateX(0)';
        }, 100);
        
        // Remover após 3 segundos
        setTimeout(() => {
            feedback.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(feedback);
            }, 300);
        }, 3000);
    }

    exportToExcel() {
        if (this.filteredCampaigns.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }

        // Carregar SheetJS dinamicamente
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => {
                this.exportToExcel(); // Chamar novamente após carregar
            };
            document.head.appendChild(script);
            return;
        }

        // Headers completos incluindo todas as colunas da tabela
        const headers = [
            'ID da Campanha',
            'Data/Hora Início', 
            'Objetivo',
            'Direcionamento',
            'Público',
            'Perfil',
            'Gênero',
            'Idade',
            'Localização',
            'Criativo',
            'Duração',
            'UTM Source',
            'UTM Medium', 
            'UTM Campaign',
            'UTM Term',
            'UTM Content',
            'Status',
            'Progresso'
        ];
        
        const data = [];
        data.push(headers); // Adicionar cabeçalhos
        
        this.filteredCampaigns.forEach(campaign => {
            // Usar EXATAMENTE a mesma lógica da renderTable
            
            // Data/Hora - mesma lógica da renderTable
            let startTime = 'Não informado';
            if (campaign.startTime && campaign.startTime !== 'undefined') {
                const date = new Date(campaign.startTime);
                if (!isNaN(date.getTime())) {
                    startTime = date.toLocaleString('pt-BR');
                }
            }
            
            // Objetivo - mesma lógica da renderTable
            const objective = campaign.objective || campaign.campaignData?.objective || 'Não informado';
            
            // Direcionamento - mesma lógica da renderTable
            const direction = campaign.direction || campaign.campaignData?.direction || 'Não informado';
            
            // Perfil - mesma lógica da renderTable
            let profile = 'Não informado';
            if (campaign.profile) {
                profile = campaign.profile;
            } else if (campaign.campaignData?.profile) {
                profile = campaign.campaignData.profile;
            } else if (campaign.campaignData?.selectedProfile) {
                profile = campaign.campaignData.selectedProfile;
            }
            
            // Gênero - mesma lógica da renderTable
            const gender = campaign.gender || campaign.campaignData?.gender || campaign.campaignData?.selectedGender || 'Não informado';
            
            // Idade - mesma lógica da renderTable
            const age = campaign.age || campaign.campaignData?.age || campaign.campaignData?.selectedAge || 'Não informado';
            
            // Localização - mesma lógica da renderTable
            let location = 'Não informado';
            if (campaign.location) {
                location = campaign.location;
            } else if (campaign.campaignData?.location) {
                location = campaign.campaignData.location;
            } else if (campaign.campaignData?.selectedState) {
                location = campaign.campaignData.selectedState;
            }
            
            // Criativo - EXATAMENTE a mesma lógica complexa da renderTable
            let creative = 'Nenhum arquivo';
            let allFiles = [];
            
            // 1. Verificar campaign.files
            if (campaign.files && Array.isArray(campaign.files) && campaign.files.length > 0) {
                allFiles = [...allFiles, ...campaign.files];
            }
            
            // 2. Verificar campaign.uploadedFiles
            if (campaign.uploadedFiles && Array.isArray(campaign.uploadedFiles) && campaign.uploadedFiles.length > 0) {
                allFiles = [...allFiles, ...campaign.uploadedFiles];
            }
            
            // 3. Verificar campaign.campaignData.files
            if (campaign.campaignData && campaign.campaignData.files && Array.isArray(campaign.campaignData.files) && campaign.campaignData.files.length > 0) {
                allFiles = [...allFiles, ...campaign.campaignData.files];
            }
            
            // 4. Verificar propriedades diretas que podem conter arquivos
            const fileProps = ['filesUploaded', 'attachments', 'media'];
            fileProps.forEach(prop => {
                if (campaign[prop] && Array.isArray(campaign[prop]) && campaign[prop].length > 0) {
                    allFiles = [...allFiles, ...campaign[prop]];
                }
            });
            
            // Remover duplicatas baseado no nome do arquivo
            const uniqueFiles = allFiles.filter((file, index, self) => 
                index === self.findIndex(f => (f.nome || f.name) === (file.nome || file.name))
            );
            
            if (uniqueFiles.length > 0) {
                creative = `${uniqueFiles.length} arquivo${uniqueFiles.length > 1 ? 's' : ''}`;
            }
            
            // Duração - mesma lógica da renderTable
            const duration = campaign.duration || 'Não informado';
            
            // Status - EXATAMENTE a mesma lógica da renderTable
            let status = 'Em andamento';
            if (campaign.completed || campaign.isCompleted || campaign.status === 'completed' || campaign.status === 'concluída') {
                status = 'Concluída';
            } else if (campaign.abandonedAt || campaign.isAbandoned || campaign.status === 'abandoned' || campaign.status === 'abandonada') {
                status = 'Abandonada';
            } else if (campaign.status === 'active' || campaign.status === 'ativa') {
                status = 'Ativa';
            }
            
            // Progresso - EXATAMENTE a mesma lógica da renderTable
            let progressValue = 0;
            if (campaign.currentProgress && typeof campaign.currentProgress === 'number' && campaign.currentProgress > 0) {
                progressValue = Math.min(campaign.currentProgress, 4); // Máximo 4 etapas
            } else if (campaign.completedSteps && campaign.completedSteps.length > 0) {
                // Fallback para campanhas antigas
                progressValue = Math.min(campaign.completedSteps.length, 4);
            } else {
                // Para campanhas sem progresso definido, assumir pelo menos 1 etapa se tiver startTime válido
                progressValue = (campaign.startTime && campaign.startTime !== 'undefined') ? 1 : 0;
            }
            const progress = `${progressValue} etapas`;
            
            // Público/Audience - EXATAMENTE a mesma lógica da renderTable
            let audience = 'Público Ad+';
            
            // Primeiro, verificar se há dados específicos de audience
            if (campaign.audience && campaign.audience !== 'ad+') {
                audience = campaign.audience;
            }
            // Se não, verificar markets
            else if (campaign.markets && campaign.markets !== 'Público Ad+') {
                audience = campaign.markets;
            }
            // Verificar selectedMarkets como fallback
            else if (campaign.selectedMarkets && campaign.selectedMarkets.length > 0) {
                const marketTitles = campaign.selectedMarkets.map(market => market.nome || market).join(', ');
                audience = `Público Ad+ • ${marketTitles}`;
            }
            
            // ID da campanha - mesma lógica da renderTable
            const campaignId = campaign.campaignId || campaign.id || 'N/A';
            
            // Extrair dados UTM - EXATAMENTE a mesma lógica da renderTable
            const utmSource = campaign.utm_source || campaign.campaignData?.utm_source || '-';
            const utmMedium = campaign.utm_medium || campaign.campaignData?.utm_medium || '-';
            const utmCampaign = campaign.utm_campaign || campaign.campaignData?.utm_campaign || '-';
            const utmTerm = campaign.utm_term || campaign.campaignData?.utm_term || '-';
            const utmContent = campaign.utm_content || campaign.campaignData?.utm_content || '-';
            
            const row = [
                campaignId,
                startTime,
                objective,
                direction,
                audience,
                profile,
                gender,
                age,
                location,
                creative,
                duration,
                utmSource,
                utmMedium,
                utmCampaign,
                utmTerm,
                utmContent,
                status,
                progress
            ];
            
            data.push(row);
        });

        // Criar workbook e worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Definir larguras das colunas
        const colWidths = [
            { wch: 25 }, // ID da Campanha
            { wch: 20 }, // Data/Hora
            { wch: 15 }, // Objetivo
            { wch: 20 }, // Direcionamento
            { wch: 20 }, // Público
            { wch: 15 }, // Perfil
            { wch: 12 }, // Gênero
            { wch: 15 }, // Idade
            { wch: 15 }, // Localização
            { wch: 15 }, // Criativo
            { wch: 15 }, // Duração
            { wch: 12 }, // UTM Source
            { wch: 12 }, // UTM Medium
            { wch: 15 }, // UTM Campaign
            { wch: 12 }, // UTM Term
            { wch: 12 }, // UTM Content
            { wch: 12 }, // Status
            { wch: 12 }  // Progresso
        ];
        ws['!cols'] = colWidths;
        
        // Estilizar cabeçalho
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4472C4" } },
            alignment: { horizontal: "center", vertical: "center" }
        };
        
        // Aplicar estilo ao cabeçalho
        for (let col = 0; col < headers.length; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellRef]) ws[cellRef] = {};
            ws[cellRef].s = headerStyle;
        }
        
        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, "Campanhas");
        
        // Gerar e baixar arquivo
        const fileName = `campanhas_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    showClearDataModal() {
        console.log('🔍 Verificando campanhas selecionadas...');
        
        const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
        console.log('🔍 Checkboxes selecionados encontrados:', selectedCheckboxes.length);
        
        if (selectedCheckboxes.length === 0) {
            alert('Selecione pelo menos uma campanha para remover.');
            return;
        }
        
        const campaignIds = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-campaign-id'));
        console.log('🔍 IDs das campanhas para remover:', campaignIds);
        
        if (confirm(`Tem certeza que deseja remover ${campaignIds.length} campanha(s) selecionada(s)?\n\nEsta ação não pode ser desfeita.`)) {
            console.log('✅ Usuário confirmou a remoção');
            this.deleteSelectedCampaigns(campaignIds);
        } else {
            console.log('❌ Usuário cancelou a remoção');
        }
    }

    deleteSelectedCampaigns(campaignIds) {
        console.log('🗑️ Removendo campanhas:', campaignIds);
        console.log('🔍 Campanhas antes da remoção:', this.campaigns.length);
        console.log('🔍 Campanhas filtradas antes da remoção:', this.filteredCampaigns.length);
        
        // Remover das campanhas em memória
        this.campaigns = this.campaigns.filter(campaign => !campaignIds.includes(campaign.campaignId || campaign.id));
        this.filteredCampaigns = this.filteredCampaigns.filter(campaign => !campaignIds.includes(campaign.campaignId || campaign.id));
        
        console.log('🔍 Campanhas após remoção da memória:', this.campaigns.length);
        console.log('🔍 Campanhas filtradas após remoção da memória:', this.filteredCampaigns.length);
        
        // Salvar campanhas atualizadas no MongoDB
        if (typeof CampaignTracker !== 'undefined' && CampaignTracker.saveCampaigns) {
            console.log('✅ Salvando via CampaignTracker no MongoDB');
            CampaignTracker.saveCampaigns(this.campaigns);
        } else {
            console.warn('⚠️ CampaignTracker não disponível - dados não salvos');
        }
        
        console.log('✅ Campanhas removidas do MongoDB via CampaignTracker');
        
        console.log('🔄 Atualizando interface...');
        
        // Atualizar a interface
        this.renderTable();
        this.updateStats();
        
        // Desmarcar checkbox "selecionar todos"
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            console.log('✅ Checkbox "selecionar todos" desmarcado');
        }
        
        console.log('✅ Processo de remoção concluído');
        alert(`${campaignIds.length} campanha(s) removida(s) com sucesso!`);
    }





    createClearDataModal() {
        const modal = document.createElement('div');
        modal.className = 'clear-data-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        modalContent.innerHTML = `
            <h3 style="margin-top: 0; color: #dc3545;"><i class="fas fa-exclamation-triangle"></i> Limpar Dados</h3>
            <p>Selecione quais dados você deseja limpar:</p>
            
            <div style="margin: 20px 0;">
                <label style="display: block; margin: 10px 0; cursor: pointer;">
                    <input type="checkbox" id="clear-campaigns" style="margin-right: 10px;">
                    <strong>Campanhas</strong> - Remove todas as campanhas salvas
                </label>
                
                <label style="display: block; margin: 10px 0; cursor: pointer;">
                    <input type="checkbox" id="clear-campaign-data" style="margin-right: 10px;">
                    <strong>Dados da Campanha Atual</strong> - Remove dados da campanha em andamento
                </label>
                
                <label style="display: block; margin: 10px 0; cursor: pointer;">
                    <input type="checkbox" id="clear-session-data" style="margin-right: 10px;">
                    <strong>Dados de Sessão</strong> - Remove dados temporários e de sessão
                </label>
                
                <label style="display: block; margin: 10px 0; cursor: pointer;">
                    <input type="checkbox" id="clear-all" style="margin-right: 10px;">
                    <strong>Todos os Dados</strong> - Remove completamente o localStorage
                </label>
            </div>
            
            <div style="text-align: right; margin-top: 30px;">
                <button id="cancel-clear" style="background: #6c757d; color: white; border: none; padding: 10px 20px; margin-right: 10px; border-radius: 5px; cursor: pointer;">
                    Cancelar
                </button>
                <button id="confirm-clear" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    <i class="fas fa-trash"></i> Limpar Selecionados
                </button>
            </div>
        `;

        modal.appendChild(modalContent);

        // Event listeners
        const cancelBtn = modalContent.querySelector('#cancel-clear');
        const confirmBtn = modalContent.querySelector('#confirm-clear');
        const clearAllCheckbox = modalContent.querySelector('#clear-all');
        const otherCheckboxes = modalContent.querySelectorAll('input[type="checkbox"]:not(#clear-all)');

        // Lógica do checkbox "Todos os Dados"
        clearAllCheckbox.addEventListener('change', () => {
            if (clearAllCheckbox.checked) {
                otherCheckboxes.forEach(cb => {
                    cb.checked = false;
                    cb.disabled = true;
                });
            } else {
                otherCheckboxes.forEach(cb => cb.disabled = false);
            }
        });

        // Desmarcar "Todos os Dados" se outro for selecionado
        otherCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    clearAllCheckbox.checked = false;
                }
            });
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        confirmBtn.addEventListener('click', async () => {
            await this.executeClearData(modalContent);
            document.body.removeChild(modal);
        });

        // Fechar modal clicando fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        return modal;
    }

    async executeClearData(modalContent) {
        const clearCampaigns = modalContent.querySelector('#clear-campaigns').checked;
        const clearCampaignData = modalContent.querySelector('#clear-campaign-data').checked;
        const clearSessionData = modalContent.querySelector('#clear-session-data').checked;
        const clearAll = modalContent.querySelector('#clear-all').checked;

        if (!clearCampaigns && !clearCampaignData && !clearSessionData && !clearAll) {
            alert('Selecione pelo menos uma opção para limpar.');
            return;
        }

        let itemsCleared = [];

        try {
            if (clearAll || clearCampaigns) {
                // Limpar todas as campanhas do MongoDB
                const response = await fetch('/api/campaigns', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    itemsCleared.push('Todas as campanhas do MongoDB');
                    console.log('✅ [MongoDB] Todas as campanhas foram removidas');
                } else {
                    console.error('❌ [MongoDB] Erro ao limpar campanhas:', await response.text());
                    throw new Error('Falha ao limpar campanhas do MongoDB');
                }
            }
            
            // Limpar dados de sessão do localStorage (não relacionados a campanhas)
            if (clearAll || clearSessionData) {
                localStorage.removeItem('lastPageLoad');
                localStorage.removeItem('sessionId');
                localStorage.removeItem('uploadedFiles');
                itemsCleared.push('Dados de sessão local');
            }

            alert(`Dados limpos com sucesso: ${itemsCleared.join(', ')}`);
            
            // Recarregar o dashboard
            await this.loadData();
            this.renderTable();
            this.updateStats();
        } catch (error) {
            console.error('❌ Erro ao limpar dados:', error);
            alert('Erro ao limpar dados: ' + error.message);
        }
    }
}

// Inicializar o dashboard quando a página carregar


// Inicialização do dashboard
function initDashboard() {
    console.log('🚀 Initializing dashboard...');
    console.log('📍 Current URL:', window.location.pathname);
    
    // Verificar se estamos na página correta
    if (!window.location.pathname.includes('dashboard')) {
        console.log('⚠️ Not on dashboard page, skipping initialization');
        return null;
    }
    
    // Aguardar um pouco para garantir que o DOM está pronto
    setTimeout(() => {
        // Verificar se a tabela existe
        const table = document.getElementById('campaigns-table');
        if (!table) {
            console.error('❌ Table #campaigns-table not found!');
            return;
        }
        
        console.log('✅ Table found, proceeding with dashboard initialization');
        
        // Dashboard agora usa exclusivamente MongoDB
        console.log('📊 Dashboard configurado para usar MongoDB exclusivamente');
        
        // Criar instância do dashboard se ainda não existe
        if (!window.dashboard) {
            try {
                console.log('Creating CampaignDashboard instance...');
                window.dashboard = new CampaignDashboard();
                // Não chamar init() aqui pois o construtor já chama
                console.log('✅ Dashboard instance created successfully');
            } catch (e) {
                console.error('❌ Error creating dashboard instance:', e);
            }
        } else {
            console.log('🔄 Dashboard already exists, refreshing...');
            window.dashboard.refresh();
        }
    }, 100);
    
    return true;
}

// Inicializar dashboard quando a página carregar
let dashboardInstance;

// Variável para controlar inicialização única
let dashboardInitialized = false;

// Função de inicialização única
function initializeDashboard() {
    if (dashboardInitialized || dashboardInstance) {
        console.log('⚠️ Dashboard already initialized, skipping...');
        return;
    }
    
    dashboardInitialized = true;
    console.log('🚀 Starting dashboard initialization...');
    
    // Primeiro, executar a função de inicialização
    const initResult = initDashboard();
    
    if (initResult !== null) {
        // Aguardar um pouco mais para garantir que tudo está pronto
        setTimeout(() => {
            if (!dashboardInstance && window.dashboard) {
                dashboardInstance = window.dashboard;
                console.log('✅ Dashboard instance assigned successfully');
            }
        }, 200);
    }
}

// Garantir inicialização única
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}

// Tornar as classes disponíveis globalmente
window.CampaignDashboard = CampaignDashboard;
