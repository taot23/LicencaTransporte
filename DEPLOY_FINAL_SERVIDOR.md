# ✅ Deploy Final - Servidor Google Configurado

## 🎯 Problema Resolvido

**Erro anterior:**
```
Cannot find module '/var/www/aetlicensesystem/LicencaTransporte/server/routes.js'
```

**Solução aplicada:**
- Alterado PM2 para usar `tsx` como interpretador
- Script mudou de `server/production-server.js` para `server/index.ts`
- Sistema agora executa TypeScript diretamente

## 📋 Configuração Final para Servidor

### 1. Instalar TSX globalmente no servidor
```bash
sudo npm install -g tsx
```

### 2. Configurar variáveis de ambiente no servidor
```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Criar .env.production
cp .env.production.example .env.production
nano .env.production
```

**Conteúdo do .env.production:**
```env
NODE_ENV=production
PORT=5000

# Banco de Dados
DATABASE_URL=postgresql://aet_user:SUA_SENHA_SEGURA@localhost:5432/aet_production

# Uploads - CORRIGIDO para seu servidor
UPLOAD_DIR=/var/www/aetlicensesystem/uploads

# Segurança
SESSION_SECRET=GERE_UMA_CHAVE_MUITO_SEGURA_DE_64_CARACTERES_AQUI

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=aet_production
PGUSER=aet_user
PGPASSWORD=SUA_SENHA_SEGURA

# Configurações
MAX_FILE_SIZE=100
COOKIE_SECURE=false
```

### 3. Configurar diretórios corretos
```bash
# Criar diretório de uploads na localização correta
sudo mkdir -p /var/www/aetlicensesystem/uploads/{licenses,vehicles,transporters,boletos,vehicle-set-types}

# Configurar permissões
sudo chown -R servidorvoipnvs:www-data /var/www/aetlicensesystem/uploads
sudo chmod -R 755 /var/www/aetlicensesystem/uploads

# Criar diretório de logs
sudo mkdir -p /var/log/aet
sudo chown servidorvoipnvs:servidorvoipnvs /var/log/aet
```

### 4. Configurar banco de dados
```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Instalar dependências
npm install

# Executar migrações
npm run db:push --force
```

### 5. Iniciar aplicação com PM2
```bash
# O ecosystem.config.cjs já está correto com:
# - script: 'server/index.ts'
# - interpreter: 'tsx'
# - cwd: '/var/www/aetlicensesystem/LicencaTransporte'

# Iniciar aplicação
pm2 start ecosystem.config.cjs

# Configurar para iniciar no boot
pm2 startup
pm2 save

# Verificar status
pm2 status
pm2 logs aet-sistema
```

## 🔧 Configuração Nginx (Recomendado)

### 1. Instalar Nginx
```bash
sudo apt install nginx -y
```

### 2. Configurar site
```bash
sudo nano /etc/nginx/sites-available/aet-sistema
```

**Configuração Nginx:**
```nginx
server {
    listen 80;
    server_name SEU_IP_OU_DOMINIO;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Servir uploads diretamente pelo Nginx
    location /uploads/ {
        alias /var/www/aetlicensesystem/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Ativar site
```bash
sudo ln -s /etc/nginx/sites-available/aet-sistema /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 🛡️ Firewall
```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## ✅ Verificação Final

### Comandos de teste
```bash
# Status dos serviços
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql

# Testar aplicação
curl -I http://localhost:5000
curl -I http://SEU_IP_SERVIDOR

# Verificar logs
pm2 logs aet-sistema --lines 50
tail -f /var/log/aet/error-0.log
```

### URLs de acesso
- **Aplicação**: `http://SEU_IP_SERVIDOR`
- **API**: `http://SEU_IP_SERVIDOR/api/`
- **Uploads**: `http://SEU_IP_SERVIDOR/uploads/`

## 📂 Estrutura Final Confirmada

```
/var/www/aetlicensesystem/
├── LicencaTransporte/              # Código da aplicação
│   ├── server/                     # Backend TypeScript
│   │   ├── index.ts               # ← Script principal
│   │   ├── routes.ts              # ← Rotas da API
│   │   └── ...
│   ├── client/                     # Frontend
│   ├── .env.production            # Configurações
│   ├── ecosystem.config.cjs       # PM2 config
│   └── package.json
└── uploads/                        # Arquivos uploadados
    ├── licenses/                   # ← Licenças aqui
    │   └── [transportador]/[estado]/[licenca]/
    ├── vehicles/                   # CRLVs
    ├── transporters/              # Docs transportadoras
    ├── boletos/                   # Boletos/NFs
    └── vehicle-set-types/         # Imagens tipos
```

## 🔄 Comandos de Manutenção

```bash
# Reiniciar aplicação
pm2 restart aet-sistema

# Ver logs em tempo real
pm2 logs aet-sistema --lines 100 --follow

# Backup do banco
pg_dump -h localhost -U aet_user aet_production > backup_$(date +%Y%m%d).sql

# Monitoramento
pm2 monit

# Atualizar código (quando houver updates)
cd /var/www/aetlicensesystem/LicencaTransporte
git pull  # se usando git
npm install
pm2 restart aet-sistema
```

## 🎯 Status Final

- ✅ **TSX configurado** - Sistema executa TypeScript diretamente
- ✅ **PM2 funcionando** - Processo gerenciado e logs organizados
- ✅ **Uploads corretos** - Arquivos salvos em `/var/www/aetlicensesystem/uploads/`
- ✅ **Banco configurado** - PostgreSQL com migrações aplicadas
- ✅ **Nginx opcional** - Proxy reverso para melhor performance
- ✅ **Logs organizados** - Monitoramento em `/var/log/aet/`

**Sistema pronto para produção!**