# 🚀 Guia de Configuração para Produção - Sistema AET

## 📋 Pré-requisitos do Servidor

### 1. Dependências do Sistema
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Instalar PM2 (gerenciador de processos)
sudo npm install -g pm2

# Instalar Nginx (opcional - proxy reverso)
sudo apt install nginx -y
```

## 🗄️ Configuração do Banco de Dados

### 1. Configurar PostgreSQL
```bash
# Acessar PostgreSQL
sudo -u postgres psql

# Criar usuário e banco
CREATE USER aet_user WITH PASSWORD 'sua_senha_muito_segura_aqui';
CREATE DATABASE aet_production OWNER aet_user;
GRANT ALL PRIVILEGES ON DATABASE aet_production TO aet_user;

# Sair do PostgreSQL
\q
```

### 2. Configurar Acesso Remoto (se necessário)
```bash
# Editar configuração PostgreSQL
sudo nano /etc/postgresql/14/main/postgresql.conf

# Alterar linha:
listen_addresses = 'localhost'  # ou '*' para todas as interfaces

# Configurar autenticação
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Adicionar linha para o usuário aet_user:
local   aet_production  aet_user                        md5
host    aet_production  aet_user    127.0.0.1/32        md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

## 📁 Configuração de Diretórios

### 1. Criar Diretórios de Upload
```bash
# Criar diretório principal
sudo mkdir -p /home/servidorvoipnvs/uploads

# Criar subdiretórios
sudo mkdir -p /home/servidorvoipnvs/uploads/{licenses,vehicles,transporters,boletos,vehicle-set-types}

# Configurar permissões
sudo chown -R servidorvoipnvs:servidorvoipnvs /home/servidorvoipnvs/uploads
sudo chmod -R 755 /home/servidorvoipnvs/uploads

# Criar diretório para logs
sudo mkdir -p /var/log/aet
sudo chown servidorvoipnvs:servidorvoipnvs /var/log/aet
```

## ⚙️ Configuração do Projeto

### 1. Clonar e Configurar Código
```bash
# Navegar para diretório do projeto
cd /home/servidorvoipnvs/

# Clonar projeto (ou fazer upload)
# git clone seu-repositorio aet-sistema

# Entrar no diretório
cd aet-sistema

# Instalar dependências
npm install --production

# Fazer build do projeto
npm run build
```

### 2. Configurar Variáveis de Ambiente
```bash
# Criar arquivo de produção
cp .env.production.example .env.production

# Editar configurações
nano .env.production
```

**Conteúdo do `.env.production`:**
```bash
# Ambiente
NODE_ENV=production
PORT=5000

# Banco de Dados
DATABASE_URL=postgresql://aet_user:sua_senha_muito_segura_aqui@localhost:5432/aet_production

# Diretórios
UPLOAD_DIR=/home/servidorvoipnvs/uploads

# Segurança
SESSION_SECRET=gere_uma_chave_de_no_minimo_64_caracteres_muito_segura_aqui_para_sessoes

# Configurações PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=aet_production
PGUSER=aet_user
PGPASSWORD=sua_senha_muito_segura_aqui

# Segurança de Cookies
COOKIE_SECURE=false  # Mude para true se usar HTTPS

# Limites
MAX_FILE_SIZE=100
```

### 3. Executar Migrações do Banco
```bash
# Executar migrações
npm run db:push

# Verificar se tabelas foram criadas
psql -h localhost -U aet_user -d aet_production -c "\dt"
```

## 🔧 Configuração do PM2

### 1. Criar Arquivo de Configuração
```bash
nano ecosystem.config.cjs
```

**Conteúdo do `ecosystem.config.cjs`:**
```javascript
module.exports = {
  apps: [{
    name: 'aet-sistema',
    script: 'server/production-server.js',
    cwd: '/home/servidorvoipnvs/aet-sistema',
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
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'uploads', 'dist']
  }]
}
```

### 2. Iniciar com PM2
```bash
# Iniciar aplicação
pm2 start ecosystem.config.cjs

# Configurar para iniciar automaticamente no boot
pm2 startup
pm2 save

# Verificar status
pm2 status
pm2 logs aet-sistema

# Monitoramento
pm2 monit
```

