#!/usr/bin/env node

import fs from 'fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addClientNames() {
  try {
    console.log('📋 ADICIONANDO NOMES DOS CLIENTES NA PLANILHA CSV\n');

    // Ler CSV original
    const csvPath = './attached_assets/modelo_veiculos (6)_1752867361081.csv';
    const csvContent = fs.readFileSync(csvPath, 'latin1');
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    const header = lines[0].split(';').map(col => col.trim());
    
    console.log(`📊 Total de linhas no CSV: ${lines.length}`);
    console.log(`📋 Colunas atuais: ${header.join(', ')}`);

    // Buscar todos os transportadores do sistema
    const transportersResult = await pool.query(`SELECT id, name, document_number FROM transporters WHERE document_number IS NOT NULL`);
    const transporterMap = new Map();
    
    transportersResult.rows.forEach(t => {
      const cleanDoc = t.document_number?.replace(/\D/g, '');
      if (cleanDoc) {
        transporterMap.set(cleanDoc, t.name);
      }
    });

    console.log(`🏢 Transportadores encontrados no sistema: ${transporterMap.size}`);

    // Adicionar nova coluna ao header
    const newHeader = [...header, 'nome_cliente'];
    
    // Processar dados
    const newLines = [newHeader.join(';')];
    let clientsFound = 0;
    let clientsNotFound = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const data = line.split(';').map(col => col.trim());
      const rowData = {};
      
      header.forEach((col, index) => {
        rowData[col] = data[index] || '';
      });

      // Buscar nome do cliente pelo CNPJ/CPF
      const transporterDoc = rowData.transportador_cpf_cnpj?.replace(/\D/g, '');
      let clientName = 'CLIENTE NÃO ENCONTRADO';
      
      if (transporterDoc && transporterMap.has(transporterDoc)) {
        clientName = transporterMap.get(transporterDoc);
        clientsFound++;
      } else {
        clientsNotFound++;
      }

      // Adicionar nova coluna com nome do cliente
      const newRow = [...data, clientName];
      newLines.push(newRow.join(';'));
    }

    // Gerar novo arquivo CSV
    const outputPath = './modelo_veiculos_com_nomes_clientes.csv';
    const outputContent = newLines.join('\n');
    
    // Salvar em UTF-8 para melhor compatibilidade
    fs.writeFileSync(outputPath, outputContent, 'utf8');

    console.log(`\n📄 ARQUIVO GERADO COM SUCESSO:`);
    console.log(`📁 Localização: ${outputPath}`);
    console.log(`📊 Total de linhas: ${newLines.length}`);
    console.log(`✅ Clientes encontrados: ${clientsFound}`);
    console.log(`❌ Clientes não encontrados: ${clientsNotFound}`);
    console.log(`📈 Taxa de correspondência: ${Math.round((clientsFound / (clientsFound + clientsNotFound)) * 100)}%`);

    // Mostrar amostra do resultado
    console.log(`\n📋 AMOSTRA DO NOVO ARQUIVO (primeiras 3 linhas):`);
    newLines.slice(0, 3).forEach((line, index) => {
      console.log(`${index + 1}: ${line}`);
    });

    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

addClientNames();