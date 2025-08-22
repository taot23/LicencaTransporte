# 🔧 Correção de Problemas - Servidor Google

## ⚠️ Vulnerabilidades NPM Encontradas

### Status Atual:
- **682 packages auditados**
- **13 vulnerabilidades** encontradas:
  - 3 baixas (low)
  - 8 moderadas (moderate) 
  - 1 alta (high)
  - 1 crítica (critical)

## 🛠️ Soluções Recomendadas

### 1. Corrigir Vulnerabilidades com Segurança
```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Primeiro, fazer backup do package-lock.json atual
cp package-lock.json package-lock.json.backup

# Tentar correção automática sem quebrar dependências
npm audit fix

# Se não resolver tudo, verificar detalhes
npm audit

# Se necessário, forçar correções (CUIDADO: pode quebrar dependências)
# npm audit fix --force
```

### 2. Verificar Dependências Específicas Problemáticas
```bash
# Ver detalhes das vulnerabilidades
npm audit --json | jq '.vulnerabilities'

# Atualizar dependências específicas se necessário
npm update

# Reinstalar node_modules limpo
rm -rf node_modules package-lock.json
npm install --production
```

### 3. Configuração Específica para Produção

#### A. Criar arquivo .env.production correto
```bash
cp .env.production.example .env.production
nano .env.production
```

**Conteúdo para .env.production:**
```env
NODE_ENV=production
PORT=5000

# Banco de Dados
DATABASE_URL=postgresql://aet_user:SUA_SENHA_SEGURA@localhost:5432/aet_production

# Diretório de uploads - ESPECÍFICO PARA SEU SERVIDOR
UPLOAD_DIR=/var/www/aetlicensesystem/uploads

# Segurança
SESSION_SECRET=GERE_UMA_CHAVE_DE_64_CARACTERES_MUITO_SEGURA_AQUI

# PostgreSQL específico
PGHOST=localhost
PGPORT=5432
PGDATABASE=aet_production
PGUSER=aet_user
PGPASSWORD=SUA_SENHA_SEGURA

# Limites
MAX_FILE_SIZE=100
COOKIE_SECURE=false
```

#### B. Configurar diretórios corretos
```bash
# Criar diretório de uploads no local correto
sudo mkdir -p /var/www/aetlicensesystem/uploads/{licenses,vehicles,transporters,boletos,vehicle-set-types}

# Configurar permissões
sudo chown -R servidorvoipnvs:www-data /var/www/aetlicensesystem/uploads
sudo chmod -R 755 /var/www/aetlicensesystem/uploads
```

### 4. Build e Deploy

#### A. Build do projeto
```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Fazer build para produção
npm run build

# Verificar se build foi criado
ls -la dist/
```

#### B. Configurar banco de dados
```bash
# Executar migrações
npm run db:push

# Se der erro, forçar
npm run db:push --force
```

#### C. Iniciar com PM2
```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Criar configuração PM2 específica
nano ecosystem.config.cjs
```

**ecosystem.config.cjs para seu servidor:**
```javascript
module.exports = {
  apps: [{
    name: 'aet-sistema',
    script: 'server/production-server.js',
    cwd: '/var/www/aetlicensesystem/LicencaTransporte',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_file: '.env.production',
    log_file: '/var/log/aet/combined.log',
    out_file: '/var/log/aet/out.log',
    error_file: '/var/log/aet/error.log',
    time: true,
    max_memory_restart: '1G'
  }]
}
```

```bash
# Criar diretório de logs
sudo mkdir -p /var/log/aet
sudo chown servidorvoipnvs:servidorvoipnvs /var/log/aet

# Iniciar aplicação
pm2 start ecosystem.config.cjs

# Configurar para iniciar no boot
pm2 startup
pm2 save
```

### 5. Nginx (Recomendado)

#### A. Instalar e configurar Nginx
```bash
sudo apt install nginx -y

# Criar configuração para o site
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
        
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }

    location /uploads/ {
        alias /var/www/aetlicensesystem/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/aet-sistema /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 6. Firewall e Segurança
```bash
# Configurar firewall
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## ✅ Verificação Final

### Comandos para testar
```bash
# Verificar status dos serviços
sudo systemctl status nginx
sudo systemctl status postgresql
pm2 status

# Testar aplicação
curl -I http://localhost:5000
curl -I http://SEU_IP

# Verificar logs
pm2 logs aet-sistema
tail -f /var/log/aet/error.log
```

### Estrutura final esperada
```
/var/www/aetlicensesystem/
├── LicencaTransporte/          # Código da aplicação
│   ├── dist/                   # Build de produção
│   ├── server/                 # Backend
│   ├── client/                 # Frontend
│   ├── .env.production         # Configurações
│   └── ecosystem.config.cjs    # PM2
└── uploads/                    # Arquivos uploadados
    ├── licenses/               # Licenças
    ├── vehicles/               # Veículos
    ├── transporters/           # Transportadoras
    ├── boletos/                # Boletos
    └── vehicle-set-types/      # Tipos de conjunto
```

## 🆘 Se algo der errado

### Resetar node_modules
```bash
cd /var/www/aetlicensesystem/LicencaTransporte
rm -rf node_modules package-lock.json
npm install --production --no-audit
```

### Verificar permissões
```bash
sudo chown -R servidorvoipnvs:www-data /var/www/aetlicensesystem/
sudo chmod -R 755 /var/www/aetlicensesystem/
```

### Logs importantes
- PM2: `pm2 logs aet-sistema`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
- Sistema: `tail -f /var/log/aet/error.log`