/**
 * Script para testar permissões diretamente no servidor de produção
 * Execute: node test-permissions-server.js
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';

// Usuários de teste
const testUsers = [
  { email: 'fiscal@nscaravaggio.com.br', password: '123456', role: 'user', name: 'Transportador' },
  { email: 'operacional01@sistema.com', password: '123456', role: 'operational', name: 'Operacional' },
  { email: 'supervisor@sistema.com', password: '123456', role: 'supervisor', name: 'Supervisor' },
  { email: 'financeiro@nvslicencas.com.br', password: '123456', role: 'financial', name: 'Financeiro' },
  { email: 'gerente@sistema.com', password: '123456', role: 'manager', name: 'Gerente' },
  { email: 'admin@sistema.com', password: '123456', role: 'admin', name: 'Admin' }
];

// Endpoints para testar
const endpoints = [
  { method: 'GET', url: '/api/user', description: 'Dados do usuário' },
  { method: 'GET', url: '/api/vehicles', description: 'Listar veículos' },
  { method: 'GET', url: '/api/transporters', description: 'Listar transportadores' },
  { method: 'POST', url: '/api/transporters', description: 'Criar transportador', data: { name: 'Teste', cnpj: '12345678000100' } },
  { method: 'GET', url: '/api/users', description: 'Listar usuários' },
  { method: 'GET', url: '/api/boletos', description: 'Listar boletos' },
  { method: 'GET', url: '/api/vehicle-models', description: 'Listar modelos' },
  { method: 'POST', url: '/api/vehicle-models', description: 'Criar modelo', data: { brand: 'Teste', model: 'Teste', vehicleType: 'truck' } }
];

async function testLogin(user) {
  try {
    const response = await axios.post(`${SERVER_URL}/api/login`, {
      email: user.email,
      password: user.password
    }, {
      withCredentials: true
    });
    
    // Extrair cookies de sessão
    const cookies = response.headers['set-cookie'];
    return cookies ? cookies.join('; ') : null;
  } catch (error) {
    console.log(`❌ Erro no login para ${user.email}:`, error.response?.status || error.message);
    return null;
  }
}

async function testEndpoint(endpoint, cookies) {
  try {
    const config = {
      method: endpoint.method,
      url: `${SERVER_URL}${endpoint.url}`,
      headers: cookies ? { Cookie: cookies } : {},
      withCredentials: true
    };
    
    if (endpoint.data) {
      config.data = endpoint.data;
    }
    
    const response = await axios(config);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status || 0, 
      message: error.response?.data?.message || error.message 
    };
  }
}

async function testarPermissoes() {
  console.log('🧪 TESTE DE PERMISSÕES NO SERVIDOR DE PRODUÇÃO');
  console.log('===============================================');
  
  for (const user of testUsers) {
    console.log(`\n👤 TESTANDO: ${user.name} (${user.email})`);
    console.log('-'.repeat(50));
    
    // Fazer login
    const cookies = await testLogin(user);
    if (!cookies) {
      console.log('❌ Falha no login - pular testes de endpoint');
      continue;
    }
    
    console.log('✅ Login realizado com sucesso');
    
    // Testar endpoints
    for (const endpoint of endpoints) {
      const result = await testEndpoint(endpoint, cookies);
      
      if (result.success) {
        console.log(`✅ ${endpoint.method} ${endpoint.url}: SUCESSO (${result.status})`);
      } else {
        console.log(`❌ ${endpoint.method} ${endpoint.url}: ERRO (${result.status}) - ${result.message}`);
      }
    }
    
    // Logout
    try {
      await axios.post(`${SERVER_URL}/api/logout`, {}, {
        headers: { Cookie: cookies },
        withCredentials: true
      });
    } catch (error) {
      // Ignorar erros de logout
    }
  }
  
  console.log('\n🏁 TESTE CONCLUÍDO');
}

// Executar se chamado diretamente
if (require.main === module) {
  testarPermissoes().catch(console.error);
}

module.exports = { testarPermissoes };