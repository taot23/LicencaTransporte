#!/bin/bash

# Script para corrigir configuração do banco de dados no servidor
echo "🔧 Corrigindo configuração do banco de dados..."

# Ir para o diretório do projeto
cd /var/www/aetlicensesystem/LicencaTransporte

# Parar a aplicação se estiver rodando
pm2 stop aet-license-system 2>/dev/null || true

# Criar arquivo .env correto
echo "📝 Criando arquivo .env correto..."
cat > .env << 'EOF'
DATABASE_URL=postgresql://aetuser:AET@License2025!@localhost:5432/aetlicensesystem
SESSION_SECRET=chave_secreta_super_longa_e_unica_para_producao_2025
NODE_ENV=production
PORT=5000
PGHOST=localhost
PGPORT=5432
PGUSER=aetuser
PGPASSWORD=AET@License2025!
PGDATABASE=aetlicensesystem
EOF

# Recriar o banco e usuário com as credenciais corretas
echo "🗄️ Reconfigurando PostgreSQL..."
sudo -u postgres psql << 'EOSQL'
-- Dropar banco e usuário se existirem
DROP DATABASE IF EXISTS aetlicensesystem;
DROP USER IF EXISTS aetuser;

-- Recriar com as credenciais corretas
CREATE DATABASE aetlicensesystem;
CREATE USER aetuser WITH PASSWORD 'AET@License2025!';
GRANT ALL PRIVILEGES ON DATABASE aetlicensesystem TO aetuser;
ALTER USER aetuser CREATEDB;
ALTER USER aetuser SUPERUSER;

-- Conectar ao banco e dar permissões
\c aetlicensesystem;
GRANT ALL ON SCHEMA public TO aetuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aetuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aetuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO aetuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO aetuser;
EOSQL

echo "✅ Banco configurado com sucesso!"

# Testar conexão
echo "🔍 Testando conexão..."
PGPASSWORD=AET@License2025! psql -h localhost -U aetuser -d aetlicensesystem -c "SELECT version();" && echo "✅ Conexão OK!" || echo "❌ Erro na conexão"

# Executar migrações
echo "🚀 Executando migrações..."
npm run db:push

# Definir permissões corretas
chown -R www-data:www-data /var/www/aetlicensesystem
chmod -R 755 /var/www/aetlicensesystem

echo "✅ Configuração concluída!"
echo "Execute agora: pm2 start ecosystem.config.js"