#!/bin/bash

# Script para corrigir permissões do servidor AET License System
# Execute como root: sudo bash fix_server_permissions.sh

echo "=== Correção de Permissões - AET License System ==="
echo "Data: $(date)"
echo

# Definir variáveis
PROJECT_DIR="/var/www/aetlicensesystem/LicencaTransporte"
WEB_USER="www-data"
CURRENT_USER="servidorvoipnvs"

echo "Diretório do projeto: $PROJECT_DIR"
echo "Usuário web: $WEB_USER"
echo "Usuário atual: $CURRENT_USER"
echo

# Verificar se o diretório existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Erro: Diretório $PROJECT_DIR não encontrado!"
    exit 1
fi

echo "✅ Diretório encontrado"

# Parar o PM2 antes de alterar permissões
echo "🛑 Parando aplicação PM2..."
sudo -u $CURRENT_USER pm2 stop aet-license-system 2>/dev/null || true

# Criar diretórios necessários
echo "📁 Criando diretórios necessários..."
sudo mkdir -p "$PROJECT_DIR/uploads"
sudo mkdir -p "$PROJECT_DIR/node_modules"
sudo mkdir -p "$PROJECT_DIR/.vite"
sudo mkdir -p "$PROJECT_DIR/dist"
sudo mkdir -p "$PROJECT_DIR/logs"

# Definir propriedade correta
echo "👤 Definindo proprietário dos arquivos..."
sudo chown -R $CURRENT_USER:$WEB_USER "$PROJECT_DIR"

# Definir permissões de diretórios
echo "🔐 Configurando permissões de diretórios..."
sudo find "$PROJECT_DIR" -type d -exec chmod 755 {} \;

# Definir permissões de arquivos
echo "📄 Configurando permissões de arquivos..."
sudo find "$PROJECT_DIR" -type f -exec chmod 644 {} \;

# Permissões especiais para executáveis
echo "⚡ Configurando permissões de executáveis..."
sudo chmod +x "$PROJECT_DIR/node_modules/.bin/"* 2>/dev/null || true
sudo find "$PROJECT_DIR" -name "*.sh" -exec chmod +x {} \;

# Permissões especiais para diretórios de upload e cache
echo "📦 Configurando permissões especiais..."
sudo chmod -R 775 "$PROJECT_DIR/uploads"
sudo chmod -R 775 "$PROJECT_DIR/node_modules" 
sudo chmod -R 775 "$PROJECT_DIR/.vite" 2>/dev/null || true
sudo chmod -R 775 "$PROJECT_DIR/dist" 2>/dev/null || true

# Garantir que o grupo tenha permissão de escrita
echo "✍️ Garantindo permissões de escrita para o grupo..."
sudo chgrp -R $WEB_USER "$PROJECT_DIR/uploads"
sudo chgrp -R $WEB_USER "$PROJECT_DIR/node_modules"
sudo chgrp -R $CURRENT_USER "$PROJECT_DIR/.vite" 2>/dev/null || true

# Verificar se o usuário está no grupo correto
echo "👥 Verificando grupos do usuário..."
sudo usermod -a -G $WEB_USER $CURRENT_USER

# Configurar SELinux se estiver ativo
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" != "Disabled" ]; then
    echo "🔒 Configurando SELinux..."
    sudo setsebool -P httpd_can_network_connect 1
    sudo semanage fcontext -a -t httpd_exec_t "$PROJECT_DIR(/.*)?" 2>/dev/null || true
    sudo restorecon -R "$PROJECT_DIR" 2>/dev/null || true
fi

# Limpar cache do Node.js e reinstalar dependências se necessário
echo "🧹 Limpando cache do Node.js..."
sudo -u $CURRENT_USER npm cache clean --force 2>/dev/null || true

# Verificar permissões finais
echo "🔍 Verificando permissões finais..."
ls -la "$PROJECT_DIR" | head -10

echo
echo "✅ Correção de permissões concluída!"
echo
echo "🚀 Comandos para reiniciar a aplicação:"
echo "cd $PROJECT_DIR"
echo "npm install (se necessário)"
echo "pm2 restart aet-license-system"
echo "pm2 logs aet-license-system"
echo
echo "📋 Para monitorar:"
echo "pm2 status"
echo "pm2 logs aet-license-system --lines 50"
echo
echo "🔧 Se ainda houver problemas:"
echo "1. Verifique se o Node.js está atualizado"
echo "2. Delete node_modules e reinstale: rm -rf node_modules && npm install"
echo "3. Verifique o espaço em disco: df -h"
echo "4. Verifique se todas as variáveis de ambiente estão configuradas"
echo

# Exibir informações do sistema
echo "📊 Informações do sistema:"
echo "Espaço em disco:"
df -h "$PROJECT_DIR" | tail -1
echo "Memória:"
free -h | head -2
echo "Usuário atual: $(whoami)"
echo "Grupos: $(groups)"