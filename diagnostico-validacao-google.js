#!/usr/bin/env node

/**
 * Script de diagnóstico para validação de licenças vigentes no servidor Google
 * Execute: node diagnostico-validacao-google.js
 */

import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = ws;

// Conectar ao banco usando a variável de ambiente
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function diagnosticarValidacao() {
  console.log('🔍 DIAGNÓSTICO DA VALIDAÇÃO DE LICENÇAS VIGENTES');
  console.log('=' .repeat(60));
  
  try {
    // 1. Verificar conexão com banco
    console.log('\n1. 🔌 Testando conexão com banco de dados...');
    const testConnection = await pool.query('SELECT NOW()');
    console.log('✅ Conexão funcionando:', testConnection.rows[0].now);
    
    // 2. Verificar se tabela licencas_emitidas existe
    console.log('\n2. 📋 Verificando tabela licencas_emitidas...');
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'licencas_emitidas'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ PROBLEMA: Tabela licencas_emitidas não existe!');
      console.log('📝 Solução: Execute o script de sincronização de licenças');
      return;
    }
    console.log('✅ Tabela licencas_emitidas existe');
    
    // 3. Contar registros na tabela
    console.log('\n3. 📊 Contando registros na tabela...');
    const count = await pool.query('SELECT COUNT(*) FROM licencas_emitidas');
    console.log(`📈 Total de registros: ${count.rows[0].count}`);
    
    if (count.rows[0].count === '0') {
      console.log('⚠️  ATENÇÃO: Tabela vazia - sem dados para validação');
      console.log('📝 Solução: Sincronize as licenças aprovadas');
    }
    
    // 4. Verificar estrutura da tabela
    console.log('\n4. 🏗️  Verificando estrutura da tabela...');
    const structure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'licencas_emitidas'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela:');
    structure.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // 5. Verificar licenças ativas
    console.log('\n5. 🔍 Verificando licenças ativas...');
    const activeLicenses = await pool.query(`
      SELECT 
        estado,
        COUNT(*) as total,
        COUNT(CASE WHEN data_validade > CURRENT_DATE THEN 1 END) as vigentes,
        COUNT(CASE WHEN EXTRACT(DAY FROM data_validade - CURRENT_DATE) > 60 THEN 1 END) as bloqueadoras
      FROM licencas_emitidas 
      WHERE status = 'ativa'
      GROUP BY estado
      ORDER BY estado
    `);
    
    console.log('📊 Licenças por estado:');
    activeLicenses.rows.forEach(license => {
      console.log(`   ${license.estado}: ${license.total} total, ${license.vigentes} vigentes, ${license.bloqueadoras} bloqueadoras (>60 dias)`);
    });
    
    // 6. Testar consulta de validação para estado específico
    console.log('\n6. 🧪 Testando consulta de validação...');
    const testQuery = `
      SELECT 
        estado,
        numero_licenca,
        data_validade,
        placa_unidade_tratora,
        placa_primeira_carreta,
        placa_segunda_carreta,
        EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) as dias_restantes
      FROM licencas_emitidas 
      WHERE estado = 'MG'
        AND status = 'ativa'
        AND data_validade > CURRENT_DATE
        AND (
          placa_unidade_tratora = 'BDI1A71' OR
          placa_primeira_carreta = 'BCB0886' OR
          placa_segunda_carreta = 'BCB0887'
        )
      ORDER BY data_validade DESC
      LIMIT 1
    `;
    
    const testResult = await pool.query(testQuery);
    
    if (testResult.rows.length > 0) {
      const license = testResult.rows[0];
      console.log('✅ Licença encontrada para teste (MG + BDI1A71):');
      console.log(`   - Número: ${license.numero_licenca}`);
      console.log(`   - Validade: ${license.data_validade}`);
      console.log(`   - Dias restantes: ${license.dias_restantes}`);
      console.log(`   - Status validação: ${license.dias_restantes > 60 ? 'BLOQUEADO' : 'LIBERADO'}`);
    } else {
      console.log('⚠️  Nenhuma licença encontrada para o teste (MG + BDI1A71)');
    }
    
    // 7. Verificar variáveis de ambiente
    console.log('\n7. 🔧 Verificando configuração do servidor...');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'definido' : 'NÃO DEFINIDO'}`);
    
    // 8. Testar endpoint da API (simulação)
    console.log('\n8. 🌐 Teste de endpoint recomendado:');
    console.log('   POST /api/validacao-critica');
    console.log('   Body: {"estado": "MG", "placas": ["BDI1A71", "BCB0886", "BCB0887"]}');
    console.log('   Esperado: {"bloqueado": true} (se licença >60 dias)');
    
    console.log('\n✅ DIAGNÓSTICO CONCLUÍDO');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    
    if (count.rows[0].count === '0') {
      console.log('1. ⚠️  Sincronizar licenças: executar sync-approved-licenses.js');
      console.log('2. 🔄 Reiniciar PM2: pm2 restart ecosystem.config.js');
      console.log('3. 🧪 Testar validação no formulário');
    } else {
      console.log('1. 🔄 Reiniciar PM2: pm2 restart ecosystem.config.js');
      console.log('2. 🧪 Testar endpoint via navegador/Postman');
      console.log('3. 📋 Verificar logs do PM2: pm2 logs aet-license-system');
    }
    
  } catch (error) {
    console.error('❌ ERRO NO DIAGNÓSTICO:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Executar diagnóstico
diagnosticarValidacao();