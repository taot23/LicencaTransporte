// Script para testar e corrigir a validação definitivamente
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testarValidacao() {
  try {
    console.log('[TESTE VALIDAÇÃO] Iniciando teste definitivo...');
    
    // Testar com placas que sabemos que têm licenças vigentes
    const states = ['MG', 'AL', 'DNIT'];
    const plates = ['BDI1A71', 'BCB-0886', 'BCB-0887'];
    
    console.log(`[TESTE] Estados: ${states.join(', ')}`);
    console.log(`[TESTE] Placas: ${plates.join(', ')}`);
    
    const conflicts = [];
    
    for (const state of states) {
      console.log(`[TESTE] Verificando estado: ${state}`);
      
      const query = `
        SELECT 
          le.estado,
          le.numero_licenca,
          le.data_validade,
          le.placa_unidade_tratora,
          le.placa_primeira_carreta,
          le.placa_segunda_carreta,
          le.pedido_id,
          EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
        FROM licencas_emitidas le
        WHERE le.estado = $1 
          AND le.status = 'ativa'
          AND le.data_validade > CURRENT_DATE
          AND (
            le.placa_unidade_tratora = ANY($2::text[]) OR
            le.placa_primeira_carreta = ANY($2::text[]) OR
            le.placa_segunda_carreta = ANY($2::text[])
          )
      `;
      
      const result = await pool.query(query, [state, plates]);
      
      console.log(`[TESTE] Estado ${state}: encontradas ${result.rows.length} licenças ativas`);
      
      for (const license of result.rows) {
        const daysUntilExpiry = parseInt(license.dias_restantes);
        console.log(`[TESTE] Licença ${license.numero_licenca}: ${daysUntilExpiry} dias restantes`);
        
        if (daysUntilExpiry > 60) {
          console.log(`[TESTE] Estado ${state} DEVE SER BLOQUEADO: ${daysUntilExpiry} dias > 60`);
          conflicts.push({
            state: state,
            licenseNumber: license.numero_licenca,
            daysUntilExpiry: daysUntilExpiry,
            shouldBlock: true
          });
        } else {
          console.log(`[TESTE] Estado ${state} DEVE SER LIBERADO: ${daysUntilExpiry} dias ≤ 60`);
        }
      }
    }
    
    console.log(`[TESTE] Resultado final: ${conflicts.length} estados devem ser bloqueados`);
    conflicts.forEach(c => {
      console.log(`- ${c.state}: ${c.licenseNumber} (${c.daysUntilExpiry} dias)`);
    });
    
    if (conflicts.length > 0) {
      console.log('[TESTE] ✅ VALIDAÇÃO FUNCIONANDO - Conflitos encontrados corretamente');
    } else {
      console.log('[TESTE] ❌ VALIDAÇÃO NÃO ESTÁ FUNCIONANDO - Nenhum conflito encontrado');
    }
    
  } catch (error) {
    console.error('[TESTE] Erro:', error);
  } finally {
    await pool.end();
  }
}

testarValidacao();