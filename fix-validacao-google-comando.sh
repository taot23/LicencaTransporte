#!/bin/bash

# Script de correção rápida para validação no servidor Google
# Execute: bash fix-validacao-google-comando.sh

echo "🔧 CORREÇÃO RÁPIDA DA VALIDAÇÃO - SERVIDOR GOOGLE"
echo "================================================"

# Navegar para diretório do projeto
cd /var/www/aetlicensesystem/LicencaTransporte

echo "📍 Diretório atual: $(pwd)"

# 1. Verificar se existe psql
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL client encontrado"
    
    # Extrair connection string do .env ou usar variável
    DB_URL=$(grep "DATABASE_URL" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    
    if [ -z "$DB_URL" ]; then
        echo "⚠️  DATABASE_URL não encontrada no .env, usando variável de ambiente"
        DB_URL="$DATABASE_URL"
    fi
    
    if [ -z "$DB_URL" ]; then
        echo "❌ DATABASE_URL não definida"
        echo "Defina a variável: export DATABASE_URL='sua_connection_string'"
        exit 1
    fi
    
    echo "🔍 Verificando tabela licencas_emitidas..."
    
    # Criar SQL de teste
    cat > /tmp/check_validation.sql << 'EOF'
-- Verificar se tabela existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'licencas_emitidas'
        ) THEN 'EXISTE'
        ELSE 'NAO_EXISTE'
    END as tabela_status;

-- Contar registros se tabela existir
SELECT 
    COALESCE(
        (SELECT COUNT(*) FROM licencas_emitidas),
        0
    ) as total_registros;
EOF
    
    # Executar teste
    psql "$DB_URL" -f /tmp/check_validation.sql
    
    echo ""
    echo "📋 PRÓXIMOS PASSOS:"
    echo "1. Se tabela NÃO_EXISTE ou total_registros = 0:"
    echo "   Execute: node sync-approved-licenses.cjs"
    echo ""
    echo "2. Reiniciar PM2:"
    echo "   pm2 restart ecosystem.config.js"
    echo ""
    echo "3. Testar no formulário:"
    echo "   Acesse /nova-licenca e teste com placas BDI1A71"
    
else
    echo "❌ PostgreSQL client não encontrado"
    echo "Instale com: sudo apt-get install postgresql-client"
    echo ""
    echo "📋 ALTERNATIVA - Execute manualmente:"
    echo "1. node sync-approved-licenses.js"
    echo "2. pm2 restart ecosystem.config.js"
    echo "3. pm2 logs aet-license-system"
fi

echo ""
echo "🧪 TESTE FINAL:"
echo "No formulário /nova-licenca, use placas:"
echo "- Unidade Tratora: BDI1A71"
echo "- Primeira Carreta: BCB0886" 
echo "- Segunda Carreta: BCB0887"
echo ""
echo "Estados AL, BA, CE, DF, DNIT, MG, MS devem aparecer BLOQUEADOS (amarelo)"
echo "Estados SP, RJ devem aparecer LIBERADOS (normal)"