# 🔧 Configuração de Uploads - Servidor Google

## 📂 Configuração Atual vs Necessária

### Problema Identificado:
- Sistema local serve de `/tmp/uploads` 
- Servidor Google precisa servir de `/var/www/aetlicensesystem/uploads`
- URL retorna 404 porque arquivos não estão no local correto no servidor

## ✅ Passos para Resolver no Servidor Google

### 1. Verificar Estrutura de Diretórios
```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Verificar se diretórios existem
ls -la /var/www/aetlicensesystem/uploads/
ls -la /var/www/aetlicensesystem/uploads/licenses/

# Se não existirem, criar:
sudo mkdir -p /var/www/aetlicensesystem/uploads/{licenses,vehicles,transporters,boletos,vehicle-set-types}
sudo chown -R servidorvoipnvs:www-data /var/www/aetlicensesystem/uploads
sudo chmod -R 755 /var/www/aetlicensesystem/uploads
```

### 2. Configurar .env.production no Servidor
```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Editar arquivo de produção
nano .env.production
```

**Conteúdo essencial do .env.production:**
```env
NODE_ENV=production
PORT=5000

# CRÍTICO: Diretório correto para uploads
UPLOAD_DIR=/var/www/aetlicensesystem/uploads

# Banco de dados
DATABASE_URL=postgresql://aet_user:SUA_SENHA@localhost:5432/aet_production

# Segurança
SESSION_SECRET=SUA_CHAVE_SEGURA_64_CARACTERES

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=aet_production
PGUSER=aet_user
PGPASSWORD=SUA_SENHA
```

### 3. Instalar TSX e Dependências
```bash
# Instalar TSX globalmente
sudo npm install -g tsx

# Instalar dependências do projeto
npm install
```

### 4. Configurar Banco de Dados
```bash
# Executar migrações
npm run db:push --force

# Verificar se funciona
psql -h localhost -U aet_user -d aet_production -c "SELECT COUNT(*) FROM users;"
```

### 5. Configurar PM2 com ecosystem.config.cjs
```javascript
module.exports = {
  apps: [{
    name: 'aet-sistema',
    script: 'server/index.ts',
    interpreter: 'tsx',
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

### 6. Criar Diretório de Logs e Iniciar
```bash
# Criar diretório de logs
sudo mkdir -p /var/log/aet
sudo chown servidorvoipnvs:servidorvoipnvs /var/log/aet

# Parar qualquer processo anterior
pm2 stop aet-sistema || true
pm2 delete aet-sistema || true

# Iniciar aplicação
pm2 start ecosystem.config.cjs

# Configurar para boot automático
pm2 startup
pm2 save
```

### 7. Verificar Se Está Funcionando
```bash
# Status do PM2
pm2 status

# Logs da aplicação
pm2 logs aet-sistema --lines 20

# Testar aplicação
curl -I http://localhost:5000/api/user

# Verificar se uploads funcionam
ls -la /var/www/aetlicensesystem/uploads/licenses/
```

## 🌐 Configurar Nginx (Recomendado)

### 1. Instalar Nginx
```bash
sudo apt install nginx -y
```

### 2. Configurar Site
```bash
sudo nano /etc/nginx/sites-available/aet-sistema
```

**Configuração Nginx:**
```nginx
server {
    listen 80;
    server_name SEU_IP_OU_DOMINIO;

    # Aumentar limite de upload
    client_max_body_size 100M;

    # Proxy para aplicação Node.js
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
        
        # Timeouts para uploads grandes
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }

    # CRÍTICO: Servir uploads diretamente pelo Nginx
    location /uploads/ {
        alias /var/www/aetlicensesystem/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        
        # Log de debugging
        access_log /var/log/nginx/uploads.log;
        error_log /var/log/nginx/uploads_error.log;
    }
}
```

### 3. Ativar Site Nginx
```bash
# Ativar configuração
sudo ln -s /etc/nginx/sites-available/aet-sistema /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 🔥 Firewall
```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## ✅ Teste Final

### Comandos de Verificação
```bash
# 1. Verificar serviços
sudo systemctl status nginx
pm2 status

# 2. Testar aplicação
curl -I http://localhost:5000
curl -I http://SEU_IP_SERVIDOR

# 3. Testar uploads (criar arquivo de teste)
echo "teste" > /var/www/aetlicensesystem/uploads/teste.txt
curl -I http://SEU_IP_SERVIDOR/uploads/teste.txt

# 4. Verificar logs se houver problemas
pm2 logs aet-sistema
sudo tail -f /var/log/nginx/uploads_error.log
```

## 📂 Estrutura Final Esperada

```
/var/www/aetlicensesystem/
├── LicencaTransporte/              # Aplicação
│   ├── server/
│   ├── .env.production            # Configurações
│   └── ecosystem.config.cjs
└── uploads/                        # Arquivos públicos
    └── licenses/
        └── benda-cia-ltda/
            └── sp/
                └── aet-2025-1570/
                    └── arquivo.pdf  # ← Arquivo criado
```

## 🎯 URLs de Acesso

Após configuração:
- **Sistema**: `http://SEU_IP_SERVIDOR`
- **API**: `http://SEU_IP_SERVIDOR/api/`
- **Uploads**: `http://SEU_IP_SERVIDOR/uploads/licenses/...`
- **Arquivo específico**: `http://SEU_IP_SERVIDOR/uploads/licenses/benda-cia-ltda/sp/aet-2025-1570/arquivo.pdf`