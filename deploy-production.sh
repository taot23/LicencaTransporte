#!/bin/bash

# Script de deployment para produção - Sistema AET
# Versão: 17/06/2025 - Sistema de Validação Inteligente Completo

set -e  # Parar em caso de erro

echo "🚀 DEPLOYMENT SISTEMA AET - VALIDAÇÃO INTELIGENTE"
echo "================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para logs coloridos
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se está rodando como root
if [[ $EUID -eq 0 ]]; then
   log_error "Este script não deve ser executado como root"
   exit 1
fi

# Verificar dependências
check_dependencies() {
    log_info "Verificando dependências..."
    
    command -v node >/dev/null 2>&1 || { log_error "Node.js não encontrado. Instale Node.js 18+"; exit 1; }
    command -v npm >/dev/null 2>&1 || { log_error "npm não encontrado"; exit 1; }
    command -v pm2 >/dev/null 2>&1 || { log_error "PM2 não encontrado. Execute: npm install -g pm2"; exit 1; }
    command -v psql >/dev/null 2>&1 || { log_error "PostgreSQL não encontrado"; exit 1; }
    
    log_info "✅ Todas as dependências encontradas"
}

# Backup do banco de dados
backup_database() {
    log_info "Fazendo backup do banco de dados..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_warn "DATABASE_URL não definida, pulando backup"
        return
    fi
    
    BACKUP_DIR="./backups"
    mkdir -p $BACKUP_DIR
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/aet_backup_$TIMESTAMP.sql"
    
    # Extrair detalhes da DATABASE_URL
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    if [ ! -z "$DB_NAME" ]; then
        pg_dump $DATABASE_URL > $BACKUP_FILE 2>/dev/null || {
            log_warn "Não foi possível fazer backup automático"
        }
        
        if [ -f "$BACKUP_FILE" ]; then
            log_info "✅ Backup salvo em: $BACKUP_FILE"
        fi
    fi
}

# Parar aplicação atual
stop_current_app() {
    log_info "Parando aplicação atual..."
    
    pm2 stop aet-system 2>/dev/null || log_warn "Aplicação não estava rodando"
    pm2 delete aet-system 2>/dev/null || true
    
    log_info "✅ Aplicação parada"
}

# Instalar dependências
install_dependencies() {
    log_info "Instalando dependências..."
    
    # Limpar cache npm
    npm cache clean --force
    
    # Instalar dependências de produção
    npm ci --only=production
    
    log_info "✅ Dependências instaladas"
}

# Aplicar migrações
apply_migrations() {
    log_info "Aplicando migrações do banco..."
    
    if [ -f "package.json" ] && grep -q "db:push" package.json; then
        npm run db:push || {
            log_error "Falha ao aplicar migrações"
            exit 1
        }
        log_info "✅ Migrações aplicadas"
    else
        log_warn "Script de migração não encontrado"
    fi
}

# Configurar diretórios
setup_directories() {
    log_info "Configurando diretórios..."
    
    # Diretório de uploads
    UPLOAD_DIR="${UPLOAD_DIR:-/var/uploads}"
    
    if [ ! -d "$UPLOAD_DIR" ]; then
        sudo mkdir -p "$UPLOAD_DIR/vehicles" "$UPLOAD_DIR/transporter" || {
            log_warn "Não foi possível criar $UPLOAD_DIR, usando ./uploads"
            UPLOAD_DIR="./uploads"
            mkdir -p "$UPLOAD_DIR/vehicles" "$UPLOAD_DIR/transporter"
        }
    fi
    
    # Configurar permissões
    if [[ "$UPLOAD_DIR" == "/var/uploads" ]]; then
        sudo chown -R $USER:$USER $UPLOAD_DIR 2>/dev/null || true
    fi
    chmod -R 755 $UPLOAD_DIR 2>/dev/null || true
    
    # Diretório de logs
    sudo mkdir -p /var/log/pm2 2>/dev/null || {
        log_warn "Não foi possível criar /var/log/pm2"
    }
    
    log_info "✅ Diretórios configurados (uploads: $UPLOAD_DIR)"
}

# Verificar arquivo de produção
check_production_server() {
    log_info "Verificando servidor de produção..."
    
    if [ ! -f "server/production-server.js" ]; then
        log_error "Arquivo server/production-server.js não encontrado"
        exit 1
    fi
    
    if [ ! -f "ecosystem.config.js" ]; then
        log_error "Arquivo ecosystem.config.js não encontrado"
        exit 1
    fi
    
    log_info "✅ Arquivos de produção encontrados"
}

# Iniciar aplicação
start_application() {
    log_info "Iniciando aplicação..."
    
    # Definir ambiente
    export NODE_ENV=production
    
    # Iniciar com PM2
    pm2 start ecosystem.config.js --env production || {
        log_error "Falha ao iniciar aplicação"
        exit 1
    }
    
    # Salvar configuração PM2
    pm2 save
    
    # Configurar inicialização automática
    pm2 startup || true
    
    log_info "✅ Aplicação iniciada"
}

# Verificar saúde da aplicação
health_check() {
    log_info "Verificando saúde da aplicação..."
    
    sleep 5  # Aguardar inicialização
    
    # Verificar se processo está rodando
    if ! pm2 list | grep -q "aet-system.*online"; then
        log_error "Aplicação não está online"
        pm2 logs aet-system --lines 20
        exit 1
    fi
    
    # Verificar conectividade HTTP
    PORT=${PORT:-5000}
    for i in {1..10}; do
        if curl -s "http://localhost:$PORT/api/user" >/dev/null 2>&1; then
            log_info "✅ Aplicação respondendo na porta $PORT"
            break
        fi
        
        if [ $i -eq 10 ]; then
            log_error "Aplicação não responde após 10 tentativas"
            pm2 logs aet-system --lines 20
            exit 1
        fi
        
        log_info "Tentativa $i/10 - aguardando aplicação..."
        sleep 3
    done
}

# Mostrar status final
show_status() {
    log_info "Status final do deployment:"
    echo ""
    pm2 status
    echo ""
    
    log_info "Comandos úteis:"
    echo "  📊 Status: pm2 status"
    echo "  📋 Logs: pm2 logs aet-system"
    echo "  🔄 Restart: pm2 restart aet-system"
    echo "  🛑 Stop: pm2 stop aet-system"
    echo ""
    
    log_info "🎉 DEPLOYMENT CONCLUÍDO COM SUCESSO!"
    echo ""
    echo "Sistema AET com Validação Inteligente está rodando:"
    echo "- Validação para todos os 27 estados + DNIT/ANTT/PRF"
    echo "- Bloqueio automático de estados com licenças >60 dias"
    echo "- Interface original mantida com validação em tempo real"
    echo "- Dados reais da tabela licencas_emitidas"
}

# Função principal
main() {
    log_info "Iniciando deployment em: $(pwd)"
    
    check_dependencies
    backup_database
    stop_current_app
    install_dependencies
    apply_migrations
    setup_directories
    check_production_server
    start_application
    health_check
    show_status
}

# Executar função principal
main "$@"