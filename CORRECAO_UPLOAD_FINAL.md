# 🔧 Correção Final - Upload de Arquivos

## 🔍 Problema Identificado

O sistema estava validando o diretório de upload na importação do módulo. Se as permissões fossem corrigidas APÓS o início do servidor, o módulo já estava carregado com erro.

## ✅ Correção Aplicada

Modificada a função `validateUploadDir` em `server/lib/license-storage.ts` para:
- **Validação sob demanda**: Só valida quando realmente precisa fazer upload
- **Sem cache de erro**: Se falhar uma vez, tentará novamente na próxima operação
- **Logs detalhados**: Mantém sistema de logs claros sem fallback

## 📋 Comandos no Servidor Google

Para aplicar a correção completa:

```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# 1. Parar aplicação
pm2 stop aet-sistema

# 2. Fazer pull das correções (se necessário)
# git pull origin main

# 3. Garantir permissões corretas
cd /var/www/aetlicensesystem
sudo chown -R servidorvoipnvs:www-data uploads/
sudo chmod -R 775 uploads/

# 4. Voltar ao diretório da aplicação
cd LicencaTransporte

# 5. Reiniciar aplicação para aplicar correções
pm2 restart aet-sistema

# 6. Verificar logs
pm2 logs aet-sistema --lines 15
```

## 🎯 Logs Esperados (Sistema Funcionando)

```
[UPLOAD] Validando diretório de upload (SEM FALLBACK): /var/www/aetlicensesystem/uploads
[UPLOAD] ✅ Diretório validado: /var/www/aetlicensesystem/uploads
[UPLOAD] 📁 Subdiretórios: vehicles, transporters, boletos, vehicle-set-types, licenses
9:XX:XX AM [express] serving on port 5000
```

## 🔧 Teste de Upload

1. **Acessar sistema**: Fazer login como administrador
2. **Ir para licença**: Selecionar uma licença existente
3. **Fazer upload**: Anexar arquivo PDF
4. **Verificar resultado**: Deve aparecer nos logs:

```
[UPLOAD] Iniciando salvamento de arquivo: { originalName: "arquivo.pdf", transporter: "EMPRESA", state: "SP", licenseNumber: "REQ-XXX", bufferSize: "XXXkb" }
[UPLOAD] Diretório de destino: /var/www/aetlicensesystem/uploads/licenses/empresa/sp/req-xxx
[UPLOAD] ✓ Diretório criado/verificado: /var/www/aetlicensesystem/uploads/licenses/empresa/sp/req-xxx
[UPLOAD] Nome final do arquivo: arquivo.pdf
[UPLOAD] Caminho completo: /var/www/aetlicensesystem/uploads/licenses/empresa/sp/req-xxx/arquivo.pdf
[UPLOAD] ✓ Arquivo salvo com sucesso: /var/www/aetlicensesystem/uploads/licenses/empresa/sp/req-xxx/arquivo.pdf
[UPLOAD] ✓ URL pública: /uploads/licenses/empresa/sp/req-xxx/arquivo.pdf
```

## 🚀 Benefícios da Correção

### 1. **Validação Sob Demanda**
- Não falha na inicialização se permissões estiverem temporariamente incorretas
- Valida apenas quando realmente precisa fazer upload
- Permite correção de permissões sem restart

### 2. **Sistema Robusto**
- Mantém logs detalhados para debugging
- Falha claramente se configuração estiver incorreta
- Sem fallbacks silenciosos

### 3. **Facilidade de Manutenção**
- Permissões podem ser corrigidas a qualquer momento
- Sistema se adapta automaticamente às correções
- Logs claros indicam exatamente onde está o problema

## ⚠️ Se Ainda Houver Problemas

### Diagnóstico Adicional:
```bash
# Verificar permissões específicas
ls -la /var/www/aetlicensesystem/uploads/
ls -la /var/www/aetlicensesystem/uploads/licenses/

# Testar criação manual
mkdir -p /var/www/aetlicensesystem/uploads/licenses/teste/sp/aet-123
echo "teste" > /var/www/aetlicensesystem/uploads/licenses/teste/sp/aet-123/arquivo.txt
cat /var/www/aetlicensesystem/uploads/licenses/teste/sp/aet-123/arquivo.txt
rm -rf /var/www/aetlicensesystem/uploads/licenses/teste/

# Verificar processo Node.js
ps aux | grep node
```

### Permissões Mais Amplas (Se Necessário):
```bash
sudo chmod -R 777 /var/www/aetlicensesystem/uploads/
```

## 🎉 Sistema Corrigido

Após esta correção, o sistema de upload deve funcionar perfeitamente, validando permissões apenas quando necessário e se adaptando automaticamente a correções de configuração.