# Documentação Técnica - Next Ads

## Visão Gera

O **Next Ads** é uma plataforma web para criação automática de campanhas publicitárias integrada ao Meta Ads. O sistema permite aos usuários criar campanhas direcionadas para Instagram, WhatsApp ou sites, com upload de arquivos multimídia, validação de perfis e integração com sistemas de pagamento.

## Arquitetura do Sistema

### Stack Tecnológico
- **Backend**: Node.js + Express.js
- **Banco de Dados**: MongoDB
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Processamento de Imagens**: HEIC-Convert, Multer
- **Integrações**: Evolution API (WhatsApp), OpenAI API, Woovi/OpenPix (Pagamentos)
- **Protocolo MCP**: Model Context Protocol para extensibilidade

### Estrutura de Arquivos

```
turbo-impulsione2/
├── server.js                 # Servidor principal completo
├── server-simple.js          # Servidor simplificado
├── mcp-client.js            # Cliente MCP global
├── mcp-mongodb.js           # Integração MCP com MongoDB
├── package.json             # Dependências do projeto
├── municipios.json          # Base de dados de municípios brasileiros
├── data/
│   └── campaigns.json       # Armazenamento local de campanhas
├── heic2jpg/               # Sistema de conversão HEIC
│   ├── heic2jpg.js         # Script de conversão
│   ├── heic/               # Diretório de entrada
│   └── jpg/                # Diretório de saída
├── uploads/                # Arquivos enviados pelos usuários
│   ├── files-*             # Arquivos de mídia
│   └── profile-pics/       # Fotos de perfil do WhatsApp
└── public/                 # Frontend da aplicação
    ├── index.html          # Página principal
    ├── campaign-config.html # Segunda tela - configuração de campanha
    ├── dashboard.html      # Dashboard de campanhas
    ├── script.js           # Lógica principal do frontend
    ├── campaign-tracker.js # Sistema de tracking
    ├── dashboard.js        # Lógica do dashboard
    ├── styles.css          # Estilos principais
    ├── dashboard.css       # Estilos do dashboard
    └── js/
        ├── data-manager.js # Gerenciamento de dados
        └── mcp-client.js   # Cliente MCP do frontend
```

## Componentes Principais

### 1. Servidor Principal (server.js)

#### Funcionalidades Core
- **Configuração Express**: Middleware de segurança (Helmet, CORS), compressão e parsing JSON
- **Conexão MongoDB**: Sistema robusto com múltiplas URIs de fallback e reconexão automática
- **Sistema de Proxies**: Rotação de proxies HTTP para requisições externas
- **Integração MCP**: Suporte ao Model Context Protocol para extensibilidade

#### APIs e Rotas

**Upload e Processamento de Arquivos**
- `POST /api/upload`: Upload com conversão automática HEIC→JPG
- `GET /api/proxy-image`: Proxy para imagens do WhatsApp
- Suporte a múltiplos formatos: imagens (JPG, PNG, HEIC, WEBP) e vídeos (MP4, MOV, AVI)
- Limite de 500MB por arquivo

**Validação de Perfis**
- `POST /api/validate-instagram`: Validação de perfis Instagram
- `POST /api/validate-whatsapp`: Validação e download de foto de perfil WhatsApp
- Integração com Evolution API para WhatsApp

**Inteligência Artificial**
- `POST /api/buscar-mercado`: Análise de nicho com OpenAI
- Validação de conteúdo inadequado
- Extração de nicho principal

**Sistema de Pagamentos**
- `POST /api/create-pix-charge`: Criação de cobranças PIX via Woovi/OpenPix
- Suporte a ambiente sandbox e produção
- Geração de correlationID único

**Gerenciamento de Dados**
- `GET /api/campaigns`: Listagem de campanhas
- `POST /api/campaigns`: Criação de campanhas
- `POST /api/sync`: Sincronização com MongoDB
- `GET /api/health`: Status do sistema
- `POST /api/mcp`: Endpoint para chamadas MCP

