#!/usr/bin/env node

/**
 * Teste específico da validação no servidor Google
 * Execute: node teste-validacao-servidor.js
 */

import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function testarValidacao() {
  console.log('🧪 TESTE DE VALIDAÇÃO - SERVIDOR GOOGLE');
  console.log('=' .repeat(50));
  
  try {
    // 1. Verificar se há dados sincronizados
    console.log('\n📊 1. Verificando dados sincronizados...');
    const dadosLicencas = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'ativa' THEN 1 END) as ativas,
        COUNT(CASE WHEN data_validade > CURRENT_DATE THEN 1 END) as vigentes
      FROM licencas_emitidas
    `);
    
    const stats = dadosLicencas.rows[0];
    console.log(`   Total: ${stats.total}`);
    console.log(`   Ativas: ${stats.ativas}`);  
    console.log(`   Vigentes: ${stats.vigentes}`);
    
    if (stats.total === '0') {
      console.log('\n❌ PROBLEMA IDENTIFICADO: Tabela licencas_emitidas está vazia!');
      console.log('📝 SOLUÇÃO: Execute o script de sincronização:');
      console.log('   node sync-approved-licenses.js');
      return;
    }
    
    // 2. Verificar dados específicos BDI1A71
    console.log('\n🔍 2. Verificando licenças para BDI1A71...');
    const licencasBDI = await pool.query(`
      SELECT 
        estado,
        numero_licenca,
        data_validade,
        data_emissao,
        placa_unidade_tratora,
        placa_primeira_carreta,
        placa_segunda_carreta,
        EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) as dias_restantes,
        CASE 
          WHEN EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) > 60 THEN 'BLOQUEADO'
          ELSE 'LIBERADO'
        END as status_validacao
      FROM licencas_emitidas 
      WHERE status = 'ativa'
        AND data_validade > CURRENT_DATE
        AND (
          placa_unidade_tratora = 'BDI1A71' OR
          placa_primeira_carreta = 'BCB0886' OR  
          placa_segunda_carreta = 'BCB0887'
        )
      ORDER BY estado
    `);
    
    if (licencasBDI.rows.length === 0) {
      console.log('⚠️  Nenhuma licença vigente encontrada para BDI1A71+BCB0886+BCB0887');
      console.log('   Isso significa que a validação deve LIBERAR todos os estados');
    } else {
      console.log(`✅ Encontradas ${licencasBDI.rows.length} licenças vigentes:`);
      licencasBDI.rows.forEach(lic => {
        console.log(`   ${lic.estado}: ${lic.numero_licenca} - ${lic.dias_restantes} dias - ${lic.status_validacao}`);
      });
    }
    
    // 3. Testar consulta exata da API
    console.log('\n🔧 3. Testando consulta exata da API...');
    const estados = ['AL', 'BA', 'CE', 'DF', 'DNIT', 'MG', 'MS', 'SP'];
    const placas = ['BDI1A71', 'BCB0886', 'BCB0887'];
    
    for (const estado of estados) {
      try {
        const query = `
          SELECT 
            estado,
            numero_licenca,
            data_validade,
            placa_unidade_tratora,
            placa_primeira_carreta, 
            placa_segunda_carreta,
            EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) as dias_restantes
          FROM licencas_emitidas
          WHERE estado = $1 
            AND status = 'ativa'
            AND data_validade > CURRENT_DATE
            AND (
              placa_unidade_tratora = ANY($2::text[]) OR
              placa_primeira_carreta = ANY($2::text[]) OR
              placa_segunda_carreta = ANY($2::text[])
            )
          ORDER BY data_validade DESC
          LIMIT 1
        `;
        
        const result = await pool.query(query, [estado, placas]);
        
        if (result.rows.length > 0) {
          const lic = result.rows[0];
          const bloqueado = lic.dias_restantes > 60;
          console.log(`   ${estado}: ${bloqueado ? '❌ BLOQUEADO' : '✅ LIBERADO'} (${lic.dias_restantes} dias)`);
        } else {
          console.log(`   ${estado}: ✅ LIBERADO (sem licenças)`);
        }
        
      } catch (error) {
        console.log(`   ${estado}: ❌ ERRO - ${error.message}`);
      }
    }
    
    // 4. Verificar endpoints da API
    console.log('\n🌐 4. Endpoints para teste manual:');
    console.log('   POST /api/validacao-critica');
    console.log('   Body: {"estado": "MG", "placas": ["BDI1A71", "BCB0886", "BCB0887"]}');
    console.log('');
    console.log('   POST /api/licencas-vigentes-by-state');  
    console.log('   Body: {"estado": "AL", "placas": ["BDI1A71", "BCB0886", "BCB0887"]}');
    
    console.log('\n✅ TESTE CONCLUÍDO');
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testarValidacao();