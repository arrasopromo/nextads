// API Configuration for Social Media Integrations
class APIConfig {
    constructor() {
        // Facebook App Configuration
        this.facebook = {
            appId: API_KEYS.facebook.appId, // Carregado do arquivo api-keys.js
            appSecret: API_KEYS.facebook.appSecret,
            version: 'v20.0',
            permissions: [
                'pages_manage_posts',
                'pages_read_engagement', 
                'pages_show_list',
                'pages_manage_metadata',
                'pages_read_user_content',
                'instagram_basic',
                'instagram_content_publish',
                'public_profile',
                'email'
            ],
            endpoints: {
                me: '/me',
                pages: '/me/accounts',
                pageInsights: '/{page-id}/insights',
                pagePosts: '/{page-id}/posts',
                pageInfo: '/{page-id}',
                instagramAccounts: '/{page-id}?fields=instagram_business_account',
                instagramMedia: '/{instagram-account-id}/media',
                instagramInsights: '/{instagram-account-id}/insights'
            }
        };

        // Instagram Basic Display API Configuration
        this.instagram = {
            appId: API_KEYS.instagram.appId, // Carregado do arquivo api-keys.js
            appSecret: API_KEYS.instagram.appSecret,
            redirectUri: window.location.origin + '/integracoes.html',
            permissions: [
                'user_profile',
                'user_media'
            ],
            endpoints: {
                authorize: 'https://api.instagram.com/oauth/authorize',
                token: 'https://api.instagram.com/oauth/access_token',
                me: 'https://graph.instagram.com/me',
                media: 'https://graph.instagram.com/me/media',
                insights: 'https://graph.instagram.com/{media-id}/insights'
            }
        };

        // API Base URLs
        this.baseUrls = {
            facebook: 'https://graph.facebook.com',
            instagram: 'https://graph.instagram.com'
        };
    }

    // Get Facebook login URL
    getFacebookLoginUrl() {
        // Detectar ambiente de desenvolvimento
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const redirectUri = isDevelopment 
            ? `http://localhost:4000/auth/facebook/callback`
            : `https://nextads.pro/auth/facebook/callback`;
            
        const params = new URLSearchParams({
            client_id: this.facebook.appId,
            redirect_uri: redirectUri,
            scope: this.facebook.permissions.join(','),
            response_type: 'code'
        });
        
        return `https://www.facebook.com/v${this.facebook.version}/dialog/oauth?${params.toString()}`;
    }

