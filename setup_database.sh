ls#!/bin/bash

# Script para configurar o banco de dados no servidor Google
# Execute este script como: bash setup_database.sh

echo "=== Configurando banco de dados AET ==="

# 1. Parar a aplicação
echo "Parando aplicação..."
pm2 stop aet-license-system

# 2. Criar arquivo .env
echo "Criando arquivo .env..."
cd /var/www/aetlicensesystem/LicencaTransporte
echo 'DATABASE_URL="postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem"' > .env

# 3. Executar script SQL para recriar tabelas
echo "Recriando estrutura do banco..."
psql -h localhost -U aetuser -d aetlicensesystem -f recreate_database_schema.sql

# 4. Verificar se as tabelas foram criadas
echo "Verificando tabelas criadas..."
psql -h localhost -U aetuser -d aetlicensesystem -c "\dt"

# 5. Reiniciar aplicação
echo "Reiniciando aplicação..."
pm2 restart aet-license-system

# 6. Verificar status
echo "Verificando status da aplicação..."
pm2 status

echo "=== Configuração concluída ==="
echo "Verifique os logs com: pm2 logs aet-license-system"