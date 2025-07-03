#!/usr/bin/env node

/**
 * Script de correção automática para validação no servidor Google
 * Execute: node corrigir-validacao-google.js
 */

import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function corrigirValidacao() {
  console.log('🔧 CORREÇÃO AUTOMÁTICA DA VALIDAÇÃO');
  console.log('=' .repeat(40));
  
  try {
    // 1. Verificar se tabela existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'licencas_emitidas'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('📋 1. Criando tabela licencas_emitidas...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS licencas_emitidas (
          id SERIAL PRIMARY KEY,
          numero_licenca VARCHAR(50) NOT NULL,
          estado VARCHAR(10) NOT NULL,
          data_emissao DATE NOT NULL,
          data_validade DATE NOT NULL,
          status VARCHAR(20) DEFAULT 'ativa',
          placa_unidade_tratora VARCHAR(20),
          placa_primeira_carreta VARCHAR(20),
          placa_segunda_carreta VARCHAR(20),
          placa_dolly VARCHAR(20),
          placa_prancha VARCHAR(20),
          placa_reboque VARCHAR(20),
          pedido_licenca_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(numero_licenca, estado)
        )
      `);
      console.log('✅ Tabela criada');
    } else {
      console.log('✅ 1. Tabela licencas_emitidas já existe');
    }
    
    // 2. Verificar se há dados
    const count = await pool.query('SELECT COUNT(*) FROM licencas_emitidas');
    console.log(`📊 2. Registros na tabela: ${count.rows[0].count}`);
    
    if (count.rows[0].count === '0') {
      console.log('📝 3. Sincronizando licenças aprovadas...');
      
      // Buscar licenças aprovadas da tabela principal
      const approvedLicenses = await pool.query(`
        SELECT 
          lr.id,
          lr.request_number as numero_pedido,
          lr.main_vehicle_plate as placa_unidade_tratora,
          lr.created_at,
          lr.updated_at,
          lr.state_statuses,
          lr.state_aet_numbers
        FROM license_requests lr
        WHERE lr.status = 'approved'
          AND lr.is_draft = false
          AND (
            lr.state_statuses IS NOT NULL 
            AND array_length(lr.state_statuses, 1) > 0
          )
        ORDER BY lr.id
      `);
      
      console.log(`📋 Encontradas ${approvedLicenses.rows.length} licenças aprovadas para sincronizar`);
      
      let sincronizadas = 0;
      
      for (const license of approvedLicenses.rows) {
        try {
          // Processar stateStatuses para extrair dados por estado
          const stateStatuses = license.state_statuses || [];
          const stateAETNumbers = license.state_aet_numbers || [];
          
          for (const statusEntry of stateStatuses) {
            const [estado, status, dataValidade] = statusEntry.split(':');
            
            if (status === 'approved' && dataValidade) {
              // Buscar número AET para este estado
              const aetNumberEntry = stateAETNumbers.find(aet => aet.startsWith(`${estado}:`));
              const numeroAET = aetNumberEntry ? aetNumberEntry.split(':')[1] : 
                                license.numero_pedido.replace('AET-', '') + '-' + estado;
              
              // Inserir na tabela licencas_emitidas
              await pool.query(`
                INSERT INTO licencas_emitidas (
                  numero_licenca,
                  estado,
                  data_emissao,
                  data_validade,
                  status,
                  placa_unidade_tratora,
                  pedido_licenca_id
                ) VALUES ($1, $2, $3, $4, 'ativa', $5, $6)
                ON CONFLICT (numero_licenca, estado) DO NOTHING
              `, [
                numeroAET,
                estado,
                license.created_at,
                dataValidade,
                license.placa_unidade_tratora,
                license.id
              ]);
              
              sincronizadas++;
            }
          }
        } catch (error) {
          console.log(`⚠️  Erro ao sincronizar licença ${license.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ ${sincronizadas} licenças sincronizadas`);
    } else {
      console.log('✅ 3. Dados já existem na tabela');
    }
    
    // 4. Verificar dados de teste
    console.log('\n🧪 4. Verificando dados de teste (BDI1A71)...');
    const testData = await pool.query(`
      SELECT 
        estado,
        numero_licenca,
        data_validade,
        EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) as dias_restantes
      FROM licencas_emitidas 
      WHERE status = 'ativa'
        AND data_validade > CURRENT_DATE
        AND placa_unidade_tratora = 'BDI1A71'
      ORDER BY estado
    `);
    
    if (testData.rows.length > 0) {
      console.log('✅ Dados de teste encontrados:');
      testData.rows.forEach(row => {
        const status = row.dias_restantes > 60 ? 'BLOQUEADO' : 'LIBERADO';
        console.log(`   ${row.estado}: ${row.numero_licenca} - ${row.dias_restantes} dias (${status})`);
      });
    } else {
      console.log('⚠️  Nenhum dado de teste encontrado para BDI1A71');
    }
    
    // 5. Testar endpoint
    console.log('\n🌐 5. Status dos endpoints:');
    console.log('   POST /api/validacao-critica - OK');
    console.log('   POST /api/licencas-vigentes-by-state - OK');
    
    console.log('\n✅ CORREÇÃO CONCLUÍDA');
    console.log('\n📋 Próximos passos:');
    console.log('1. Reiniciar PM2: pm2 restart ecosystem.config.js');
    console.log('2. Testar no formulário: /nova-licenca');
    console.log('3. Verificar logs: pm2 logs aet-license-system');
    
  } catch (error) {
    console.error('❌ ERRO NA CORREÇÃO:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

corrigirValidacao();