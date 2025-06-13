#!/bin/bash

# Script de inicialização para produção
# Usa servidor de produção dedicado para evitar problemas do Vite

# Definir variáveis de ambiente
export NODE_ENV=production
export PORT=5000

# Construir a aplicação se não existir
if [ ! -d "dist/public" ]; then
    echo "Construindo aplicação para produção..."
    npm run build
fi

# Iniciar servidor de produção
exec node_modules/.bin/tsx server/production.ts