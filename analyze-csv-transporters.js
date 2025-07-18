#!/usr/bin/env node

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ler o arquivo CSV
const csvPath = join(__dirname, 'attached_assets', 'modelo_veiculos (6)_1752867361081.csv');
const csvContent = fs.readFileSync(csvPath, 'latin1'); // Usar latin1 para ler corretamente

console.log('📊 ANÁLISE DO ARQUIVO CSV DE VEÍCULOS\n');

const lines = csvContent.split('\n').filter(line => line.trim());
console.log(`Total de linhas no CSV: ${lines.length}`);
console.log(`Linhas de dados (excluindo header): ${lines.length - 1}\n`);

const header = lines[0].split(';').map(col => col.trim());
console.log('📋 Colunas encontradas:', header.join(', '), '\n');

// Analisar transportadores únicos
const transporters = new Set();
const vehicleTypes = new Set();
const plates = new Set();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  const data = line.split(';').map(col => col.trim());
  const rowData = {};
  
  header.forEach((col, index) => {
    rowData[col] = data[index] || '';
  });

  if (rowData.transportador_cpf_cnpj) {
    transporters.add(rowData.transportador_cpf_cnpj.replace(/\D/g, ''));
  }
  
  if (rowData.tipo_veiculo) {
    vehicleTypes.add(rowData.tipo_veiculo);
  }
  
  if (rowData.placa) {
    plates.add(rowData.placa.toUpperCase());
  }
}

console.log(`🚛 Transportadores únicos no CSV: ${transporters.size}`);
console.log(`🚗 Veículos únicos no CSV: ${plates.size}`);
console.log(`🔧 Tipos de veículos encontrados: ${vehicleTypes.size}`);

console.log('\n📋 TIPOS DE VEÍCULOS NO CSV:');
Array.from(vehicleTypes).sort().forEach(type => {
  console.log(`  - ${type}`);
});

console.log('\n🏢 PRIMEIROS 20 TRANSPORTADORES (CNPJ/CPF):');
Array.from(transporters).slice(0, 20).forEach((doc, index) => {
  console.log(`  ${index + 1}. ${doc}`);
});

if (transporters.size > 20) {
  console.log(`  ... e mais ${transporters.size - 20} transportadores\n`);
}

console.log('📈 RESUMO ESTATÍSTICO:');
console.log(`  • Total de registros: ${lines.length - 1}`);
console.log(`  • Transportadores únicos: ${transporters.size}`);
console.log(`  • Veículos únicos: ${plates.size}`);
console.log(`  • Tipos de veículos: ${vehicleTypes.size}`);
console.log(`  • Média de veículos por transportador: ${Math.round((plates.size / transporters.size) * 100) / 100}`);