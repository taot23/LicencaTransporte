# Guia de Configuração de Uploads - Servidor Google

## Passos para Configurar o Sistema de Uploads

### 1. Conectar ao Servidor
```bash
ssh servidorvoipnvs@[SEU_IP_DO_SERVIDOR]
```

### 2. Navegar até o diretório do projeto
```bash
cd /var/www/aetlicensesystem/LicencaTransporte
```

### 3. Executar o script de configuração
```bash
# Dar permissão de execução
chmod +x setup-uploads-google.sh

# Executar o script
./setup-uploads-google.sh
```

### 4. Verificar se as pastas foram criadas
```bash
ls -la /home/servidorvoipnvs/uploads/
```

Você deve ver:
```
drwxr-xr-x  6 servidorvoipnvs servidorvoipnvs 4096 vehicles/
drwxr-xr-x  2 servidorvoipnvs servidorvoipnvs 4096 transporters/
drwxr-xr-x  2 servidorvoipnvs servidorvoipnvs 4096 boletos/
drwxr-xr-x  2 servidorvoipnvs servidorvoipnvs 4096 licenses/
```

### 5. Reiniciar o servidor PM2
```bash
pm2 restart ecosystem.config.js
pm2 save
```

### 6. Verificar os logs para confirmar
```bash
pm2 logs aet-license-system
```

Você deve ver:
```
[UPLOAD] ✅ Usando diretório: /home/servidorvoipnvs/uploads
[UPLOAD] 📁 Subdiretórios criados: vehicles, transporters, boletos, licenses
```

## Estrutura Final dos Uploads

```
/home/servidorvoipnvs/uploads/
├── vehicles/     → Arquivos CRLV dos veículos
├── transporters/ → Documentos dos transportadores  
├── boletos/      → Boletos e notas fiscais
└── licenses/     → Licenças organizadas (PLACA_ESTADO_NUMEROAET)
```

## Nomenclatura dos Arquivos de Licenças

Os arquivos de licenças serão salvos automaticamente com o padrão:
- **Formato**: `PLACA_ESTADO_NUMEROAET.extensao`
- **Exemplo**: `BDI1A71_SP_123456.pdf`

## Troubleshooting

### Se der erro de permissão:
```bash
sudo chown -R servidorvoipnvs:servidorvoipnvs /home/servidorvoipnvs/uploads
sudo chmod -R 755 /home/servidorvoipnvs/uploads
```

### Para testar se o sistema está funcionando:
1. Faça login no sistema
2. Vá para "Gerenciar Licenças" 
3. Clique em uma licença e tente fazer upload de um arquivo
4. Verifique se o arquivo aparece na pasta `/home/servidorvoipnvs/uploads/licenses/`