#!/usr/bin/env node

/**
 * Script para sincronizar licenças aprovadas existentes para a tabela licencas_emitidas
 * Este script deve ser executado no servidor de produção para migrar dados históricos
 * Versão CommonJS para compatibilidade com servidor Google
 */

const { Pool } = require('pg');

// Configuração do pool de conexões
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function syncApprovedLicenses() {
  console.log('🔄 SINCRONIZAÇÃO DE LICENÇAS APROVADAS');
  console.log('=' .repeat(50));
  
  try {
    // Verificar se a tabela licencas_emitidas existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'licencas_emitidas'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('📋 Criando tabela licencas_emitidas...');
      await pool.query(`
        CREATE TABLE licencas_emitidas (
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
      console.log('✅ Tabela criada com sucesso');
    } else {
      console.log('✅ Tabela licencas_emitidas já existe');
    }
    
    // Buscar licenças aprovadas
    console.log('🔍 Buscando licenças aprovadas...');
    const approvedLicenses = await pool.query(`
      SELECT 
        lr.id,
        lr.request_number,
        lr.main_vehicle_plate,
        lr.created_at,
        lr.updated_at,
        lr.state_statuses,
        lr.state_aet_numbers,
        v1.plate as primeira_carreta,
        v2.plate as segunda_carreta,
        v3.plate as dolly,
        v4.plate as prancha
      FROM license_requests lr
      LEFT JOIN vehicles v1 ON lr.first_trailer_id = v1.id
      LEFT JOIN vehicles v2 ON lr.second_trailer_id = v2.id  
      LEFT JOIN vehicles v3 ON lr.dolly_id = v3.id
      LEFT JOIN vehicles v4 ON lr.flatbed_id = v4.id
      WHERE lr.status = 'approved'
        AND lr.is_draft = false
        AND (
          lr.state_statuses IS NOT NULL 
          AND array_length(lr.state_statuses, 1) > 0
        )
      ORDER BY lr.id
    `);
    
    console.log(`📊 Encontradas ${approvedLicenses.rows.length} licenças aprovadas para processar`);
    
    let sincronizadas = 0;
    let erros = 0;
    
    for (const license of approvedLicenses.rows) {
      try {
        // Processar stateStatuses para extrair dados por estado
        const stateStatuses = license.state_statuses || [];
        const stateAETNumbers = license.state_aet_numbers || [];
        
        console.log(`\n🔄 Processando licença ${license.request_number} (ID: ${license.id})`);
        
        for (const statusEntry of stateStatuses) {
          const parts = statusEntry.split(':');
          if (parts.length >= 3) {
            const [estado, status, dataValidade] = parts;
            
            if (status === 'approved' && dataValidade) {
              try {
                // Buscar número AET para este estado
                const aetNumberEntry = stateAETNumbers.find(aet => aet.startsWith(`${estado}:`));
                const numeroAET = aetNumberEntry ? 
                  aetNumberEntry.split(':')[1] : 
                  license.request_number.replace('AET-', '') + '-' + estado;
                
                // Inserir na tabela licencas_emitidas
                await pool.query(`
                  INSERT INTO licencas_emitidas (
                    numero_licenca,
                    estado,
                    data_emissao,
                    data_validade,
                    status,
                    placa_unidade_tratora,
                    placa_primeira_carreta,
                    placa_segunda_carreta,
                    placa_dolly,
                    placa_prancha,
                    pedido_licenca_id
                  ) VALUES ($1, $2, $3, $4, 'ativa', $5, $6, $7, $8, $9, $10)
                  ON CONFLICT (numero_licenca, estado) DO NOTHING
                `, [
                  numeroAET,
                  estado,
                  license.created_at,
                  dataValidade,
                  license.main_vehicle_plate,
                  license.primeira_carreta,
                  license.segunda_carreta,
                  license.dolly,
                  license.prancha,
                  license.id
                ]);
                
                console.log(`   ✅ ${estado}: ${numeroAET} - ${dataValidade}`);
                sincronizadas++;
                
              } catch (insertError) {
                if (!insertError.message.includes('duplicate key value')) {
                  console.log(`   ⚠️  Erro ao inserir ${estado}: ${insertError.message}`);
                  erros++;
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Erro ao processar licença ${license.id}: ${error.message}`);
        erros++;
      }
    }
    
    console.log('\n📈 RESULTADO DA SINCRONIZAÇÃO:');
    console.log(`✅ Licenças sincronizadas: ${sincronizadas}`);
    console.log(`❌ Erros encontrados: ${erros}`);
    
    // Verificar resultado final
    const finalCount = await pool.query('SELECT COUNT(*) FROM licencas_emitidas');
    console.log(`📊 Total de registros na tabela: ${finalCount.rows[0].count}`);
    
    // Verificar dados de teste
    console.log('\n🧪 VERIFICANDO DADOS DE TESTE:');
    const testData = await pool.query(`
      SELECT 
        estado,
        numero_licenca,
        data_validade,
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
    
    if (testData.rows.length > 0) {
      console.log('🎯 Dados encontrados para placas de teste:');
      testData.rows.forEach(row => {
        const emoji = row.status_validacao === 'BLOQUEADO' ? '🔒' : '🔓';
        console.log(`   ${emoji} ${row.estado}: ${row.numero_licenca} - ${row.dias_restantes} dias (${row.status_validacao})`);
      });
    } else {
      console.log('⚠️  Nenhum dado encontrado para placas de teste (BDI1A71, BCB0886, BCB0887)');
    }
    
    console.log('\n✅ SINCRONIZAÇÃO CONCLUÍDA');
    console.log('📋 Próximos passos:');
    console.log('1. Reiniciar PM2: pm2 restart ecosystem.config.js');
    console.log('2. Testar validação em /nova-licenca');
    console.log('3. Verificar logs: pm2 logs aet-license-system');
    
  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  syncApprovedLicenses()
    .then(() => {
      console.log('\n🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Falha na execução:', error.message);
      process.exit(1);
    });
}

module.exports = { syncApprovedLicenses };