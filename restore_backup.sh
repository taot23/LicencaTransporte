#!/bin/bash

# Script para restaurar backup do banco de dados
echo "=== RESTAURAÇÃO DO BACKUP DO BANCO DE DADOS ==="

DB_NAME="aetlicensesystem"
DB_USER="aetuser"
DB_PASS="nvs123"
BACKUP_FILE="backup_aet_database_20250530.sql"

echo "1. Parando aplicação..."
pm2 stop aet-license-system 2>/dev/null

echo "2. Verificando se arquivo de backup existe..."
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERRO: Arquivo de backup $BACKUP_FILE não encontrado!"
    echo "Arquivos disponíveis:"
    ls -la *.sql 2>/dev/null || echo "Nenhum arquivo SQL encontrado"
    exit 1
fi

echo "3. Recriando banco de dados..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo "4. Restaurando backup..."
psql -h localhost -U $DB_USER -d $DB_NAME -f $BACKUP_FILE

echo "5. Verificando usuários criados..."
psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT id, email, full_name, role FROM users;"

echo "6. Reiniciando aplicação..."
pm2 restart aet-license-system

echo "7. Verificando logs..."
pm2 logs aet-license-system --lines 10

echo "Restauração concluída!"
echo "Acesse: http://34.44.159.254:5000"
echo "Login: admin@sistema.com"
echo "Senha: admin123"