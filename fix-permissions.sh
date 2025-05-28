#!/bin/bash

echo "🔧 Corrigindo permissões do sistema..."

# Parar a aplicação
pm2 stop all

# Corrigir permissões do diretório
chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem
chmod -R 755 /var/www/aetlicensesystem

# Criar diretório uploads com permissões corretas
mkdir -p /var/www/aetlicensesystem/LicencaTransporte/uploads
chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/LicencaTransporte/uploads
chmod -R 755 /var/www/aetlicensesystem/LicencaTransporte/uploads

# Corrigir permissões do node_modules
chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/LicencaTransporte/node_modules
chmod -R 755 /var/www/aetlicensesystem/LicencaTransporte/node_modules

echo "✅ Permissões corrigidas!"

# Reiniciar aplicação
cd /var/www/aetlicensesystem/LicencaTransporte
pm2 start ecosystem.config.js

echo "🚀 Aplicação reiniciada!"