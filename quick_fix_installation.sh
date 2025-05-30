#!/bin/bash

# Script rápido para corrigir a instalação
echo "=== CORREÇÃO RÁPIDA DA INSTALAÇÃO ==="

# Sair do diretório atual e voltar para home
cd /home/servidorvoipnvs

# Parar PM2
pm2 stop aet-license-system 2>/dev/null
pm2 delete aet-license-system 2>/dev/null

# Recriar estrutura de diretórios
sudo mkdir -p /var/www/aetlicensesystem/LicencaTransporte
sudo chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/

# Ir para o diretório correto
cd /var/www/aetlicensesystem/LicencaTransporte

# Baixar o pacote do Replit (substitua pela URL correta)
echo "Agora copie todos os arquivos do Replit para este diretório"
echo "Diretório atual: $(pwd)"

# Criar arquivo .env básico
cat > .env << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem
SESSION_SECRET=your-super-secret-session-key-here-change-this-in-production
PORT=5000
EOF

echo "Estrutura criada em: /var/www/aetlicensesystem/LicencaTransporte"
echo "Próximos passos:"
echo "1. Copie todos os arquivos do Replit para este diretório"
echo "2. Execute: npm install"
echo "3. Execute: npm run db:push"
echo "4. Execute: pm2 start ecosystem.config.js"