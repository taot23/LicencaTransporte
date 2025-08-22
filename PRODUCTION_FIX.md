# 🚨 Correção Urgente - Permissões de Upload

## 🔍 Problema Crítico Identificado
```
Error: Upload directory not writable: /var/www/aetlicensesystem/uploads. 
Configure UPLOAD_DIR environment variable with a writable directory.
```

## ✅ Solução Imediata no Servidor Google

Execute estes comandos para corrigir as permissões:

```bash
cd /var/www/aetlicensesystem

# 1. Parar aplicação
pm2 stop aet-sistema

# 2. Corrigir permissões do diretório de uploads
sudo chown -R servidorvoipnvs:www-data uploads/
sudo chmod -R 755 uploads/

# 3. Testar permissão de escrita
echo "teste" > uploads/teste.txt && echo "✅ Permissão OK" || echo "❌ Ainda com problema"
rm -f uploads/teste.txt

# 4. Reiniciar aplicação
pm2 start aet-sistema

# 5. Verificar logs
pm2 logs aet-sistema --lines 10
```

## 🔧 Se Ainda Não Funcionar

Alternativa com permissões mais amplas:

```bash
# Corrigir proprietário
sudo chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/uploads/

# Permissões de escrita para o usuário
sudo chmod -R 775 /var/www/aetlicensesystem/uploads/

# Verificar estrutura e permissões
ls -la /var/www/aetlicensesystem/uploads/
```

## 🎯 Verificação de Sucesso

Após a correção, ao tentar salvar um arquivo no sistema, deve aparecer nos logs:

```
[UPLOAD] Validando diretório de upload (SEM FALLBACK): /var/www/aetlicensesystem/uploads
[UPLOAD] ✅ Diretório validado: /var/www/aetlicensesystem/uploads
[UPLOAD] Iniciando salvamento de arquivo: { originalName: "arquivo.pdf", ... }
[UPLOAD] ✓ Arquivo salvo com sucesso: /var/www/aetlicensesystem/uploads/licenses/...
```

## 🚀 Teste Completo

```bash
# 1. Verificar status
pm2 status

# 2. Verificar permissões
ls -la /var/www/aetlicensesystem/uploads/

# 3. Testar upload via interface web
# - Acessar sistema
# - Tentar fazer upload de arquivo
# - Verificar logs: pm2 logs aet-sistema
```

## 📂 Estrutura Final Esperada

```
/var/www/aetlicensesystem/uploads/
├── licenses/          (755 - servidorvoipnvs:www-data)
├── vehicles/          (755 - servidorvoipnvs:www-data)
├── transporters/      (755 - servidorvoipnvs:www-data)
├── boletos/           (755 - servidorvoipnvs:www-data)
└── vehicle-set-types/ (755 - servidorvoipnvs:www-data)
```

## ⚠️ Problema de Contexto

O erro ocorre porque a função `validateUploadDir` é chamada durante o salvamento do arquivo, mas o diretório `/var/www/aetlicensesystem/uploads` não tem permissões adequadas para escrita pelo processo do Node.js.

## 🎯 Comando Mais Seguro

Se os comandos acima não funcionarem:

```bash
# Garantir que o usuário atual pode escrever
sudo mkdir -p /var/www/aetlicensesystem/uploads/{licenses,vehicles,transporters,boletos,vehicle-set-types}
sudo chown -R $USER:$USER /var/www/aetlicensesystem/uploads
chmod -R 755 /var/www/aetlicensesystem/uploads

# Verificar
touch /var/www/aetlicensesystem/uploads/teste && rm /var/www/aetlicensesystem/uploads/teste && echo "✅ Funcionando"
```

Esta correção deve resolver o problema de upload imediatamente.