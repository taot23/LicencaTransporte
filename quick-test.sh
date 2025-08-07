#!/bin/bash

# Script de teste rápido para verificar se o sistema está funcionando
echo "🔍 TESTE RÁPIDO DO SISTEMA AET"
echo "=============================="

# 1. Verificar se PM2 está rodando
echo "📊 Verificando status do PM2..."
if pm2 list | grep -q "aet-license-system"; then
    echo "✅ Processo PM2 encontrado"
    pm2 show aet-license-system | grep -E "(status|uptime|restarts)"
else
    echo "❌ Processo PM2 não encontrado"
    echo "💡 Execute: pm2 start ecosystem.config.js"
fi

# 2. Verificar logs recentes
echo ""
echo "📋 Últimos logs (últimas 3 linhas):"
pm2 logs aet-license-system --lines 3 || echo "❌ Erro ao acessar logs"

# 3. Testar conexão HTTP
echo ""
echo "🌐 Testando conexão HTTP..."
if curl -s http://localhost:5000/api/user > /dev/null; then
    echo "✅ Servidor respondendo"
else
    echo "❌ Servidor não está respondendo"
fi

# 4. Validação do banco (se disponível)
echo ""
echo "🗄️  Validação do banco de dados..."
if command -v node >/dev/null 2>&1; then
    export DATABASE_URL="postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem"
    node validation-fix.js 2>/dev/null || echo "⚠️  Erro na validação do banco - verifique credenciais"
else
    echo "⚠️  Node.js não encontrado - pular validação do banco"
fi

echo ""
echo "🏁 TESTE CONCLUÍDO"
echo "=================="
echo "Para mais detalhes:"
echo "  - Logs completos: pm2 logs aet-license-system"
echo "  - Status detalhado: pm2 show aet-license-system"
echo "  - Reiniciar: pm2 restart aet-license-system"