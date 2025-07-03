#!/bin/bash

# Script para configurar uploads no servidor Google
# Execute como: chmod +x setup-uploads-google.sh && ./setup-uploads-google.sh

echo "🚀 Configurando sistema de uploads no servidor Google..."

# Definir o diretório de upload (usando o primeiro da lista de prioridades)
UPLOAD_DIR="/home/servidorvoipnvs/uploads"

echo "📁 Criando diretório principal: $UPLOAD_DIR"
sudo mkdir -p "$UPLOAD_DIR"

echo "📁 Criando subdiretórios organizados..."
sudo mkdir -p "$UPLOAD_DIR/vehicles"
sudo mkdir -p "$UPLOAD_DIR/transporters" 
sudo mkdir -p "$UPLOAD_DIR/boletos"
sudo mkdir -p "$UPLOAD_DIR/licenses"

echo "🔒 Configurando permissões..."
sudo chown -R servidorvoipnvs:servidorvoipnvs "$UPLOAD_DIR"
sudo chmod -R 755 "$UPLOAD_DIR"

echo "📝 Criando arquivo .env com variável UPLOAD_DIR..."
echo "UPLOAD_DIR=$UPLOAD_DIR" >> .env

echo "✅ Configuração concluída!"
echo ""
echo "📋 Estrutura criada:"
echo "   $UPLOAD_DIR/"
echo "   ├── vehicles/     (arquivos CRLV dos veículos)"
echo "   ├── transporters/ (documentos dos transportadores)"
echo "   ├── boletos/      (boletos e notas fiscais)"
echo "   └── licenses/     (licenças organizadas PLACA_ESTADO_NUMEROAET)"
echo ""
echo "🔄 Reinicie o servidor PM2 para aplicar as mudanças:"
echo "   pm2 restart ecosystem.config.js"