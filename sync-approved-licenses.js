/**
 * Script para sincronizar licenças aprovadas existentes para a tabela licencas_emitidas
 * Este script deve ser executado no servidor de produção para migrar dados históricos
 */

const { Pool } = require('pg');

// Configuração da conexão com o banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function syncApprovedLicenses() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando sincronização de licenças aprovadas...');
    
    // Buscar todas as licenças com estados aprovados
    const licenseQuery = `
      SELECT 
        id, user_id, transporter_id, request_number, type, main_vehicle_plate,
        tractor_unit_id, first_trailer_id, second_trailer_id,
        state_statuses, state_aet_numbers, state_cnpjs,
        created_at, updated_at
      FROM license_requests 
      WHERE state_statuses IS NOT NULL 
        AND array_to_string(state_statuses, ',') LIKE '%:approved:%'
      ORDER BY id;
    `;
    
    const { rows: licenses } = await client.query(licenseQuery);
    
    console.log(`📋 Encontradas ${licenses.length} licenças com estados aprovados`);
    
    let totalSynced = 0;
    let totalStates = 0;
    
    for (const license of licenses) {
      console.log(`\n🔍 Processando licença ${license.request_number} (ID: ${license.id})`);
      
      if (!license.state_statuses) continue;
      
      // Processar cada estado aprovado
      for (const stateInfo of license.state_statuses) {
        const parts = stateInfo.split(':');
        if (parts.length >= 4 && parts[1] === 'approved') {
          const estado = parts[0];
          const status = parts[1];
          const dataValidade = parts[2];
          const dataEmissao = parts[3];
          
          // Buscar número AET se existir
          let numeroAet = `${estado}-${license.id}`;
          if (license.state_aet_numbers) {
            for (const aetInfo of license.state_aet_numbers) {
              if (aetInfo.startsWith(`${estado}:`)) {
                numeroAet = aetInfo.split(':')[1];
                break;
              }
            }
          }
          
          // Buscar CNPJ selecionado se existir
          let cnpjSelecionado = null;
          if (license.state_cnpjs) {
            for (const cnpjInfo of license.state_cnpjs) {
              if (cnpjInfo.startsWith(`${estado}:`)) {
                cnpjSelecionado = cnpjInfo.split(':')[1];
                break;
              }
            }
          }
          
          // Buscar placas dos veículos
          let placaTratora = license.main_vehicle_plate;
          let placaPrimeira = null;
          let placaSegunda = null;
          
          if (license.first_trailer_id) {
            const { rows: firstTrailer } = await client.query(
              'SELECT plate FROM vehicles WHERE id = $1', 
              [license.first_trailer_id]
            );
            if (firstTrailer.length > 0) {
              placaPrimeira = firstTrailer[0].plate;
            }
          }
          
          if (license.second_trailer_id) {
            const { rows: secondTrailer } = await client.query(
              'SELECT plate FROM vehicles WHERE id = $1', 
              [license.second_trailer_id]
            );
            if (secondTrailer.length > 0) {
              placaSegunda = secondTrailer[0].plate;
            }
          }
          
          try {
            // Inserir na tabela licencas_emitidas
            await client.query(`
              INSERT INTO licencas_emitidas (
                pedido_id, estado, numero_licenca, data_emissao, data_validade, status,
                placa_unidade_tratora, placa_primeira_carreta, placa_segunda_carreta,
                cnpj_selecionado, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (pedido_id, estado) 
              DO UPDATE SET
                numero_licenca = EXCLUDED.numero_licenca,
                data_validade = EXCLUDED.data_validade,
                data_emissao = EXCLUDED.data_emissao,
                status = 'ativa',
                placa_unidade_tratora = EXCLUDED.placa_unidade_tratora,
                placa_primeira_carreta = EXCLUDED.placa_primeira_carreta,
                placa_segunda_carreta = EXCLUDED.placa_segunda_carreta,
                cnpj_selecionado = EXCLUDED.cnpj_selecionado,
                updated_at = CURRENT_TIMESTAMP
            `, [
              license.id, estado, numeroAet, 
              dataEmissao, dataValidade, 'ativa',
              placaTratora, placaPrimeira, placaSegunda,
              cnpjSelecionado, new Date(), new Date()
            ]);
            
            console.log(`  ✅ ${estado}: ${numeroAet} (válida até ${dataValidade})`);
            totalStates++;
            
          } catch (error) {
            console.error(`  ❌ Erro ao sincronizar ${estado}:`, error.message);
          }
        }
      }
      
      totalSynced++;
    }
    
    console.log(`\n🎉 Sincronização concluída!`);
    console.log(`📊 Estatísticas:`);
    console.log(`   - Licenças processadas: ${totalSynced}`);
    console.log(`   - Estados sincronizados: ${totalStates}`);
    
    // Verificar resultado final
    const { rows: finalCount } = await client.query(
      'SELECT COUNT(*) as total FROM licencas_emitidas WHERE status = $1',
      ['ativa']
    );
    
    console.log(`   - Total de licenças ativas na tabela: ${finalCount[0].total}`);
    
  } catch (error) {
    console.error('❌ Erro durante a sincronização:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  syncApprovedLicenses()
    .then(() => {
      console.log('\n✅ Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro na execução:', error);
      process.exit(1);
    });
}

module.exports = { syncApprovedLicenses };