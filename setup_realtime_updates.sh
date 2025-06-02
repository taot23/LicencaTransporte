#!/bin/bash

# Script para configurar atualizações em tempo real no servidor AET License System
# Execute como: bash setup_realtime_updates.sh

PROJECT_DIR="/var/www/aetlicensesystem/LicencaTransporte"
USER="servidorvoipnvs"

echo "=== Configurando Atualizações em Tempo Real ==="
echo "Projeto: $PROJECT_DIR"
echo "Data: $(date)"
echo

# Verificar se o diretório existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Erro: Diretório do projeto não encontrado!"
    exit 1
fi

echo "✅ Diretório do projeto encontrado"

# Parar aplicação antes das alterações
echo "🛑 Parando aplicação..."
sudo -u $USER pm2 stop aet-license-system 2>/dev/null || true

# Verificar se os arquivos WebSocket existem
echo "🔍 Verificando arquivos do sistema de tempo real..."

WEBSOCKET_FILES=(
    "client/src/hooks/use-websocket.ts"
    "server/routes.ts"
)

for file in "${WEBSOCKET_FILES[@]}"; do
    if [ -f "$PROJECT_DIR/$file" ]; then
        echo "✅ $file encontrado"
    else
        echo "❌ $file não encontrado"
    fi
done

# Criar script de teste WebSocket
echo "📝 Criando script de teste WebSocket..."
cat > "$PROJECT_DIR/test_websocket.js" << 'EOF'
const WebSocket = require('ws');

console.log('Testando conexão WebSocket...');

const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', function open() {
    console.log('✅ WebSocket conectado com sucesso!');
    
    // Testar envio de mensagem
    ws.send(JSON.stringify({
        type: 'TEST',
        message: 'Teste de conexão'
    }));
});

ws.on('message', function message(data) {
    console.log('📨 Mensagem recebida:', data.toString());
    ws.close();
});

ws.on('error', function error(err) {
    console.log('❌ Erro WebSocket:', err.message);
});

ws.on('close', function close() {
    console.log('🔌 Conexão WebSocket fechada');
    process.exit(0);
});

setTimeout(() => {
    console.log('⏰ Timeout - fechando conexão');
    ws.close();
}, 5000);
EOF

# Instalar dependências necessárias
echo "📦 Instalando dependências WebSocket..."
cd "$PROJECT_DIR"
sudo -u $USER npm install ws 2>/dev/null || true

# Criar arquivo de configuração para PM2 com variáveis de ambiente
echo "⚙️ Configurando PM2 para WebSocket..."
cat > "$PROJECT_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'aet-license-system',
    script: 'server/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader tsx',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      WEBSOCKET_ENABLED: 'true'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Criar diretório de logs
sudo mkdir -p "$PROJECT_DIR/logs"
sudo chown -R $USER:www-data "$PROJECT_DIR/logs"
sudo chmod -R 755 "$PROJECT_DIR/logs"

# Corrigir permissões
echo "🔐 Corrigindo permissões..."
sudo chown -R $USER:www-data "$PROJECT_DIR"
sudo chmod -R 755 "$PROJECT_DIR"
sudo chmod -R 775 "$PROJECT_DIR/uploads" 2>/dev/null || true
sudo chmod -R 775 "$PROJECT_DIR/node_modules" 2>/dev/null || true

# Reiniciar aplicação
echo "🚀 Reiniciando aplicação..."
sudo -u $USER pm2 delete aet-license-system 2>/dev/null || true
sudo -u $USER pm2 start "$PROJECT_DIR/ecosystem.config.js"

# Aguardar inicialização
echo "⏳ Aguardando inicialização (10 segundos)..."
sleep 10

# Testar WebSocket
echo "🧪 Testando conexão WebSocket..."
cd "$PROJECT_DIR"
timeout 10 sudo -u $USER node test_websocket.js || echo "⚠️ Teste WebSocket falhou ou timeout"

# Verificar status
echo "📊 Status da aplicação:"
sudo -u $USER pm2 status

# Verificar logs recentes
echo "📋 Logs recentes:"
sudo -u $USER pm2 logs aet-license-system --lines 10 --nostream

# Verificar se a porta está aberta
echo "🌐 Verificando porta 5000:"
if netstat -tuln | grep -q ":5000 "; then
    echo "✅ Porta 5000 está aberta"
else
    echo "❌ Porta 5000 não está aberta"
fi

# Criar script de monitoramento
echo "📈 Criando script de monitoramento..."
cat > "$PROJECT_DIR/monitor_realtime.sh" << 'EOF'
#!/bin/bash
echo "=== Monitor de Atualizações em Tempo Real ==="
echo "Data: $(date)"
echo

# Verificar WebSocket nos logs
echo "🔍 Verificando atividade WebSocket (últimas 20 linhas):"
pm2 logs aet-license-system --lines 20 --nostream | grep -i "websocket\|conectado\|mensagem"

echo
echo "📊 Status PM2:"
pm2 status

echo
echo "🌐 Conexões ativas na porta 5000:"
netstat -an | grep ":5000"

echo
echo "💾 Uso de memória:"
pm2 show aet-license-system | grep -E "memory|cpu"
EOF

sudo chmod +x "$PROJECT_DIR/monitor_realtime.sh"

# Limpar arquivo de teste
rm -f "$PROJECT_DIR/test_websocket.js"

echo
echo "✅ Configuração de tempo real concluída!"
echo
echo "📋 Comandos úteis:"
echo "  Monitorar: bash $PROJECT_DIR/monitor_realtime.sh"
echo "  Ver logs: pm2 logs aet-license-system"
echo "  Reiniciar: pm2 restart aet-license-system"
echo "  Status: pm2 status"
echo
echo "🌐 Para testar:"
echo "1. Acesse http://seu-servidor:5000"
echo "2. Abra em duas abas"
echo "3. Faça uma alteração em uma aba"
echo "4. Verifique se a outra aba atualizou automaticamente"
echo
echo "🔧 Se não funcionar:"
echo "1. Verifique o firewall: sudo ufw allow 5000"
echo "2. Verifique variáveis de ambiente"
echo "3. Execute: bash $PROJECT_DIR/monitor_realtime.sh"