#!/usr/bin/env node

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function analyzeTransporters() {
  try {
    console.log('🔍 VERIFICANDO TRANSPORTADORES NO SISTEMA\n');

    // Ler transportadores do CSV
    const csvPath = join(__dirname, 'attached_assets', 'modelo_veiculos (6)_1752867361081.csv');
    const csvContent = fs.readFileSync(csvPath, 'latin1');
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    const header = lines[0].split(';').map(col => col.trim());
    
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
        csvTransporters.add(rowData.transportador_cpf_cnpj.replace(/\D/g, ''));
      }
    }

    console.log(`📋 Transportadores únicos no CSV: ${csvTransporters.size}`);

    // Buscar transportadores no sistema
    const systemTransporters = await db.execute(`SELECT document_number FROM transporters WHERE document_number IS NOT NULL`);
    const systemDocs = systemTransporters.rows.map(t => t.document_number?.replace(/\D/g, '')).filter(Boolean);
    
    console.log(`🏢 Transportadores cadastrados no sistema: ${systemDocs.length}`);

    // Verificar correspondências
    const foundInSystem = Array.from(csvTransporters).filter(doc => systemDocs.includes(doc));
    const notFoundInSystem = Array.from(csvTransporters).filter(doc => !systemDocs.includes(doc));

    console.log(`\n✅ ENCONTRADOS NO SISTEMA: ${foundInSystem.length}`);
    console.log(`❌ NÃO ENCONTRADOS: ${notFoundInSystem.length}`);
    console.log(`📊 Taxa de correspondência: ${Math.round((foundInSystem.length / csvTransporters.size) * 100)}%\n`);

    if (foundInSystem.length > 0) {
      console.log('✅ TRANSPORTADORES ENCONTRADOS (primeiros 10):');
      foundInSystem.slice(0, 10).forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc}`);
      });
      if (foundInSystem.length > 10) {
        console.log(`  ... e mais ${foundInSystem.length - 10}\n`);
      }
    }

    if (notFoundInSystem.length > 0) {
      console.log('❌ TRANSPORTADORES NÃO ENCONTRADOS (primeiros 20):');
      notFoundInSystem.slice(0, 20).forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc}`);
      });
      if (notFoundInSystem.length > 20) {
        console.log(`  ... e mais ${notFoundInSystem.length - 20}\n`);
      }
    }

    // Calcular quantos veículos podem ser importados
    let importableVehicles = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const data = line.split(';').map(col => col.trim());
      const rowData = {};
      
      header.forEach((col, index) => {
        rowData[col] = data[index] || '';
      });

      if (rowData.transportador_cpf_cnpj) {
        const doc = rowData.transportador_cpf_cnpj.replace(/\D/g, '');
        if (foundInSystem.includes(doc)) {
          importableVehicles++;
        }
      }
    }

    console.log('📈 ESTIMATIVA DE IMPORTAÇÃO:');
    console.log(`  • Veículos importáveis: ${importableVehicles}`);
    console.log(`  • Veículos bloqueados: ${lines.length - 1 - importableVehicles}`);
    console.log(`  • Taxa de sucesso esperada: ${Math.round((importableVehicles / (lines.length - 1)) * 100)}%`);

    await db.end();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

analyzeTransporters();