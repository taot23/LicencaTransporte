#!/usr/bin/env node

// Teste da validação por combinação completa
// Execute: node test-combination-validation.js

const BASE_URL = 'http://localhost:5000';

async function testCombinationValidation() {
  console.log('🧪 TESTANDO VALIDAÇÃO POR COMBINAÇÃO COMPLETA\n');
  
  // Dados da licença existente (baseado na consulta SQL)
  const combinacaoExistente = {
    cavalo: 'BDI1A71',
    carreta1: 'BCB-0886', 
    carreta2: 'BCB-0887'
  };
  
  console.log('📋 Licença existente no sistema:');
  console.log(`   Cavalo: ${combinacaoExistente.cavalo}`);
  console.log(`   1ª Carreta: ${combinacaoExistente.carreta1}`);
  console.log(`   2ª Carreta: ${combinacaoExistente.carreta2}`);
  console.log('');
  
  // Teste 1: Combinação idêntica - DEVE BLOQUEAR
  console.log('🔍 TESTE 1: Combinação IDÊNTICA (deve bloquear)');
  await testValidation('MG', combinacaoExistente, true);
  
  // Teste 2: Mesmo cavalo, carretas diferentes - DEVE PERMITIR
  console.log('\n🔍 TESTE 2: Mesmo cavalo, carretas diferentes (deve permitir)');
  await testValidation('MG', {
    cavalo: 'BDI1A71',    // Mesmo cavalo
    carreta1: 'XYZ1234',  // Carreta diferente
    carreta2: 'ABC5678'   // Carreta diferente
  }, false);
  
  // Teste 3: Cavalo diferente, mesmas carretas - DEVE PERMITIR
  console.log('\n🔍 TESTE 3: Cavalo diferente, mesmas carretas (deve permitir)');
  await testValidation('MG', {
    cavalo: 'ZZZ9999',      // Cavalo diferente
    carreta1: 'BCB-0886',   // Mesma carreta
    carreta2: 'BCB-0887'    // Mesma carreta
  }, false);
  
  // Teste 4: Uma carreta diferente - DEVE PERMITIR
  console.log('\n🔍 TESTE 4: Uma carreta diferente (deve permitir)');
  await testValidation('MG', {
    cavalo: 'BDI1A71',      // Mesmo cavalo
    carreta1: 'BCB-0886',   // Mesma primeira carreta
    carreta2: 'DIF1234'     // Segunda carreta diferente
  }, false);
}

async function testValidation(estado, composicao, esperaBloqueio) {
  try {
    const response = await fetch(`${BASE_URL}/api/licencas-vigentes-by-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        estado: estado,
        composicao: composicao,
        placas: [composicao.cavalo, composicao.carreta1, composicao.carreta2] // Fallback
      })
    });
    
    if (!response.ok) {
      console.log(`❌ Erro HTTP ${response.status}: ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log(`   Composição: ${composicao.cavalo} + ${composicao.carreta1} + ${composicao.carreta2}`);
    console.log(`   Estado: ${estado}`);
    console.log(`   Resultado: ${data.bloqueado ? '🚫 BLOQUEADO' : '✅ PERMITIDO'}`);
    
    if (data.bloqueado) {
      console.log(`   Licença: ${data.numero_licenca || 'N/A'}`);
      console.log(`   Dias restantes: ${data.diasRestantes || 'N/A'}`);
      console.log(`   Tipo: ${data.tipo_bloqueio || 'padrão'}`);
    } else {
      console.log(`   Tipo: ${data.tipo_liberacao || 'padrão'}`);
      console.log(`   Motivo: ${data.message || 'N/A'}`);
    }
    
    // Verificar se o resultado está conforme esperado
    if (data.bloqueado === esperaBloqueio) {
      console.log(`   ✅ TESTE PASSOU - Resultado conforme esperado`);
    } else {
      console.log(`   ❌ TESTE FALHOU - Esperava ${esperaBloqueio ? 'bloqueio' : 'permissão'}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Erro na requisição: ${error.message}`);
  }
}

// Executar os testes
testCombinationValidation().catch(console.error);