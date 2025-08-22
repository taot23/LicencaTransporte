# 🔧 Correção do Build para Servidor Google

## 🔍 Problema Identificado
O servidor está procurando o build em `/server/public/` mas o Vite constrói em `/dist/public/`.

## ✅ Solução: Fazer Build e Copiar para Local Correto

No servidor Google, execute:

```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# 1. Parar aplicação
pm2 stop aet-sistema

# 2. Fazer build da aplicação
npm run build

# 3. Verificar se build foi criado
ls -la dist/public/

# 4. Criar link simbólico ou copiar para onde o servidor espera
# Opção A: Link simbólico (recomendado)
sudo mkdir -p server/
sudo ln -sf ../dist/public server/public

# Opção B: Copiar arquivos (alternativa)
# sudo cp -r dist/public server/

# 5. Verificar se ficou correto
ls -la server/public/

# 6. Reiniciar aplicação
pm2 start aet-sistema

# 7. Verificar logs
pm2 logs aet-sistema --lines 10
```

## 🎯 Resultado Esperado

### Logs de Sucesso:
```
[UPLOAD] Validando diretório de upload (SEM FALLBACK): /var/www/aetlicensesystem/uploads
[UPLOAD] ✅ Diretório validado: /var/www/aetlicensesystem/uploads
[UPLOAD] 📁 Subdiretórios: vehicles, transporters, boletos, vehicle-set-types, licenses
[UPLOAD] Servindo arquivos de /var/www/aetlicensesystem/uploads em /uploads
9:XX:XX AM [express] Serving static files from: /var/www/aetlicensesystem/LicencaTransporte/dist/public
9:XX:XX AM [express] Production server running on port 5000
```

### Estrutura Correta:
```
/var/www/aetlicensesystem/LicencaTransporte/
├── dist/
│   └── public/                    # ✅ Build real
├── server/
│   └── public/                    # ✅ Link para dist/public
├── client/
└── package.json
```

## 🌐 Teste Final

```bash
# 1. Status do PM2
pm2 status

# 2. Testar aplicação local
curl -I http://localhost:5000

# 3. Testar no navegador
curl -I http://SEU_IP_SERVIDOR

# 4. Verificar se frontend carrega
curl http://localhost:5000 | head -10
```

## 🔧 Troubleshooting

### Se npm run build falhar:

```bash
# Verificar dependências
npm install

# Limpar e reinstalar se necessário
rm -rf node_modules package-lock.json
npm install

# Tentar build novamente
npm run build

# Verificar script de build
cat package.json | grep -A 5 '"build"'
```

### Se link simbólico não funcionar:

```bash
# Remover link antigo
rm -f server/public

# Copiar diretamente
cp -r dist/public server/

# Verificar
ls -la server/public/
```

### Se ainda não funcionar:

```bash
# Verificar permissões
sudo chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/LicencaTransporte/
sudo chmod -R 755 /var/www/aetlicensesystem/LicencaTransporte/

# Build manual
npx vite build

# Verificar saída do build
ls -la dist/
```

## 🚀 Sistema 100% Funcional

Após esta correção:

1. ✅ **Upload Directory**: Funcionando no diretório externo
2. ✅ **Frontend Build**: Servindo arquivos estáticos corretamente
3. ✅ **Sistema Sem Fallback**: Configuração robusta e explícita
4. ✅ **Produção Ready**: PM2 + Build + Uploads externos

## 🎯 URLs Finais Funcionais

- **Sistema**: `http://SEU_IP_SERVIDOR`
- **API**: `http://SEU_IP_SERVIDOR/api/`
- **Uploads**: `http://SEU_IP_SERVIDOR/uploads/licenses/...`
- **Admin**: `http://SEU_IP_SERVIDOR/admin`

O sistema estará completamente operacional após esta correção.