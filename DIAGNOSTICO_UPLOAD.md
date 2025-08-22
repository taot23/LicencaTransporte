# 🔍 Diagnóstico de Upload - Debug Detalhado

## 🚨 Problema Reportado
Usuário relata erro ao fazer upload de novos arquivos.

## 📋 Possíveis Causas

### 1. **Permissões de Diretório**
- Diretório base: `/var/www/aetlicensesystem/uploads`
- Subdiretórios dinâmicos: `licenses/transportador/estado/licenca/`

### 2. **Validação de Parâmetros**
Função `saveLicenseFile` requer:
- `buffer`: Buffer do arquivo
- `originalName`: Nome original do arquivo
- `transporter`: Nome da transportadora
- `state`: Estado (UF)
- `licenseNumber`: Número da licença

### 3. **Estrutura de Diretórios**
Sistema cria automaticamente:
```
/var/www/aetlicensesystem/uploads/licenses/
├── transportadora-abc-ltda/
│   └── sp/
│       └── aet-001-2025/
│           └── arquivo.pdf
```

## 🔧 Comandos de Diagnóstico no Servidor

```bash
cd /var/www/aetlicensesystem

# 1. Verificar permissões do diretório base
ls -la uploads/
ls -la uploads/licenses/

# 2. Testar criação de subdiretório
mkdir -p uploads/licenses/teste/sp/aet-123 2>/dev/null && echo "✅ Criação OK" || echo "❌ Erro na criação"

# 3. Testar escrita em subdiretório
echo "teste" > uploads/licenses/teste/sp/aet-123/teste.txt 2>/dev/null && echo "✅ Escrita OK" || echo "❌ Erro na escrita"

# 4. Limpar teste
rm -rf uploads/licenses/teste/

# 5. Verificar logs de upload
pm2 logs aet-sistema | grep -i upload

# 6. Verificar logs de erro
pm2 logs aet-sistema --err | tail -20
```

## 🎯 Logs Esperados em Upload Bem-Sucedido

```
[UPLOAD] Iniciando salvamento de arquivo: { originalName: "arquivo.pdf", transporter: "EMPRESA ABC", state: "SP", licenseNumber: "AET-123-2025", bufferSize: "245KB" }
[UPLOAD] Diretório de destino: /var/www/aetlicensesystem/uploads/licenses/empresa-abc/sp/aet-123-2025
[UPLOAD] ✓ Diretório criado/verificado: /var/www/aetlicensesystem/uploads/licenses/empresa-abc/sp/aet-123-2025
[UPLOAD] Nome final do arquivo: arquivo.pdf
[UPLOAD] Caminho completo: /var/www/aetlicensesystem/uploads/licenses/empresa-abc/sp/aet-123-2025/arquivo.pdf
[UPLOAD] ✓ Arquivo salvo com sucesso: /var/www/aetlicensesystem/uploads/licenses/empresa-abc/sp/aet-123-2025/arquivo.pdf
[UPLOAD] ✓ URL pública: /uploads/licenses/empresa-abc/sp/aet-123-2025/arquivo.pdf
```

## 🚨 Logs de Erro Possíveis

### Erro de Permissão:
```
[UPLOAD] ❌ ERRO ao salvar arquivo da licença { originalName: "arquivo.pdf", destDir: "/var/www/aetlicensesystem/uploads/licenses/...", error: "EACCES: permission denied" }
```

### Erro de Diretório:
```
[UPLOAD] ❌ ERRO ao salvar arquivo da licença { error: "ENOENT: no such file or directory" }
```

### Erro de Parâmetros:
```
[UPLOAD] ❌ ERRO: Parâmetros obrigatórios ausentes para upload
```

## 🔧 Soluções por Tipo de Erro

### Se Erro de Permissão:
```bash
sudo chown -R servidorvoipnvs:www-data /var/www/aetlicensesystem/uploads/
sudo chmod -R 755 /var/www/aetlicensesystem/uploads/
```

### Se Erro de Diretório:
```bash
sudo mkdir -p /var/www/aetlicensesystem/uploads/licenses/
sudo chown servidorvoipnvs:www-data /var/www/aetlicensesystem/uploads/licenses/
```

### Se Erro de Parâmetros:
Verificar se frontend está enviando todos os dados obrigatórios:
- `transporter`
- `state` 
- `licenseNumber`
- `buffer`
- `originalName`

## 📊 Próximos Passos

1. Executar comandos de diagnóstico
2. Verificar logs específicos do momento do erro
3. Identificar se é problema de permissão, estrutura ou código
4. Aplicar solução específica
5. Testar upload novamente

## ⚡ Teste Rápido

Para testar rapidamente se o sistema está funcionando:

1. Acessar sistema
2. Ir para uma licença existente
3. Tentar fazer upload de um arquivo pequeno (PDF)
4. Observar resposta e verificar logs imediatamente

Se erro persistir, executar comandos de diagnóstico e verificar logs detalhados.