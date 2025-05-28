#!/bin/bash

echo "🔧 Aplicando correção final..."

cd /var/www/aetlicensesystem/LicencaTransporte

pm2 stop all

# Corrigir permissões
chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem
chmod -R 755 /var/www/aetlicensesystem

# Criar diretórios necessários
mkdir -p uploads
mkdir -p node_modules/.vite
chown -R servidorvoipnvs:servidorvoipnvs uploads
chown -R servidorvoipnvs:servidorvoipnvs node_modules/.vite
chmod -R 755 uploads
chmod -R 755 node_modules/.vite

# Rebuild da aplicação com as novas dependências
npm run build

# Executar migrações do banco
npm run db:push

echo "✅ Tudo corrigido!"

# Reiniciar aplicação
pm2 start ecosystem.config.js
pm2 save

echo "🚀 Sistema funcionando!"