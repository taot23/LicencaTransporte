# 🔧 Correção do Diretório de Upload no Servidor Google

## 📂 Problema Atual
- Sistema está salvando em `/var/www/aetlicensesystem/LicencaTransporte/uploads` (dentro do projeto)
- Deveria salvar em `/var/www/aetlicensesystem/uploads` (fora do projeto)

## ✅ Solução: Configurar UPLOAD_DIR Corretamente

### 1. No Servidor Google, execute:

```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# 1. Criar o diretório externo correto
sudo mkdir -p /var/www/aetlicensesystem/uploads/{licenses,vehicles,transporters,boletos,vehicle-set-types}

# 2. Configurar permissões
sudo chown -R servidorvoipnvs:www-data /var/www/aetlicensesystem/uploads
sudo chmod -R 755 /var/www/aetlicensesystem/uploads

# 3. Corrigir variável de ambiente no .env.production
sed -i 's|UPLOAD_DIR=.*|UPLOAD_DIR=/var/www/aetlicensesystem/uploads|' .env.production

# 4. Verificar se a mudança foi aplicada
grep UPLOAD_DIR .env.production

# 5. Mover arquivos existentes (se houver)
if [ -d "uploads" ] && [ "$(ls -A uploads 2>/dev/null)" ]; then
    echo "Movendo arquivos existentes..."
    sudo cp -r uploads/* /var/www/aetlicensesystem/uploads/ 2>/dev/null || true
    echo "Arquivos movidos para o diretório externo"
fi

# 6. Reiniciar aplicação para aplicar mudanças
pm2 restart aet-sistema

# 7. Verificar logs
pm2 logs aet-sistema --lines 10
```

### 2. Verificar se funcionou:

```bash
# Deve mostrar: UPLOAD_DIR=/var/www/aetlicensesystem/uploads
grep UPLOAD_DIR /var/www/aetlicensesystem/LicencaTransporte/.env.production

# Verificar logs da aplicação - deve mostrar o novo diretório
pm2 logs aet-sistema | grep "UPLOAD"

# Testar estrutura de diretórios
ls -la /var/www/aetlicensesystem/uploads/
```

### 3. Resultado Esperado nos Logs:

```
[UPLOAD] Validando diretório de upload (SEM FALLBACK): /var/www/aetlicensesystem/uploads
[UPLOAD] ✅ Diretório validado: /var/www/aetlicensesystem/uploads
[UPLOAD] 📁 Subdiretórios: vehicles, transporters, boletos, vehicle-set-types, licenses
```

## 🎯 Estrutura Final Correta:

```
/var/www/aetlicensesystem/
├── LicencaTransporte/              # Aplicação (código)
│   ├── server/
│   ├── client/
│   ├── .env.production            # Configurações
│   └── ecosystem.config.cjs
└── uploads/                        # Arquivos (EXTERNO)
    ├── licenses/
    │   └── benda-cia-ltda/sp/aet-2025-1570/arquivo.pdf
    ├── vehicles/
    ├── transporters/
    └── vehicle-set-types/
```

## 🌐 URLs Continuam Funcionais:

- **Sistema**: `http://SEU_IP`
- **Uploads**: `http://SEU_IP/uploads/licenses/...`
- **Diferença**: Arquivos agora salvos **fora** do diretório da aplicação

## ⚠️ Importante:

Após esta correção:
1. ✅ Arquivos ficarão seguros durante reinstalações
2. ✅ Logs mostrarão diretório externo sendo usado
3. ✅ Sistema continuará funcionando normalmente
4. ✅ URLs de acesso permanecem as mesmas

## 🔍 Troubleshooting:

Se após reiniciar ainda estiver usando diretório local:

```bash
# Verificar se PM2 está carregando .env.production
pm2 show aet-sistema | grep env

# Forçar restart completo
pm2 delete aet-sistema
pm2 start ecosystem.config.cjs

# Verificar logs
pm2 logs aet-sistema --lines 20
```