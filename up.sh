#!/bin/bash

# Script de configuração de uploads para servidor Google
echo "🚀 Configurando sistema de uploads..."

# Configurações
UPLOAD_BASE="/home/servidorvoipnvs/uploads"
PROJECT_DIR="/var/www/aetlicensesystem/LicencaTransporte"
CURRENT_USER=$(whoami)

echo "📁 Usuário atual: $CURRENT_USER"
echo "📁 Diretório base: $UPLOAD_BASE"

# Criar diretório principal
echo "📁 Criando diretório principal..."
mkdir -p "$UPLOAD_BASE"

# Criar subdiretórios
echo "📁 Criando subdiretórios..."
mkdir -p "$UPLOAD_BASE/vehicles"
mkdir -p "$UPLOAD_BASE/transporters" 
mkdir -p "$UPLOAD_BASE/boletos"
mkdir -p "$UPLOAD_BASE/licenses"

# Configurar permissões
echo "🔐 Configurando permissões..."
chmod 755 "$UPLOAD_BASE"
chmod 755 "$UPLOAD_BASE"/*
chown -R "$CURRENT_USER:$CURRENT_USER" "$UPLOAD_BASE"

# Testar gravação
echo "✅ Testando gravação..."
TEST_FILE="$UPLOAD_BASE/test-write.txt"
echo "Teste de gravação $(date)" > "$TEST_FILE"

if [ -f "$TEST_FILE" ]; then
    echo "✅ Teste bem-sucedido!"
    rm "$TEST_FILE"
else
    echo "❌ Falha no teste!"
    exit 1
fi

# Atualizar .env
echo "⚙️ Configurando .env..."
ENV_FILE="$PROJECT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    if grep -q "UPLOAD_DIR" "$ENV_FILE"; then
        sed -i "s|UPLOAD_DIR=.*|UPLOAD_DIR=$UPLOAD_BASE|" "$ENV_FILE"
    else
        echo "UPLOAD_DIR=$UPLOAD_BASE" >> "$ENV_FILE"
    fi
else
    echo "UPLOAD_DIR=$UPLOAD_BASE" > "$ENV_FILE"
    echo "NODE_ENV=production" >> "$ENV_FILE"
fi

echo "✅ Configuração concluída!"
echo "📊 Diretórios criados:"
ls -la "$UPLOAD_BASE"

# Reiniciar PM2 se disponível
if command -v pm2 &> /dev/null; then
    echo "🔄 Reiniciando PM2..."
    cd "$PROJECT_DIR"
    pm2 restart aet-license-system 2>/dev/null || echo "⚠️ Aplicação não rodando"
fi

echo "🏁 Setup concluído!"