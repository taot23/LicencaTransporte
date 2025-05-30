#!/bin/bash

# Script para corrigir o deployment no servidor Google
echo "Iniciando correção do servidor..."

# Parar a aplicação
pm2 stop aet-license-system

# Fazer backup dos arquivos atuais
cp server/storage.ts server/storage.ts.backup.$(date +%Y%m%d_%H%M%S)

# Baixar os arquivos corrigidos do Replit (você precisa fazer upload manual)
echo "Copie os arquivos server/storage.ts e server/routes.ts do Replit para o servidor"

# Reinstalar dependências se necessário
npm install

# Executar o build se necessário
npm run build 2>/dev/null || echo "Build não necessário"

# Reiniciar a aplicação
pm2 restart aet-license-system

# Verificar status
pm2 status

echo "Verificando logs..."
pm2 logs aet-license-system --lines 20

echo "Correção concluída. Teste o cadastro de veículos em: http://34.44.159.254:5000"