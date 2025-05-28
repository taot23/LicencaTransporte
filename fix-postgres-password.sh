#!/bin/bash

echo "🔧 Corrigindo senha do PostgreSQL..."

cd /var/www/aetlicensesystem/LicencaTransporte

# Alterar senha do usuário existente
sudo -u postgres psql << 'EOSQL'
ALTER USER aetuser WITH PASSWORD 'AET@License2025!';
GRANT ALL PRIVILEGES ON DATABASE aetlicensesystem TO aetuser;
ALTER USER aetuser SUPERUSER;
\c aetlicensesystem;
GRANT ALL ON SCHEMA public TO aetuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aetuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aetuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO aetuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO aetuser;
EOSQL

echo "✅ Senha alterada!"

# Reconfigurar pg_hba.conf para aceitar conexões md5
sudo sed -i 's/local   all             all                                     peer/local   all             all                                     md5/g' /etc/postgresql/*/main/pg_hba.conf
sudo sed -i 's/local   all             all                                     ident/local   all             all                                     md5/g' /etc/postgresql/*/main/pg_hba.conf

# Reiniciar PostgreSQL
sudo systemctl restart postgresql

echo "🔍 Testando conexão novamente..."
sleep 3
PGPASSWORD='AET@License2025!' psql -h localhost -U aetuser -d aetlicensesystem -c "SELECT version();" && echo "✅ Conexão OK!" || echo "❌ Ainda com erro"

echo "🚀 Tentando migrações novamente..."
npm run db:push