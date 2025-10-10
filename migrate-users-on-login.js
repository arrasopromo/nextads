// Exemplo de modificação para o login com migração automática
// Este código deve ser integrado na rota de login existente

async function loginWithAutoMigration(email, password, usersCollection) {
    try {
        // Buscar usuário
        const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });
        
        if (!user) {
            return { success: false, error: 'Email ou senha incorretos' };
        }
        
        // Verificar se a senha está em texto plano (não começa com $2)
        const isPlainTextPassword = !user.password.startsWith('$2');
        
        let isPasswordValid = false;
        
        if (isPlainTextPassword) {
            // Senha em texto plano - comparar diretamente
            isPasswordValid = (password === user.password);
            
            if (isPasswordValid) {
                // Migrar a senha para hash
                console.log(`🔄 Migrando senha do usuário: ${user.email}`);
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                
                // Atualizar no banco de dados
                await usersCollection.updateOne(
                    { _id: user._id },
                    { $set: { password: hashedPassword } }
                );
                
                console.log(`✅ Senha migrada com sucesso para: ${user.email}`);
            }
        } else {
            // Senha já está hasheada - usar bcrypt.compare
            isPasswordValid = await bcrypt.compare(password, user.password);
        }
        
        if (!isPasswordValid) {
            return { success: false, error: 'Email ou senha incorretos' };
        }
        
        // Login bem-sucedido
        return { success: true, user: user };
        
    } catch (error) {
        console.error('❌ Erro no login com migração:', error);
        return { success: false, error: 'Erro interno do servidor' };
    }
}

module.exports = { loginWithAutoMigration };