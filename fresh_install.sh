#!/bin/bash

# Script para reinstalação completa do AET License System
echo "=== REINSTALAÇÃO COMPLETA DO AET LICENSE SYSTEM ==="
echo "ATENÇÃO: Este script vai APAGAR TODOS OS DADOS!"
echo "Pressione Ctrl+C para cancelar ou Enter para continuar..."
read -p ""

# Parar a aplicação PM2
echo "1. Parando aplicação PM2..."
pm2 stop aet-license-system 2>/dev/null || echo "Aplicação não estava rodando"
pm2 delete aet-license-system 2>/dev/null || echo "Processo PM2 não encontrado"

# Fazer backup completo antes de apagar (opcional)
echo "2. Criando backup completo antes da limpeza..."
BACKUP_DIR="/tmp/aet_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r /var/www/aetlicensesystem/LicencaTransporte $BACKUP_DIR/ 2>/dev/null || echo "Diretório não encontrado"

# Apagar banco de dados
echo "3. Recriando banco de dados..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS aetlicensesystem;"
sudo -u postgres psql -c "DROP USER IF EXISTS aetuser;"
sudo -u postgres psql -c "CREATE USER aetuser WITH PASSWORD 'nvs123';"
sudo -u postgres psql -c "CREATE DATABASE aetlicensesystem OWNER aetuser;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE aetlicensesystem TO aetuser;"

# Limpar diretório da aplicação
echo "4. Limpando diretório da aplicação..."
cd /var/www/aetlicensesystem/
rm -rf LicencaTransporte

# Clonar repositório atualizado do GitHub (substitua pela URL correta)
echo "5. Clonando aplicação atualizada..."
# git clone https://github.com/seu-usuario/aet-license-system.git LicencaTransporte
# Ou copie os arquivos do Replit para o servidor

echo "6. Configurando novo diretório..."
mkdir -p LicencaTransporte
cd LicencaTransporte

# Configurar permissões
echo "7. Configurando permissões..."
chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/LicencaTransporte
chmod -R 755 /var/www/aetlicensesystem/LicencaTransporte

echo "=== INSTALAÇÃO LIMPA CONCLUÍDA ==="
echo "Agora você deve:"
echo "1. Copiar todos os arquivos do Replit para /var/www/aetlicensesystem/LicencaTransporte"
echo "2. Configurar o arquivo .env com DATABASE_URL=postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem"
echo "3. Executar: cd /var/www/aetlicensesystem/LicencaTransporte && npm install"
echo "4. Executar: npm run db:push"
echo "5. Iniciar com: pm2 start ecosystem.config.js"