### 2. Servidor Simples (server-simple.js)

Versão minimalista focada apenas em:
- Servir arquivos estáticos
- API básica de campanhas
- Conexão MongoDB simplificada
- Ideal para desenvolvimento e testes

### 3. Frontend Principal (script.js)

#### Classe CampaignCreator
**Funcionalidades**:
- Gerenciamento de estado da campanha
- Upload e processamento de arquivos
- Validação de formulários
- Integração com APIs do backend
- Sistema de tracking de progresso

**Fluxo de Criação de Campanha**:
1. **Objetivo**: Vendas, Engajamento ou Cadastros
2. **Direcionamento**: Rede Social (Instagram/WhatsApp) ou Site
3. **Upload de Criativo**: Imagens/vídeos com otimização automática
4. **Validação de Perfil**: Verificação automática de perfis
5. **Segmentação**: Localização, gênero, idade
6. **Análise de Mercado**: IA para sugestão de mercados
7. **Confirmação**: Revisão e finalização

**Otimizações de Mídia**:
- Redimensionamento automático para proporção 9:16
- Conversão HEIC para JPG no servidor
- Compressão de imagens (90% qualidade JPEG)
- Preview responsivo para mobile e desktop

### 4. Sistema de Tracking (campaign-tracker.js)

#### Classe CampaignTracker
**Recursos**:
- Tracking em tempo real do progresso
- Persistência exclusiva em MongoDB
- Sistema de sessões e detecção de abandono
- Debounce para otimização de salvamento
- Compatibilidade mobile/desktop

**Métricas Coletadas**:
- Tempo de início e conclusão
- Etapas completadas
- Arquivos enviados
- Dados de segmentação
- Status da campanha (ativa, concluída, abandonada)

### 5. Dashboard (dashboard.js)

#### Funcionalidades
- Visualização de todas as campanhas
- Filtros por data, status e ID
- Estatísticas em tempo real
- Exportação para Excel/CSV
- Gerenciamento de campanhas (exclusão em lote)

#### Métricas Exibidas
- Total de campanhas
- Campanhas concluídas
- Campanhas abandonadas
- Taxa de conclusão

### 6. Sistema de Dados (data-manager.js)

#### Classe DataManager
**Estratégia Híbrida**:
- **Primário**: MongoDB via API REST
- **Fallback**: localStorage para offline
- Detecção automática de disponibilidade
- Sincronização transparente

**Operações CRUD**:
- `getAllCampaigns()`: Listagem completa
- `saveCampaign()`: Criação/atualização
- `updateCampaign()`: Atualização parcial
- `deleteCampaign()`: Remoção

### 7. Cliente MCP (mcp-client.js)

#### Integração com Model Context Protocol
- Comunicação com servidores MCP externos
- Endpoint `/api/mcp` para chamadas do frontend
- Extensibilidade para futuras integrações
- Tratamento de erros robusto

### 8. Sistema de Conversão HEIC (heic2jpg/)

#### Funcionalidades
- Conversão automática HEIC → JPG
- Modo watch para processamento contínuo
- Preservação de qualidade
- Integração com sistema de upload

## Integrações Externas

### Evolution API (WhatsApp)
- **Endpoint**: Configurável via variáveis de ambiente
- **Funcionalidades**: Validação de números, download de fotos de perfil
- **Autenticação**: API Key
- **Rate Limiting**: Implementado

### OpenAI API
- **Modelo**: GPT para análise de nicho
- **Funcionalidades**: Extração de nicho, validação de conteúdo
- **Timeout**: 30 segundos
- **Fallback**: Tratamento de erros gracioso

### Woovi/OpenPix (Pagamentos)
- **Ambientes**: Sandbox e Produção
- **Método**: PIX
- **Recursos**: Geração de QR Code, webhook de confirmação
- **Segurança**: Correlação de IDs únicos

