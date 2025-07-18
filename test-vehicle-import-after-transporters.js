#!/usr/bin/env node

import fs from 'fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testImport() {
  try {
    console.log('🧪 TESTE: SIMULAÇÃO DE IMPORTAÇÃO APÓS CRIAÇÃO DOS TRANSPORTADORES\n');

    // Ler CSV
    const csvPath = './attached_assets/modelo_veiculos (6)_1752867361081.csv';
    const csvContent = fs.readFileSync(csvPath, 'latin1');
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    const header = lines[0].split(';').map(col => col.trim());
    
    // Buscar todos os transportadores existentes
    const transportersResult = await pool.query(`SELECT id, document_number FROM transporters WHERE document_number IS NOT NULL`);
    const transporterMap = new Map();
    
    transportersResult.rows.forEach(t => {
      const cleanDoc = t.document_number?.replace(/\D/g, '');
      if (cleanDoc) {
        transporterMap.set(cleanDoc, t.id);
      }
    });

    console.log(`🏢 Total de transportadores cadastrados: ${transporterMap.size}`);

    // Simular importação
    let canImport = 0;
    let cannotImport = 0;
    let duplicatePlates = 0;
    const seenPlates = new Set();

    // Buscar placas existentes
    const existingPlatesResult = await pool.query(`SELECT plate FROM vehicles`);
    const existingPlates = new Set(existingPlatesResult.rows.map(v => v.plate));

    console.log(`🚗 Placas já existentes no sistema: ${existingPlates.size}`);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const data = line.split(';').map(col => col.trim());
      const rowData = {};
      
      header.forEach((col, index) => {
        rowData[col] = data[index] || '';
      });

      const plate = rowData.placa?.toUpperCase();
      const transporterDoc = rowData.transportador_cpf_cnpj?.replace(/\D/g, '');

      // Verificar duplicatas na planilha
      if (seenPlates.has(plate)) {
        duplicatePlates++;
        continue;
      }
      seenPlates.add(plate);

      // Verificar se placa já existe no sistema
      if (existingPlates.has(plate)) {
        duplicatePlates++;
        continue;
      }

      // Verificar se transportador existe
      if (transporterDoc && transporterMap.has(transporterDoc)) {
        canImport++;
      } else {
        cannotImport++;
      }
    }

    console.log(`\n📊 RESULTADO DA SIMULAÇÃO:`);
    console.log(`✅ Veículos que podem ser importados: ${canImport}`);
    console.log(`❌ Veículos sem transportador: ${cannotImport}`);
    console.log(`🔄 Placas duplicadas (CSV + sistema): ${duplicatePlates}`);
    console.log(`📈 Taxa de sucesso esperada: ${Math.round((canImport / (canImport + cannotImport + duplicatePlates)) * 100)}%`);

    const totalVehicles = canImport + cannotImport + duplicatePlates;
    console.log(`📋 Total de veículos processados: ${totalVehicles}`);

    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testImport();