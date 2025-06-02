#!/bin/bash

# Correção rápida de permissões para o AET License System
# Execute no servidor: sudo bash quick_fix_permissions.sh

PROJECT_DIR="/var/www/aetlicensesystem/LicencaTransporte"
USER="servidorvoipnvs"

echo "Corrigindo permissões do AET License System..."

# Parar aplicação
sudo -u $USER pm2 stop aet-license-system 2>/dev/null || true

# Criar diretórios necessários
sudo mkdir -p "$PROJECT_DIR/uploads"
sudo mkdir -p "$PROJECT_DIR/node_modules"
sudo mkdir -p "$PROJECT_DIR/.vite"

# Corrigir propriedade e permissões
sudo chown -R $USER:www-data "$PROJECT_DIR"
sudo chmod -R 755 "$PROJECT_DIR"
sudo chmod -R 775 "$PROJECT_DIR/uploads"
sudo chmod -R 775 "$PROJECT_DIR/node_modules"
sudo chmod -R 775 "$PROJECT_DIR/.vite" 2>/dev/null || true

# Limpar cache
sudo -u $USER npm cache clean --force 2>/dev/null || true
sudo rm -rf "$PROJECT_DIR/node_modules/.vite" 2>/dev/null || true

echo "Permissões corrigidas. Reinicie com:"
echo "cd $PROJECT_DIR"
echo "pm2 restart aet-license-system"