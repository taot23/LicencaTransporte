#!/bin/bash

# ====================================
# SCRIPT DE CONFIGURAÇÃO DE UPLOADS
# Sistema AET - Servidor Google Cloud
# ====================================

echo "🚀 Configurando sistema de uploads para produção..."

# Configurações
UPLOAD_BASE="/home/servidorvoipnvs/uploads"
PROJECT_DIR="/var/www/aetlicensesystem/LicencaTransporte"
WEB_USER="www-data"
CURRENT_USER=$(whoami)

echo "📁 Usuário atual: $CURRENT_USER"
echo "📁 Diretório base: $UPLOAD_BASE"
echo "📁 Projeto: $PROJECT_DIR"

# Criar diretório principal de uploads
echo "📁 Criando diretório principal de uploads..."
mkdir -p "$UPLOAD_BASE"

# Criar subdiretórios necessários
echo "📁 Criando subdiretórios..."
mkdir -p "$UPLOAD_BASE/vehicles"
mkdir -p "$UPLOAD_BASE/transporters" 
mkdir -p "$UPLOAD_BASE/boletos"
mkdir -p "$UPLOAD_BASE/licenses"
mkdir -p "$UPLOAD_BASE/temp"

# Definir permissões adequadas
echo "🔐 Configurando permissões..."
chmod 755 "$UPLOAD_BASE"
chmod 755 "$UPLOAD_BASE"/*
chown -R "$CURRENT_USER:$CURRENT_USER" "$UPLOAD_BASE"

# Se www-data existir, dar permissões também
if id "$WEB_USER" &>/dev/null; then
    echo "🔐 Configurando permissões para $WEB_USER..."
    chgrp -R "$WEB_USER" "$UPLOAD_BASE"
    chmod -R g+w "$UPLOAD_BASE"
fi

# Criar arquivo de teste
echo "✅ Testando gravação..."
TEST_FILE="$UPLOAD_BASE/test-write.txt"
echo "Sistema AET - Teste de gravação $(date)" > "$TEST_FILE"

if [ -f "$TEST_FILE" ]; then
    echo "✅ Teste de gravação bem-sucedido!"
    rm "$TEST_FILE"
else
    echo "❌ Falha no teste de gravação!"
    exit 1
fi

# Criar arquivo de configuração .env local
echo "⚙️ Criando configuração .env..."
ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Criando novo arquivo .env..."
    cat > "$ENV_FILE" << EOF
# Configuração de produção - Servidor Google
NODE_ENV=production
UPLOAD_DIR=$UPLOAD_BASE
PORT=5000

# Configuração do banco (ajustar conforme necessário)
# DATABASE_URL=postgresql://usuario:senha@localhost:5432/aet_database

# Segurança
SESSION_SECRET=$(openssl rand -base64 32)
COOKIE_SECURE=false
COOKIE_MAX_AGE=86400000

# Logs
LOG_LEVEL=info
DEBUG_SQL=false
EOF
    echo "✅ Arquivo .env criado!"
else
    echo "📝 Atualizando .env existente..."
    # Adicionar/atualizar UPLOAD_DIR no .env existente
    if grep -q "UPLOAD_DIR" "$ENV_FILE"; then
        sed -i "s|UPLOAD_DIR=.*|UPLOAD_DIR=$UPLOAD_BASE|" "$ENV_FILE"
    else
        echo "UPLOAD_DIR=$UPLOAD_BASE" >> "$ENV_FILE"
    fi
    echo "✅ UPLOAD_DIR atualizado no .env!"
fi

# Mostrar status final
echo ""
echo "🎉 CONFIGURAÇÃO CONCLUÍDA!"
echo "📊 Status dos diretórios:"
ls -la "$UPLOAD_BASE"

echo ""
echo "🔧 Próximos passos:"
echo "1. Reinicie o PM2: pm2 restart aet-license-system"
echo "2. Verifique os logs: pm2 logs aet-license-system"
echo "3. Teste um upload através da interface"

echo ""
echo "📋 Informações importantes:"
echo "• Diretório de uploads: $UPLOAD_BASE"
echo "• Arquivo .env: $ENV_FILE"
echo "• Usuário proprietário: $CURRENT_USER"
echo "• Permissões configuradas para escrita"

# Verificar se PM2 está instalado
if command -v pm2 &> /dev/null; then
    echo ""
    echo "🔄 PM2 detectado. Reiniciando aplicação..."
    cd "$PROJECT_DIR"
    pm2 restart aet-license-system 2>/dev/null || echo "⚠️ Aplicação não estava rodando no PM2"
    echo "✅ Aplicação reiniciada!"
else
    echo "⚠️ PM2 não encontrado. Reinicie manualmente a aplicação."
fi

echo ""
echo "🏁 Setup concluído com sucesso!"