## Banco de Dados

### MongoDB
**Coleções**:
- `campaigns`: Dados das campanhas criadas
- Índices otimizados para consultas por ID e data
- Conexão com retry automático
- Múltiplas URIs de fallback

**Estrutura de Campanha**:
```javascript
{
  campaignId: String,
  startTime: Date,
  objective: String,
  direction: String,
  profile: String,
  profileData: Object,
  location: String,
  gender: String,
  age: String,
  duration: String,
  markets: Array,
  files: Array,
  uploadedFiles: Array,
  progressSteps: Object,
  currentProgress: Number,
  isCompleted: Boolean,
  isAbandoned: Boolean,
  completedSteps: Array,
  lastSaved: Date
}
```

## Interface do Usuário

### Design System
- **Cores**: Gradiente azul-roxo (#667eea → #764ba2)
- **Tipografia**: Segoe UI, sans-serif
- **Componentes**: Cards, botões, formulários responsivos
- **Ícones**: Font Awesome 6.0

### Responsividade
- **Mobile First**: Otimizado para dispositivos móveis
- **Breakpoints**: 768px para tablet/desktop
- **Touch**: Gestos otimizados para mobile
- **Performance**: Lazy loading e otimizações

### Páginas
1. **index.html**: Criação de campanhas (página principal)
2. **campaign-config.html**: Segunda tela com resumo da campanha configurada e seleção de duração
3. **dashboard.html**: Visualização e gerenciamento
4. **sobre.html**: Informações da plataforma
5. **payment-mobile.html**: Checkout mobile otimizado

## Segurança

### Medidas Implementadas
- **Helmet.js**: Headers de segurança
- **CORS**: Configuração restritiva
- **CSP**: Content Security Policy
- **Validação**: Sanitização de inputs
- **Rate Limiting**: Proteção contra spam
- **File Upload**: Validação de tipos e tamanhos

### Variáveis de Ambiente
```
MONGODB_URI=mongodb://...
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
OPENAI_API_KEY=...
WOOVI_APP_ID=...
WOOVI_API_KEY=...
PORT=5000
```

## Performance

### Otimizações
- **Compressão**: Gzip para todas as respostas
- **Caching**: Headers apropriados para assets
- **Debouncing**: Salvamento otimizado
- **Lazy Loading**: Carregamento sob demanda
- **Image Optimization**: Redimensionamento automático

### Monitoramento
- Logs estruturados
- Health checks
- Métricas de performance
- Error tracking

## Deployment

### Requisitos
- Node.js 16+
- MongoDB 4.4+
- Espaço em disco para uploads
- Conexão com APIs externas

### Comandos
```bash
# Instalação
npm install

# Desenvolvimento
node server.js          # Servidor completo
node server-simple.js   # Servidor simples

# Conversão HEIC
cd heic2jpg
node heic2jpg.js --watch
```

### Portas
- **Servidor Principal**: 5000
- **Servidor Simples**: 8080
- **MongoDB**: 27017 (padrão)

## Manutenção

### Logs
- Logs estruturados com timestamps
- Níveis: INFO, WARN, ERROR
- Rotação automática recomendada

### Backup
- MongoDB: Backup regular das coleções
- Uploads: Sincronização de arquivos
- Configurações: Versionamento de .env

### Atualizações
- Dependências: Verificação regular de vulnerabilidades
- APIs: Monitoramento de mudanças nas integrações
- Performance: Análise contínua de métricas

## Conclusão

O Next Ads é uma plataforma robusta e escalável para criação automática de campanhas publicitárias integrada ao Meta Ads, com arquitetura moderna, integrações sólidas e foco na experiência do usuário. O sistema está preparado para crescimento e novas funcionalidades através do protocolo MCP e arquitetura modular.

---

**Última atualização**: Janeiro 2025  
**Versão da documentação**: 1.0  
**Autor**: Análise técnica automatizada