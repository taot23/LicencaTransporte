/**
 * Script de teste para verificar se todas as funções dos tipos de usuários estão funcionando
 * corretamente no sistema AET
 */

const users = [
  { email: 'fiscal@nscaravaggio.com.br', role: 'user', expected: 'Transportador' },
  { email: 'operacional01@sistema.com', role: 'operational', expected: 'Operacional' },
  { email: 'supervisor@sistema.com', role: 'supervisor', expected: 'Supervisor' },
  { email: 'financeiro@nvslicencas.com.br', role: 'financial', expected: 'Financeiro' },
  { email: 'gerente@sistema.com', role: 'manager', expected: 'Gerente' },
  { email: 'admin@sistema.com', role: 'admin', expected: 'Administrador' }
];

const endpoints = [
  { path: '/api/user', method: 'GET', description: 'Obter dados do usuário' },
  { path: '/api/vehicles', method: 'GET', description: 'Listar veículos' },
  { path: '/api/vehicles', method: 'POST', description: 'Criar veículo' },
  { path: '/api/license-requests', method: 'GET', description: 'Listar licenças' },
  { path: '/api/license-requests', method: 'POST', description: 'Criar licença' },
  { path: '/api/transporters', method: 'GET', description: 'Listar transportadores' },
  { path: '/api/transporters', method: 'POST', description: 'Criar transportador' },
  { path: '/api/users', method: 'GET', description: 'Listar usuários' },
  { path: '/api/users', method: 'POST', description: 'Criar usuário' },
  { path: '/api/boletos', method: 'GET', description: 'Listar boletos' },
  { path: '/api/boletos', method: 'POST', description: 'Criar boleto' },
  { path: '/api/vehicle-models', method: 'GET', description: 'Listar modelos de veículos' },
  { path: '/api/vehicle-models', method: 'POST', description: 'Criar modelo de veículo' }
];

const expectedPermissions = {
  'user': {
    // Transportador - acesso limitado apenas aos próprios dados
    canAccess: ['/api/user', '/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models'],
    canCreate: ['/api/vehicles', '/api/license-requests'],
    cannotAccess: ['/api/users', '/api/boletos'],
    cannotCreate: ['/api/transporters', '/api/users', '/api/boletos', '/api/vehicle-models']
  },
  'operational': {
    // Operacional - pode gerenciar licenças, veículos e transportadores
    canAccess: ['/api/user', '/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models'],
    canCreate: ['/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models'],
    cannotAccess: ['/api/users', '/api/boletos'],
    cannotCreate: ['/api/users', '/api/boletos']
  },
  'supervisor': {
    // Supervisor - pode gerenciar usuários e tem amplo acesso
    canAccess: ['/api/user', '/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models', '/api/users', '/api/boletos'],
    canCreate: ['/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models', '/api/users', '/api/boletos'],
    cannotAccess: [],
    cannotCreate: []
  },
  'financial': {
    // Financeiro - foco em boletos mas acesso a outros módulos
    canAccess: ['/api/user', '/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models', '/api/boletos'],
    canCreate: ['/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models', '/api/boletos'],
    cannotAccess: ['/api/users'],
    cannotCreate: ['/api/users']
  },
  'manager': {
    // Gerente - acesso quase total
    canAccess: ['/api/user', '/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models', '/api/users', '/api/boletos'],
    canCreate: ['/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models', '/api/users', '/api/boletos'],
    cannotAccess: [],
    cannotCreate: []
  },
  'admin': {
    // Administrador - acesso total
    canAccess: ['/api/user', '/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models', '/api/users', '/api/boletos'],
    canCreate: ['/api/vehicles', '/api/license-requests', '/api/transporters', '/api/vehicle-models', '/api/users', '/api/boletos'],
    cannotAccess: [],
    cannotCreate: []
  }
};

async function testUserPermissions() {
  console.log('🧪 INICIANDO TESTE DE PERMISSÕES DE USUÁRIOS');
  console.log('='.repeat(60));
  
  for (const user of users) {
    console.log(`\n👤 TESTANDO USUÁRIO: ${user.email} (${user.role})`);
    console.log('-'.repeat(50));
    
    // Primeiro, fazer login com o usuário
    try {
      const loginResponse = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: '123456' // Senha padrão do sistema
        }),
        credentials: 'include'
      });
      
      if (!loginResponse.ok) {
        console.log(`❌ Erro no login: ${loginResponse.status}`);
        continue;
      }
      
      console.log('✅ Login realizado com sucesso');
      
      // Obter cookie de sessão
      const cookies = loginResponse.headers.get('set-cookie') || '';
      
      // Testar endpoints específicos para este role
      const permissions = expectedPermissions[user.role];
      
      for (const endpoint of endpoints) {
        const shouldHaveAccess = permissions.canAccess.includes(endpoint.path);
        const shouldCreateAccess = endpoint.method === 'POST' ? 
          permissions.canCreate.includes(endpoint.path) : true;
        
        const expectedResult = shouldHaveAccess && shouldCreateAccess;
        
        try {
          const response = await fetch(`http://localhost:5000${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookies
            },
            ...(endpoint.method === 'POST' && {
              body: JSON.stringify({
                // Dados mínimos para teste
                name: 'Teste',
                email: 'teste@exemplo.com'
              })
            })
          });
          
          const hasAccess = response.status !== 403 && response.status !== 401;
          
          if (expectedResult === hasAccess) {
            console.log(`✅ ${endpoint.method} ${endpoint.path}: ${hasAccess ? 'ACESSO' : 'NEGADO'} (correto)`);
          } else {
            console.log(`❌ ${endpoint.method} ${endpoint.path}: Esperado ${expectedResult ? 'ACESSO' : 'NEGADO'}, obtido ${hasAccess ? 'ACESSO' : 'NEGADO'} (${response.status})`);
          }
        } catch (error) {
          console.log(`⚠️  ${endpoint.method} ${endpoint.path}: Erro na requisição - ${error.message}`);
        }
      }
      
      // Fazer logout
      await fetch('http://localhost:5000/api/logout', {
        method: 'POST',
        headers: { 'Cookie': cookies }
      });
      
    } catch (error) {
      console.log(`❌ Erro geral para usuário ${user.email}: ${error.message}`);
    }
  }
  
  console.log('\n🏁 TESTE DE PERMISSÕES CONCLUÍDO');
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  testUserPermissions().catch(console.error);
}

module.exports = { testUserPermissions, users, expectedPermissions };