    // Get OAuth server URL based on environment
    getOAuthServerUrl() {
        // Detectar ambiente de desenvolvimento
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isDevelopment) {
            return 'http://localhost:4000/login/facebook';
        } else {
            return 'https://nextads.pro/login/facebook';
        }
    }

    // Get Instagram authorization URL
    getInstagramAuthUrl() {
        const params = new URLSearchParams({
            client_id: this.instagram.appId,
            redirect_uri: this.instagram.redirectUri,
            scope: this.instagram.permissions.join(','),
            response_type: 'code'
        });
        
        return `${this.instagram.endpoints.authorize}?${params.toString()}`;
    }

    // Make API request to Facebook
    async makeFacebookRequest(endpoint, accessToken, params = {}, method = 'GET') {
        const url = new URL(`${this.baseUrls.facebook}${endpoint}`);
        
        const requestOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (method === 'GET') {
            url.searchParams.append('access_token', accessToken);
            Object.keys(params).forEach(key => {
                url.searchParams.append(key, params[key]);
            });
        } else {
            // For POST requests, send data in body
            requestOptions.body = JSON.stringify({
                access_token: accessToken,
                ...params
            });
        }

        try {
            const response = await fetch(url, requestOptions);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            return data;
        } catch (error) {
            console.error('Facebook API Error:', error);
            throw error;
        }
    }

    // Make API request to Instagram
    async makeInstagramRequest(endpoint, accessToken, params = {}) {
        const url = new URL(`${this.baseUrls.instagram}${endpoint}`);
        url.searchParams.append('access_token', accessToken);
        
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            return data;
        } catch (error) {
            console.error('Instagram API Error:', error);
            throw error;
        }
    }

    // Exchange Instagram code for access token
    async exchangeInstagramCode(code) {
        const formData = new FormData();
        formData.append('client_id', this.instagram.appId);
        formData.append('client_secret', 'YOUR_INSTAGRAM_APP_SECRET'); // Substitua pelo seu secret
        formData.append('grant_type', 'authorization_code');
        formData.append('redirect_uri', this.instagram.redirectUri);
        formData.append('code', code);

        try {
            const response = await fetch(this.instagram.endpoints.token, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error_description);
            }
            
            return data;
        } catch (error) {
            console.error('Instagram Token Exchange Error:', error);
            throw error;
        }
    }

    // Get long-lived Instagram access token
    async getLongLivedInstagramToken(shortLivedToken) {
        const params = {
            grant_type: 'ig_exchange_token',
            client_secret: 'YOUR_INSTAGRAM_APP_SECRET', // Substitua pelo seu secret
            access_token: shortLivedToken
        };

        try {
            const response = await this.makeInstagramRequest('/access_token', '', params);
            return response;
        } catch (error) {
            console.error('Long-lived token error:', error);
            throw error;
        }
    }

    // Validate access token
    async validateToken(platform, accessToken) {
        try {
            if (platform === 'facebook') {
                const response = await this.makeFacebookRequest('/me', accessToken, {
                    fields: 'id,name'
                });
                return response.id ? true : false;
            } else if (platform === 'instagram') {
                const response = await this.makeInstagramRequest('/me', accessToken, {
                    fields: 'id,username'
                });
                return response.id ? true : false;
            }
        } catch (error) {
            return false;
        }
    }

    // Get user profile data
    async getUserProfile(platform, accessToken) {
        try {
            if (platform === 'facebook') {
                return await this.makeFacebookRequest('/me', accessToken, {
                    fields: 'id,name,email,picture.width(200).height(200)'
                });
            } else if (platform === 'instagram') {
                return await this.makeInstagramRequest('/me', accessToken, {
                    fields: 'id,username,account_type,media_count'
                });
            }
        } catch (error) {
            console.error(`Error getting ${platform} profile:`, error);
            throw error;
        }
    }

    // Get user pages (Facebook only)
    async getUserPages(accessToken) {
        try {
            return await this.makeFacebookRequest('/me/accounts', accessToken, {
                fields: 'id,name,access_token,category,picture'
            });
        } catch (error) {
            console.error('Error getting Facebook pages:', error);
            throw error;
        }
    }

    // Get media insights
    async getMediaInsights(platform, mediaId, accessToken, metrics = []) {
        try {
            if (platform === 'facebook') {
                const metricsParam = metrics.length > 0 ? metrics.join(',') : 'post_impressions,post_engaged_users';
                return await this.makeFacebookRequest(`/${mediaId}/insights`, accessToken, {
                    metric: metricsParam
                });
            } else if (platform === 'instagram') {
                const metricsParam = metrics.length > 0 ? metrics.join(',') : 'impressions,reach,engagement';
                return await this.makeInstagramRequest(`/${mediaId}/insights`, accessToken, {
                    metric: metricsParam
                });
            }
        } catch (error) {
            console.error(`Error getting ${platform} insights:`, error);
            throw error;
        }
    }

    // Post to Facebook page
    async postToFacebookPage(pageId, pageAccessToken, message, imageUrl = null) {
        const endpoint = `/${pageId}/posts`;
        const params = { message };
        
        if (imageUrl) {
            params.url = imageUrl;
        }

        try {
            const response = await fetch(`${this.baseUrls.facebook}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...params,
                    access_token: pageAccessToken
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            return data;
        } catch (error) {
            console.error('Facebook post error:', error);
            throw error;
        }
    }

    // Get Instagram Business accounts connected to Facebook pages
    async getInstagramBusinessAccounts(pageAccessToken) {
        try {
            const pages = await this.makeFacebookRequest('/me/accounts', pageAccessToken, {
                fields: 'id,name,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}'
            });
            
            return pages.data.filter(page => page.instagram_business_account);
        } catch (error) {
            console.error('Error getting Instagram Business accounts:', error);
            throw error;
        }
    }

    // Get Instagram Business account insights
    async getInstagramBusinessInsights(instagramAccountId, accessToken, metrics = [], period = 'day') {
        try {
            const metricsParam = metrics.length > 0 ? metrics.join(',') : 'impressions,reach,profile_views';
            return await this.makeFacebookRequest(`/${instagramAccountId}/insights`, accessToken, {
                metric: metricsParam,
                period: period
            });
        } catch (error) {
            console.error('Error getting Instagram Business insights:', error);
            throw error;
        }
    }

    // Post to Instagram Business account
    async postToInstagramBusiness(instagramAccountId, accessToken, imageUrl, caption = '') {
        try {
            // First, create media object
            const mediaResponse = await this.makeFacebookRequest(`/${instagramAccountId}/media`, accessToken, {
                image_url: imageUrl,
                caption: caption
            }, 'POST');

            // Then publish the media
            const publishResponse = await this.makeFacebookRequest(`/${instagramAccountId}/media_publish`, accessToken, {
                creation_id: mediaResponse.id
            }, 'POST');

            return publishResponse;
        } catch (error) {
            console.error('Error posting to Instagram Business:', error);
            throw error;
        }
    }

    // Get rate limit info
    getRateLimitInfo(platform) {
        if (platform === 'facebook') {
            return {
                callsPerHour: 200,
                callsPerDay: 4800,
                resetTime: '1 hour'
            };
        } else if (platform === 'instagram') {
            return {
                callsPerHour: 200,
                callsPerDay: 4800,
                resetTime: '1 hour'
            };
        }
    }

    // ===== MÉTODOS SEGUROS PARA META/FACEBOOK =====

    // Trocar código por token usando endpoint seguro
    async exchangeFacebookCode(code, redirectUri = 'https://localhost') {
        try {
            const response = await fetch('/api/meta/exchange-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code, redirectUri })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.details || 'Erro ao trocar código por token');
            }

            return result;
        } catch (error) {
            console.error('Erro ao trocar código por token:', error);
            throw error;
        }
    }

    // Verificar permissões usando endpoint seguro
    async verifyFacebookPermissions(accessToken) {
        try {
            const response = await fetch('/api/meta/verify-permissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accessToken })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.details || 'Erro ao verificar permissões');
            }

            return result;
        } catch (error) {
            console.error('Erro ao verificar permissões:', error);
            throw error;
        }
    }

    // Obter Ad Accounts usando endpoint seguro
    async getFacebookAdAccounts(accessToken) {
        try {
            const response = await fetch('/api/meta/ad-accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accessToken })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.details || 'Erro ao obter Ad Accounts');
            }

            return result.adAccounts;
        } catch (error) {
            console.error('Erro ao obter Ad Accounts:', error);
            throw error;
        }
    }

    // Criar campanha usando endpoint seguro
    async createFacebookCampaign(campaignData, adAccountId) {
        try {
            const response = await fetch('/api/meta/create-campaign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ campaignData, adAccountId })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.details || 'Erro ao criar campanha');
            }

            return result.campaign;
        } catch (error) {
            console.error('Erro ao criar campanha:', error);
            throw error;
        }
    }

    // Função para listar campanhas de uma conta de anúncios
    async getFacebookCampaigns(adAccountId, accessToken) {
        try {
            const response = await fetch('/api/meta/campaigns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ adAccountId, accessToken })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Erro ao listar campanhas');
            }
            
            return result.campaigns;
        } catch (error) {
            console.error('Erro ao listar campanhas:', error);
            throw error;
        }
    }

    // Função para obter detalhes de uma campanha específica
    async getFacebookCampaignDetails(campaignId, accessToken) {
        try {
            const response = await fetch(`/api/meta/campaign/${campaignId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accessToken })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Erro ao obter detalhes da campanha');
            }
            
            return result.campaign;
        } catch (error) {
            console.error('Erro ao obter detalhes da campanha:', error);
            throw error;
        }
    }

    // Função para atualizar uma campanha
    async updateFacebookCampaign(campaignId, accessToken, updates) {
        try {
            const response = await fetch(`/api/meta/campaign/${campaignId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accessToken, updates })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Erro ao atualizar campanha');
            }
            
            return result.result;
        } catch (error) {
            console.error('Erro ao atualizar campanha:', error);
            throw error;
        }
    }

    // Função para alterar status de uma campanha (pausar/ativar)
    async updateFacebookCampaignStatus(campaignId, accessToken, status) {
        try {
            const response = await fetch(`/api/meta/campaign/${campaignId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accessToken, status })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Erro ao alterar status da campanha');
            }
            
            return result.result;
        } catch (error) {
            console.error('Erro ao alterar status da campanha:', error);
            throw error;
        }
    }

    // Função para obter insights de campanhas
    async getFacebookCampaignInsights(adAccountId, accessToken, options = {}) {
        try {
            const requestData = {
                adAccountId,
                accessToken,
                ...options
            };

            const response = await fetch('/api/meta/campaigns/insights', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Erro ao obter insights');
            }
            
            return result.insights;
        } catch (error) {
            console.error('Erro ao obter insights:', error);
            throw error;
        }
    }
}

// Export for use in other files
window.APIConfig = APIConfig;