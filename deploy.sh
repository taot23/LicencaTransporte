#!/bin/bash

# Script de deployment para Servidor Debian - Sistema AET License Control
# Execute como: sudo bash deploy.sh

set -e

echo "🚀 Iniciando deployment do Sistema AET License Control..."

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute este script como root: sudo bash deploy.sh"
  exit 1
fi

# Atualizar sistema
echo "📦 Atualizando sistema..."
apt update && apt upgrade -y

# Instalar Node.js 20
echo "📦 Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Instalar PostgreSQL
echo "🗄️ Instalando PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Iniciar PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Instalar PM2
echo "⚙️ Instalando PM2..."
npm install -g pm2

# Instalar Nginx
echo "🌐 Instalando Nginx..."
apt install -y nginx

# Criar diretório do projeto
echo "📁 Criando diretório do projeto..."
mkdir -p /var/www/aetlicensesystem
mkdir -p /var/log/pm2

# Configurar PostgreSQL
echo "🗄️ Configurando PostgreSQL..."
sudo -u postgres psql << EOF
CREATE DATABASE aetlicensesystem;
CREATE USER aetuser WITH PASSWORD 'AET@License2025!';
GRANT ALL PRIVILEGES ON DATABASE aetlicensesystem TO aetuser;
ALTER USER aetuser CREATEDB;
\q
EOF

# Configurar firewall
echo "🔒 Configurando firewall..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow 5000
echo "y" | ufw enable

# Criar arquivo .env de exemplo
echo "📝 Criando arquivo .env de exemplo..."
cat > /var/www/aetlicensesystem/.env.example << EOF
DATABASE_URL=postgresql://aetuser:AET@License2025!@localhost:5432/aetlicensesystem
SESSION_SECRET=sua_chave_secreta_muito_longa_e_segura_aqui_mude_isso
NODE_ENV=production
Pcd ORT=5000
GOV_BR_CLIENT_ID=seu_client_id_gov_br
GOV_BR_CLIENT_SECRET=seu_client_secret_gov_br
EOF

# Configurar Nginx
echo "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/aet-license-system << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

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
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
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

    # Servir uploads
    location /uploads/ {
        alias /var/www/aetlicensesystem/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

# Ativar site Nginx
ln -sf /etc/nginx/sites-available/aet-license-system /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração Nginx
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx

# Definir permissões
chown -R www-data:www-data /var/www/aetlicensesystem
chmod -R 755 /var/www/aetlicensesystem

echo ""
echo "✅ Instalação base concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Copie os arquivos do projeto para: /var/www/aetlicensesystem/"
echo "2. Configure o arquivo .env (copie de .env.example)"
echo "3. Execute os comandos finais:"
echo ""
echo "   cd /var/www/aetlicensesystem"
echo "   npm install"
echo "   npm run build"
echo "   npm run db:push"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "🔑 Credenciais padrão:"
echo "   Admin: admin@sistema.com / 142536!@NVS"
echo "   Teste: transportador@teste.com / 123456"
echo ""
echo "📊 Database:"
echo "   Host: localhost"
echo "   Database: aetlicensesystem"
echo "   User: aetuser"
echo "   Password: AET@License2025!"
echo ""
echo "🌐 Acesse o sistema em: http://seu-ip-servidor"