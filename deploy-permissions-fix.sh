#!/bin/bash

# Script para aplicar correções de permissões no servidor Google
# Execute como: bash deploy-permissions-fix.sh

echo "🚀 APLICANDO CORREÇÕES DE PERMISSÕES NO SERVIDOR"
echo "=============================================="

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script no diretório raiz do projeto"
    exit 1
fi

# 1. Verificar Node.js e dependências
echo "📦 Verificando dependências..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 não encontrado"
    exit 1
fi

echo "✅ Node.js e PM2 encontrados"

# 2. Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# 3. Verificar arquivo .env
if [ ! -f ".env" ]; then
    echo "⚠️  Arquivo .env não encontrado"
    echo "📋 Copiando template .env.production.exemplo para .env"
    cp .env.production.exemplo .env
    echo "❗ IMPORTANTE: Edite o arquivo .env com suas configurações reais"
    echo "   Especialmente DATABASE_URL e SESSION_SECRET"
    read -p "Pressione Enter após configurar o .env..."
fi

# 4. Executar correção de permissões no banco
echo "🔧 Executando correção de permissões no banco de dados..."

# Verificar se axios está instalado (necessário para os scripts)
if ! npm list axios >/dev/null 2>&1; then
    echo "📦 Instalando dependência axios..."
    npm install axios
fi

node fix-permissions-production.js

if [ $? -ne 0 ]; then
    echo "❌ Erro na correção de permissões"
    echo "💡 Verifique se o arquivo .env está configurado corretamente"
    exit 1
fi

# 5. Parar aplicação atual
echo "⏹️  Parando aplicação atual..."
pm2 stop aet-license-system 2>/dev/null || true
pm2 delete aet-license-system 2>/dev/null || true

# 6. Iniciar com nova configuração
echo "🔄 Iniciando aplicação com configurações corrigidas..."
pm2 start ecosystem.config.js

# 7. Salvar configuração PM2
pm2 save

# 8. Verificar status
echo "📊 Verificando status da aplicação..."
pm2 show aet-license-system

# 9. Teste de validação rápido
echo "🧪 Executando validação do sistema..."
node validation-fix.js

echo ""
echo "🔍 Para teste completo de permissões (opcional):"
echo "   node test-permissions-server.js"

echo ""
echo "✅ CORREÇÕES APLICADAS COM SUCESSO!"
echo "=============================================="
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Verifique os logs: pm2 logs aet-license-system"
echo "2. Teste o login com suas credenciais existentes"
echo "3. Se ainda houver problemas, verifique o arquivo .env"
echo "4. As senhas existentes foram preservadas"
echo ""
echo "🔧 COMANDOS ÚTEIS:"
echo "- Ver logs: pm2 logs aet-license-system"
echo "- Reiniciar: pm2 restart aet-license-system"
echo "- Parar: pm2 stop aet-license-system"
echo "- Status: pm2 status"
echo ""
echo "📞 Para suporte, documente:"
echo "- Logs de erro específicos"
echo "- Resultado dos testes de permissão"
echo "- Configuração do PM2"