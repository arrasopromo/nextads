// MCP Client for Server-side Node.js
// This file provides server-side MCP integration
const { MongoClient } = require('mongodb');

class MCPServerClient {
    constructor() {
        this.isConnected = false;
        this.mongoClient = null;
        this.db = null;
    }

    async connectMongoDB() {
        if (this.isConnected) return;
        
        try {
            const mongoUri = process.env.MONGODB_URI || 'mongodb://mongo:Rr12415721@69.62.99.94:27017/?tls=false&authSource=admin';
            console.log('🔧 Conectando ao MongoDB via MCP client...');
            
            this.mongoClient = new MongoClient(mongoUri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
                socketTimeoutMS: 5000
            });
            
            await this.mongoClient.connect();
            this.db = this.mongoClient.db('turbo_impulsione');
            this.isConnected = true;
            console.log('✅ MCP MongoDB conectado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao conectar MongoDB via MCP:', error.message);
            this.isConnected = false;
        }
    }

    async runMCP(serverName, toolName, args) {
        try {
            console.log(`🔧 MCP Call: ${serverName}.${toolName}`, args);
            
            // Ensure MongoDB connection
            await this.connectMongoDB();
            
            if (!this.isConnected) {
                throw new Error('MongoDB não conectado via MCP');
            }
            
            // Handle MongoDB operations
            if (serverName.includes('MongoDB')) {
                return await this.handleMongoDBOperation(toolName, args);
            }
            
            throw new Error(`Servidor MCP não suportado: ${serverName}`);
            
        } catch (error) {
            console.error(`❌ MCP Error:`, error.message);
            throw error;
        }
    }
    
    async handleMongoDBOperation(toolName, args) {
        const collection = this.db.collection('campaigns');
        
        switch (toolName) {
            case 'query':
                const results = await collection.find(args.filter || {}).toArray();
                return { data: results };
                
            case 'insert':
                // Use replaceOne with upsert to avoid duplicate key errors
                const insertResult = await collection.replaceOne(
                    { id: args.document.id },
                    args.document,
                    { upsert: true }
                );
                return { 
                    insertedId: insertResult.upsertedId || args.document.id,
                    upserted: insertResult.upsertedCount > 0,
                    modified: insertResult.modifiedCount > 0
                };
                
            case 'update':
                const updateResult = await collection.updateOne(args.filter, args.update);
                return { modifiedCount: updateResult.modifiedCount };
                
            case 'delete':
                const deleteResult = await collection.deleteOne(args.filter);
                return { deletedCount: deleteResult.deletedCount };
                
            default:
                throw new Error(`Operação MongoDB não suportada: ${toolName}`);
        }
    }
}

// Create and export instance
const mcpServerClient = new MCPServerClient();

module.exports = {
    runMCP: (serverName, toolName, args) => mcpServerClient.runMCP(serverName, toolName, args)
};