// Script para corrigir problemas de WebSocket em tempo real no servidor
const fs = require('fs');
const path = require('path');

// Função para verificar e corrigir o arquivo routes.ts
function fixWebSocketRoutes() {
  const routesPath = path.join(__dirname, 'server', 'routes.ts');
  
  if (!fs.existsSync(routesPath)) {
    console.error('Arquivo routes.ts não encontrado');
    return;
  }

  let content = fs.readFileSync(routesPath, 'utf8');
  
  // Verificar se há problemas na configuração do WebSocket
  const fixes = [
    {
      search: /const wss = new WebSocketServer\(\{ server: httpServer, path: '\/ws' \}\);/,
      replace: `const wss = new WebSocketServer({ 
        server: httpServer, 
        path: '/ws',
        perMessageDeflate: false,
        maxPayload: 16 * 1024
      });`
    },
    {
      search: /wsClients\.forEach\(client => \{[\s\S]*?\}\);/,
      replace: `wsClients.forEach(client => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        console.log(\`✓ Mensagem enviada para cliente: \${message.type}\`);
      } else {
        console.log('Cliente WebSocket não está aberto, removendo da lista');
        wsClients.delete(client);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem WebSocket:', error);
      wsClients.delete(client);
    }
  });`
    }
  ];

  let modified = false;
  fixes.forEach(fix => {
    if (fix.search.test(content)) {
      content = content.replace(fix.search, fix.replace);
      modified = true;
      console.log('✓ Aplicada correção WebSocket');
    }
  });

  // Adicionar logs mais detalhados para debugging
  if (!content.includes('console.log(`Enviando STATUS_UPDATE para licença')) {
    content = content.replace(
      /broadcastMessage\(\{\s*type: 'STATUS_UPDATE',[\s\S]*?\}\);/g,
      `broadcastMessage({
        type: 'STATUS_UPDATE',
        data: {
          licenseId: parseInt(licenseId),
          state: state,
          status: status,
          updatedAt: new Date().toISOString(),
          license: updatedLicense
        }
      });
      console.log(\`Enviando STATUS_UPDATE para licença \${licenseId}, estado \${state} => \${status}\`);`
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(routesPath, content);
    console.log('✅ Arquivo routes.ts atualizado com correções WebSocket');
  } else {
    console.log('ℹ️ Nenhuma correção necessária em routes.ts');
  }
}

// Função para verificar e corrigir o hook WebSocket no frontend
function fixWebSocketHook() {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-websocket.ts');
  
  if (!fs.existsSync(hookPath)) {
    console.log('Arquivo use-websocket.ts não encontrado - isso é normal se estiver rodando no servidor');
    return;
  }

  let content = fs.readFileSync(hookPath, 'utf8');
  
  // Corrigir configuração do WebSocket para ambiente de produção
  const fixes = [
    {
      search: /const wsUrl = `ws/,
      replace: `const wsUrl = window.location.protocol === 'https:' 
        ? \`wss://\${window.location.host}/ws\`
        : \`ws://\${window.location.host}/ws\`;
      console.log('Conectando ao WebSocket em', wsUrl);
      const wsUrl_backup = \`ws`
    }
  ];

  let modified = false;
  fixes.forEach(fix => {
    if (fix.search.test(content)) {
      content = content.replace(fix.search, fix.replace);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(hookPath, content);
    console.log('✅ Hook WebSocket atualizado');
  }
}

// Criar script de teste para verificar WebSocket
function createWebSocketTest() {
  const testScript = `
// Teste de WebSocket para verificar conectividade
const testWebSocket = () => {
  const ws = new WebSocket(window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/ws' : 'ws://' + window.location.host + '/ws');
  
  ws.onopen = () => {
    console.log('✅ WebSocket conectado com sucesso');
    ws.send(JSON.stringify({ type: 'TEST', data: 'Teste de conectividade' }));
  };
  
  ws.onmessage = (event) => {
    console.log('📨 Mensagem recebida:', event.data);
  };
  
  ws.onclose = () => {
    console.log('❌ WebSocket desconectado');
  };
  
  ws.onerror = (error) => {
    console.error('🔥 Erro no WebSocket:', error);
  };
  
  return ws;
};

// Para testar, execute no console do navegador:
// testWebSocket();
console.log('Script de teste WebSocket carregado. Execute testWebSocket() para testar.');
`;

  fs.writeFileSync(path.join(__dirname, 'websocket-test.js'), testScript);
  console.log('✅ Script de teste WebSocket criado: websocket-test.js');
}

// Executar correções
console.log('🔧 Iniciando correções para WebSocket em tempo real...');

try {
  fixWebSocketRoutes();
  fixWebSocketHook();
  createWebSocketTest();
  
  console.log('\n✅ Correções aplicadas com sucesso!');
  console.log('\n📋 Próximos passos:');
  console.log('1. Reinicie o PM2: pm2 restart aet-license-system');
  console.log('2. Teste a conectividade WebSocket no navegador');
  console.log('3. Verifique os logs: pm2 logs aet-license-system --lines 20');
  console.log('4. Se necessário, teste com o script: node websocket-test.js');
  
} catch (error) {
  console.error('❌ Erro ao aplicar correções:', error);
}