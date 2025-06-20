# Guia: Correção de Uploads no Servidor Google

## Problema Identificado
- Sistema não consegue usar `/var/uploads` por falta de permissão
- Arquivos não estão sendo localizados (erro 404)
- Sistema está usando `/tmp/uploads` temporariamente

## Solução Completa

### Passo 1: Executar o Script de Setup
```bash
# No servidor Google, executar:
cd /var/www/aetlicensesystem/LicencaTransporte
chmod +x setup-uploads-server.sh
./setup-uploads-server.sh
```

### Passo 2: Verificar Configuração
O script criará:
- Diretório: `/home/servidorvoipnvs/uploads`
- Subdiretórios: `vehicles`, `transporters`, `boletos`, `licenses`
- Arquivo `.env` com `UPLOAD_DIR` configurado

### Passo 3: Reiniciar Aplicação
```bash
pm2 restart aet-license-system
pm2 logs aet-license-system
```

### Passo 4: Verificar Logs
Procure nos logs por:
```
[UPLOAD] ✅ Usando diretório: /home/servidorvoipnvs/uploads
```

## Alternativa Manual

Se o script não funcionar:

```bash
# Criar diretório
mkdir -p /home/servidorvoipnvs/uploads/{vehicles,transporters,boletos,licenses}

# Configurar permissões
chmod -R 755 /home/servidorvoipnvs/uploads
chown -R servidorvoipnvs:servidorvoipnvs /home/servidorvoipnvs/uploads

# Adicionar ao .env
echo "UPLOAD_DIR=/home/servidorvoipnvs/uploads" >> .env

# Reiniciar
pm2 restart aet-license-system
```

## Verificação de Sucesso

1. **Logs sem erro de permissão**
2. **Diretório correto nos logs**
3. **Downloads funcionando sem 404**

## Migração de Arquivos Existentes

Se houver arquivos em `/tmp/uploads`:
```bash
cp -r /tmp/uploads/* /home/servidorvoipnvs/uploads/
```

## Estrutura Final
```
/home/servidorvoipnvs/uploads/
├── vehicles/
├── transporters/
├── boletos/
└── licenses/
```