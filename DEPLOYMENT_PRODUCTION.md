# Guia de Deployment - Sistema AET com Validação Inteligente

## Versão: 17/06/2025 - Sistema de Validação Completo

Esta versão inclui o sistema de validação inteligente completo para todos os estados brasileiros + órgãos federais (DNIT, ANTT, PRF).

## Pré-requisitos no Servidor

### 1. Dependências do Sistema
```bash
# Node.js 18+ e npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 para gerenciamento de processos
sudo npm install -g pm2

# PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
```

### 2. Configuração do Banco de Dados
```bash
# Criar usuário e banco
sudo -u postgres createuser --interactive
sudo -u postgres createdb aet_production

# Configurar senha do usuário
sudo -u postgres psql
ALTER USER seu_usuario PASSWORD 'sua_senha_segura';
\q
```

## Preparação dos Arquivos

### 1. Criar arquivo de produção .env
```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://usuario:senha@localhost:5432/aet_production
UPLOAD_DIR=/var/uploads
PORT=5000

# Adicione suas outras variáveis necessárias
# SESSION_SECRET=sua_chave_secreta_muito_longa
```

### 2. Script de build e deploy
```bash
#!/bin/bash
# deploy.sh

echo "🚀 Iniciando deployment do Sistema AET..."

# Parar aplicação atual se estiver rodando
pm2 stop aet-system 2>/dev/null || true

# Fazer backup do banco (opcional)
echo "📦 Fazendo backup do banco..."
pg_dump aet_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Instalar dependências
echo "📥 Instalando dependências..."
npm ci --production

# Build da aplicação (se necessário)
echo "🔨 Fazendo build..."
npm run build 2>/dev/null || echo "Build não necessário"

# Executar migrações do banco
echo "🗃️ Aplicando migrações..."
npm run db:push

# Criar diretório de uploads
echo "📁 Configurando uploads..."
sudo mkdir -p /var/uploads/vehicles /var/uploads/transporter
sudo chown -R $USER:$USER /var/uploads
chmod 755 /var/uploads

# Iniciar aplicação
echo "▶️ Iniciando aplicação..."
pm2 start ecosystem.config.js --env production

# Salvar configuração do PM2
pm2 save

echo "✅ Deployment concluído!"
echo "📊 Status: pm2 status"
echo "📋 Logs: pm2 logs aet-system"
```

### 3. Configuração PM2 atualizada
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'aet-system',
    script: 'server/production-server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    // Configurações de monitoramento
    max_memory_restart: '1G',
    error_file: '/var/log/pm2/aet-system-error.log',
    out_file: '/var/log/pm2/aet-system-out.log',
    log_file: '/var/log/pm2/aet-system.log',
    time: true,
    
    // Configurações de restart
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    
    // Configurações de deployment
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads']
  }]
};
```

## Passos de Deployment

### 1. No servidor de produção:
```bash
# Clonar ou atualizar código
git clone seu-repositorio aet-system
cd aet-system

# Ou se já existe:
git pull origin main

# Tornar script executável
chmod +x deploy.sh

# Executar deployment
./deploy.sh
```

### 2. Verificar deployment:
```bash
# Status da aplicação
pm2 status

# Logs em tempo real
pm2 logs aet-system --lines 50

# Verificar se está respondendo
curl http://localhost:5000/api/health
```

### 3. Configurar proxy reverso (Nginx):
```nginx
# /etc/nginx/sites-available/aet-system
server {
    listen 80;
    server_name seu-dominio.com;
    
    # Uploads grandes para arquivos
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
        
        # Timeout para validações longas
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket para tempo real
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header Origin "";
    }
    
    # Servir uploads diretamente
    location /uploads/ {
        alias /var/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/aet-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Funcionalidades da Nova Versão

### Sistema de Validação Inteligente
- ✅ Validação para todos os 27 estados + DNIT, ANTT, PRF
- ✅ Dados reais da tabela `licencas_emitidas`
- ✅ Bloqueio automático de estados com licenças >60 dias
- ✅ Botão "Selecionar Todos" com validação individual
- ✅ Prevenção de condições de corrida
- ✅ Interface original mantida

### Endpoint de Validação
```
POST /api/validacao-critica
{
  "estado": "MG",
  "placas": ["ABC1234", "DEF5678"]
}
```

## Monitoramento

### 1. Scripts de monitoramento:
```bash
#!/bin/bash
# monitor.sh - Verificar saúde da aplicação

echo "🔍 Status do Sistema AET"
echo "========================"

# PM2 Status
echo "📊 Status PM2:"
pm2 status aet-system

# Uso de memória
echo -e "\n💾 Uso de Memória:"
ps aux | grep "aet-system" | grep -v grep

# Verificar conectividade
echo -e "\n🌐 Teste de Conectividade:"
curl -s http://localhost:5000/api/health || echo "❌ Aplicação não responde"

# Espaço em disco para uploads
echo -e "\n💿 Espaço em Disco (/var/uploads):"
df -h /var/uploads

# Últimas 10 linhas de log
echo -e "\n📋 Últimos logs:"
pm2 logs aet-system --lines 10 --nostream
```

### 2. Backup automático:
```bash
#!/bin/bash
# backup-daily.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="/var/backups/aet-system"

mkdir -p $BACKUP_DIR

# Backup banco de dados
pg_dump aet_production > $BACKUP_DIR/db_backup_$DATE.sql

# Backup uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz /var/uploads

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup concluído: $DATE"
```

## Solução de Problemas

### Problemas Comuns:
1. **Aplicação não inicia**: Verificar logs com `pm2 logs aet-system`
2. **Erro de banco**: Verificar DATABASE_URL e conectividade
3. **Uploads não funcionam**: Verificar permissões de `/var/uploads`
4. **Validação lenta**: Normal para primeira execução (cache sendo construído)

### Comandos úteis:
```bash
# Reiniciar aplicação
pm2 restart aet-system

# Ver logs em tempo real
pm2 logs aet-system

# Reinicializar PM2 (se necessário)
pm2 kill
pm2 resurrect

# Verificar portas em uso
netstat -tlnp | grep 5000
```

## Contato e Suporte

Para problemas específicos da validação inteligente, verificar logs com:
```bash
pm2 logs aet-system | grep "VALIDAÇÃO CRÍTICA"
```

A aplicação está configurada para produção com todas as otimizações e validações necessárias.