# Guia de Deployment - Sistema AET License Control

## Pré-requisitos do Servidor Debian

### 1. Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Instalar PostgreSQL
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Configurar PostgreSQL
```bash
sudo -u postgres psql

-- No PostgreSQL:
CREATE DATABASE aetlicensesystem;
CREATE USER aetuser WITH PASSWORD 'senha_segura_aqui';
GRANT ALL PRIVILEGES ON DATABASE aetlicensesystem TO aetuser;
ALTER USER aetuser CREATEDB;
\q
```

### 4. Instalar PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### 5. Instalar Nginx (opcional, para proxy reverso)
```bash
sudo apt install nginx
```

## Configuração da Aplicação

### 1. Clonar/Transferir arquivos
Transfira todos os arquivos do projeto para o servidor (exceto node_modules).

### 2. Instalar dependências
```bash
cd /caminho/para/projeto
npm install
```

### 3. Configurar variáveis de ambiente
Crie um arquivo `.env`:
```bash
DATABASE_URL=postgresql://aetuser:senha_segura_aqui@localhost:5432/aetlicensesystem
SESSION_SECRET=sua_chave_secreta_muito_longa_aqui
NODE_ENV=production
PORT=5000
```

### 4. Executar migrações do banco
```bash
npm run db:push
```

### 5. Build da aplicação
```bash
npm run build
```

## Iniciar a Aplicação

### 1. Configurar PM2
Crie o arquivo `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'aet-license-system',
    script: 'npm',
    args: 'start',
    cwd: '/caminho/para/projeto',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/pm2/aet-license-system-error.log',
    out_file: '/var/log/pm2/aet-license-system-out.log',
    log_file: '/var/log/pm2/aet-license-system.log'
  }]
};
```

### 2. Iniciar com PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Configurar Nginx (Proxy Reverso)

Crie `/etc/nginx/sites-available/aet-license-system`:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

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

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar o site:
```bash
sudo ln -s /etc/nginx/sites-available/aet-license-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL com Certbot (Opcional)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

## Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 5000
sudo ufw enable
```

## Logs e Monitoramento

```bash
# Ver logs da aplicação
pm2 logs aet-license-system

# Monitorar status
pm2 status

# Restart da aplicação
pm2 restart aet-license-system
```

## Credenciais Padrão

- **Admin:** admin@sistema.com / senha: 142536!@NVS
- **Teste:** transportador@teste.com / senha: 123456

## Comandos Úteis

```bash
# Parar aplicação
pm2 stop aet-license-system

# Reiniciar aplicação
pm2 restart aet-license-system

# Ver status
pm2 status

# Ver logs
pm2 logs

# Backup do banco
pg_dump -U aetuser -h localhost aetlicensesystem > backup_$(date +%Y%m%d).sql
```