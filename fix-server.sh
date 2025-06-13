#!/bin/bash

echo "=== Correção de Permissões do Servidor AET ==="

# 1. Parar PM2
echo "Parando PM2..."
pm2 stop aet-license-system 2>/dev/null
pm2 delete aet-license-system 2>/dev/null

# 2. Navegar para o diretório
cd /var/www/aetlicensesystem/LicencaTransporte

# 3. Limpar cache problemático
echo "Limpando cache do Vite..."
rm -rf node_modules/.vite
rm -rf dist

# 4. Ajustar permissões
echo "Ajustando permissões..."
sudo chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/LicencaTransporte
chmod -R 755 /var/www/aetlicensesystem/LicencaTransporte
chmod +x start-production.sh

# 5. Construir aplicação
echo "Construindo aplicação..."
npm run build

# 6. Iniciar PM2
echo "Iniciando PM2..."
pm2 start ecosystem.config.js
pm2 save

# 7. Verificar status
echo "Status da aplicação:"
pm2 status
sleep 3
echo "Logs recentes:"
pm2 logs aet-license-system --lines 5

echo "=== Correção concluída ==="
echo "Aplicação disponível em: http://34.44.159.254:5000"