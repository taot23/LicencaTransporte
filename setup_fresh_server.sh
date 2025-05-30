#!/bin/bash

# Script completo para instalação limpa do AET License System
echo "=== INSTALAÇÃO LIMPA DO AET LICENSE SYSTEM ==="

# Configurações
DB_NAME="aetlicensesystem"
DB_USER="aetuser"
DB_PASS="nvs123"
APP_DIR="/var/www/aetlicensesystem/LicencaTransporte"

echo "1. Parando processos PM2..."
pm2 stop aet-license-system 2>/dev/null
pm2 delete aet-license-system 2>/dev/null

echo "2. Removendo banco de dados existente..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;"

echo "3. Criando novo banco de dados..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"

echo "4. Limpando diretório da aplicação..."
sudo rm -rf $APP_DIR
sudo mkdir -p $APP_DIR

echo "5. Configurando permissões..."
sudo chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/
sudo chmod -R 755 /var/www/aetlicensesystem/

echo "6. Criando arquivo .env..."
cat > $APP_DIR/.env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
SESSION_SECRET=your-super-secret-session-key-here-change-this-in-production
PORT=5000
EOF

echo "7. Instalação concluída!"
echo ""
echo "PRÓXIMOS PASSOS:"
echo "1. Copie todos os arquivos do Replit para: $APP_DIR"
echo "2. Execute: cd $APP_DIR && npm install"
echo "3. Execute: npm run db:push"
echo "4. Execute: pm2 start ecosystem.config.js"
echo "5. Verifique: pm2 status && pm2 logs aet-license-system"
echo ""
echo "Banco criado: $DB_NAME"
echo "Usuário: $DB_USER"
echo "Senha: $DB_PASS"