## 🌐 Configuração Nginx (Opcional - Recomendado)

### 1. Configurar Nginx como Proxy Reverso
```bash
sudo nano /etc/nginx/sites-available/aet-sistema
```

**Conteúdo do arquivo Nginx:**
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Aumentar limite de upload
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
        
        # Timeout para uploads grandes
        proxy_connect_timeout       300;
        proxy_send_timeout          300;
        proxy_read_timeout          300;
        send_timeout                300;
    }

    # Servir arquivos estáticos diretamente
    location /uploads/ {
        alias /home/servidorvoipnvs/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. Ativar Site Nginx
```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/aet-sistema /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx

# Configurar para iniciar automaticamente
sudo systemctl enable nginx
```

## 🔒 Configuração de Firewall

```bash
# Configurar UFW
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # Se usar HTTPS
sudo ufw allow 5432/tcp  # PostgreSQL (apenas se acesso remoto)
sudo ufw --force enable

# Verificar status
sudo ufw status
```

## 📊 Monitoramento e Logs

### 1. Scripts de Monitoramento
```bash
# Criar script de backup
nano ~/backup-aet.sh
```

**Conteúdo do script de backup:**
```bash
#!/bin/bash
BACKUP_DIR="/home/servidorvoipnvs/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do banco
pg_dump -h localhost -U aet_user aet_production > "$BACKUP_DIR/aet_db_$DATE.sql"

# Backup dos uploads
tar -czf "$BACKUP_DIR/aet_uploads_$DATE.tar.gz" /home/servidorvoipnvs/uploads/

# Manter apenas 7 dias de backup
find $BACKUP_DIR -name "aet_*" -mtime +7 -delete

echo "Backup concluído: $DATE"
```

### 2. Configurar Cron para Backup Automático
```bash
# Editar crontab
crontab -e

# Adicionar linha para backup diário às 2:00
0 2 * * * /home/servidorvoipnvs/backup-aet.sh >> /var/log/aet/backup.log 2>&1
```

## ✅ Verificação Final

### 1. Checklist de Produção
```bash
# Verificar serviços
sudo systemctl status postgresql
sudo systemctl status nginx
pm2 status

# Testar conectividade
curl -I http://localhost:5000/api/user

# Verificar logs
pm2 logs aet-sistema --lines 50
tail -f /var/log/aet/error.log

# Testar upload de arquivos
ls -la /home/servidorvoipnvs/uploads/
```

### 2. URLs de Acesso
- **Aplicação**: `http://seu-dominio.com` ou `http://IP-DO-SERVIDOR`
- **API**: `http://seu-dominio.com/api/`
- **Uploads**: `http://seu-dominio.com/uploads/`

## 🚨 Comandos Úteis de Manutenção

```bash
# Reiniciar aplicação
pm2 restart aet-sistema

# Ver logs em tempo real
pm2 logs aet-sistema --lines 100

# Atualizar aplicação
cd /home/servidorvoipnvs/aet-sistema
git pull
npm install --production
npm run build
pm2 restart aet-sistema

# Verificar uso de recursos
pm2 monit
htop

# Backup manual
pg_dump -h localhost -U aet_user aet_production > backup_$(date +%Y%m%d).sql
```

## 🆘 Solução de Problemas

### Problemas Comuns:

1. **Erro de conexão com banco**: Verificar credenciais em `.env.production`
2. **Erro de permissão de arquivos**: `sudo chown -R servidorvoipnvs:servidorvoipnvs /home/servidorvoipnvs/uploads`
3. **Aplicação não inicia**: Verificar logs com `pm2 logs aet-sistema`
4. **Upload falha**: Verificar limite `client_max_body_size` no Nginx

### Logs Importantes:
- PM2: `pm2 logs aet-sistema`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
- PostgreSQL: `sudo tail -f /var/log/postgresql/postgresql-14-main.log`
- Sistema: `/var/log/aet/`

---

**🎯 Resultado Final**: Sistema AET funcionando em produção com alta disponibilidade, backups automáticos e monitoramento completo.