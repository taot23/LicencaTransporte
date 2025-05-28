#!/bin/bash

echo "=== SCRIPT DE CORREÇÃO - TRANSPORTADORES AET ==="
echo "Este script vai corrigir o problema de transportadores não aparecendo"
echo ""

# Função para pausar e aguardar confirmação
pause() {
    echo ""
    read -p "Pressione ENTER para continuar..."
    echo ""
}

# 1. Verificar se estamos no diretório correto
echo "1. Verificando diretório atual..."
if [ ! -f "package.json" ]; then
    echo "❌ ERRO: Execute este script no diretório /var/www/aetlicensesystem/LicencaTransporte"
    exit 1
fi
echo "✅ Diretório correto!"

# 2. Fazer backup dos arquivos que serão alterados
echo ""
echo "2. Fazendo backup dos arquivos..."
cp client/src/components/admin/user-select.tsx client/src/components/admin/user-select.tsx.backup.$(date +%Y%m%d_%H%M%S)
cp client/src/components/licenses/license-form.tsx client/src/components/licenses/license-form.tsx.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup criado!"

# 3. Corrigir o arquivo user-select.tsx
echo ""
echo "3. Corrigindo user-select.tsx..."
sed -i 's|queryKey: \["/api/admin/non-admin-users"\]|queryKey: ["/api/admin/users"]|g' client/src/components/admin/user-select.tsx
sed -i 's|apiRequest("GET", "/api/admin/non-admin-users")|apiRequest("GET", "/api/admin/users")|g' client/src/components/admin/user-select.tsx
echo "✅ user-select.tsx corrigido!"

# 4. Adicionar debug no license-form.tsx
echo ""
echo "4. Adicionando debug no license-form.tsx..."

# Criar arquivo temporário com a correção
cat > /tmp/license-form-fix.txt << 'EOF'
  // Fetch transporters linked to the user
  const { data: transporters = [], isLoading: isLoadingTransporters } = useQuery<Transporter[]>({
    queryKey: ["/api/user/transporters"],
  });

  // Debug: mostrar transportadores carregados
  console.log("🔍 [DEBUG] Transportadores carregados:", transporters);
  console.log("🔍 [DEBUG] IsLoading transporters:", isLoadingTransporters);
  console.log("🔍 [DEBUG] Quantidade de transportadores:", transporters?.length || 0);
EOF

# Aplicar a correção usando sed mais específico
if grep -q "// Debug: mostrar transportadores carregados" client/src/components/licenses/license-form.tsx; then
    echo "✅ Debug já adicionado no license-form.tsx"
else
    sed -i '/queryKey: \[\"\/api\/user\/transporters\"\]/a\\n  // Debug: mostrar transportadores carregados\n  console.log("🔍 [DEBUG] Transportadores carregados:", transporters);\n  console.log("🔍 [DEBUG] IsLoading transporters:", isLoadingTransporters);\n  console.log("🔍 [DEBUG] Quantidade de transportadores:", transporters?.length || 0);' client/src/components/licenses/license-form.tsx
    echo "✅ Debug adicionado no license-form.tsx!"
fi

# 5. Verificar vinculações no banco de dados
echo ""
echo "5. Verificando vinculações no banco de dados..."
sudo -u postgres psql -d aetlicensesystem -c "
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    t.id as transporter_id,
    t.name as transporter_name
FROM users u 
LEFT JOIN transporters t ON t.user_id = u.id 
WHERE t.id IS NOT NULL
ORDER BY u.id;
"

pause

# 6. Parar e reiniciar o PM2
echo ""
echo "6. Reiniciando o serviço..."
pm2 stop all
sleep 2
pm2 start all
sleep 3
pm2 logs --lines 5

echo ""
echo "=== CORREÇÃO CONCLUÍDA ==="
echo ""
echo "🎯 PRÓXIMOS PASSOS PARA TESTAR:"
echo ""
echo "1. Acesse: http://34.44.159.254:5000"
echo "2. Faça login com um usuário que tem transportador vinculado"
echo "3. Abra o Console do navegador (F12)"
echo "4. Clique em 'Solicitar AET'"
echo "5. Verifique as mensagens de debug no console"
echo ""
echo "📧 USUÁRIOS PARA TESTE:"
echo "- fiscal@nscaravaggio.com.br (senha: 123456)"
echo "- teste2@teste.com (senha: dele)"
echo ""
echo "🔍 SE AINDA NÃO FUNCIONAR:"
echo "- Verifique os logs do console do navegador"
echo "- Execute: pm2 logs aet-license-system --lines 20"
echo "- Limpe o cache do navegador: Ctrl+Shift+R"
echo ""
echo "✅ Script concluído com sucesso!"