#!/usr/bin/env node

import fs from 'fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configurar WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Usar a mesma configuração do projeto
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createTransporters() {
  try {
    console.log('🚛 CRIANDO TRANSPORTADORES AUTOMATICAMENTE\n');

    // Ler CSV
    const csvPath = './attached_assets/modelo_veiculos (6)_1752867361081.csv';
    const csvContent = fs.readFileSync(csvPath, 'latin1');
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    const header = lines[0].split(';').map(col => col.trim());
    
    // Coletar transportadores únicos do CSV
    const csvTransporters = new Set();
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const data = line.split(';').map(col => col.trim());
      const rowData = {};
      
      header.forEach((col, index) => {
        rowData[col] = data[index] || '';
      });

      if (rowData.transportador_cpf_cnpj) {
        const cleanDoc = rowData.transportador_cpf_cnpj.replace(/\D/g, '');
        if (cleanDoc.length >= 11) {
          csvTransporters.add(cleanDoc);
        }
      }
    }

    console.log(`📋 Transportadores únicos no CSV: ${csvTransporters.size}`);

    // Buscar transportadores existentes
    const existingResult = await pool.query(`SELECT document_number FROM transporters WHERE document_number IS NOT NULL`);
    const existingDocs = new Set(
      existingResult.rows
        .map(t => t.document_number?.replace(/\D/g, ''))
        .filter(Boolean)
    );

    console.log(`🏢 Transportadores já cadastrados: ${existingDocs.size}`);

    // Identificar quais precisam ser criados
    const missingTransporters = Array.from(csvTransporters).filter(doc => !existingDocs.has(doc));
    
    console.log(`➕ Transportadores a serem criados: ${missingTransporters.length}\n`);

    if (missingTransporters.length === 0) {
      console.log('✅ Todos os transportadores já estão cadastrados!');
      await pool.end();
      return;
    }

    // Criar transportadores em lote
    let created = 0;
    let failed = 0;

    for (const doc of missingTransporters) {
      try {
        // Determinar se é CPF ou CNPJ
        const isCNPJ = doc.length === 14;
        const personType = isCNPJ ? 'pj' : 'pf';
        
        // Formatar documento
        let formattedDoc;
        if (isCNPJ) {
          formattedDoc = doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        } else {
          formattedDoc = doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }

        // Nome baseado no tipo
        const name = isCNPJ 
          ? `TRANSPORTADORA ${doc.substring(0, 8)}` 
          : `TRANSPORTADOR ${doc.substring(0, 6)}`;

        // Inserir transportador
        await pool.query(`
          INSERT INTO transporters (
            name, 
            trade_name, 
            person_type, 
            document_number, 
            city, 
            state, 
            email, 
            phone,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          name,
          name,
          personType,
          formattedDoc,
          'CIDADE IMPORTADA',
          'SP',
          `contato@${doc.substring(0, 8)}.com.br`,
          '(11) 99999-9999'
        ]);

        created++;
        
        if (created % 100 === 0) {
          console.log(`✅ Criados ${created}/${missingTransporters.length} transportadores...`);
        }

      } catch (error) {
        failed++;
        if (failed <= 5) { // Mostrar apenas os primeiros 5 erros
          console.log(`❌ Erro ao criar transportador ${doc}: ${error.message}`);
        }
      }
    }

    console.log(`\n🎉 RESULTADO DA CRIAÇÃO:`);
    console.log(`✅ Transportadores criados: ${created}`);
    console.log(`❌ Falhas: ${failed}`);
    console.log(`📊 Taxa de sucesso: ${Math.round((created / missingTransporters.length) * 100)}%`);

    if (created > 0) {
      console.log(`\n🚗 Agora você pode executar novamente a importação de veículos!`);
      console.log(`   Os ${created} novos transportadores permitirão importar muito mais veículos.`);
    }

    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    process.exit(1);
  }
}

createTransporters();