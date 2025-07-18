#!/usr/bin/env node

/**
 * Script para converter arquivo Excel para CSV
 * Uso: node convert-excel-to-csv.js arquivo.xlsx
 */

import fs from 'fs';
import xlsx from 'xlsx';

function convertExcelToCSV(inputFile, outputFile) {
  try {
    console.log(`📁 Lendo arquivo Excel: ${inputFile}`);
    
    // Ler arquivo Excel
    const workbook = xlsx.readFile(inputFile);
    const sheetName = workbook.SheetNames[0]; // Primeira planilha
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📊 Processando planilha: ${sheetName}`);
    
    // Converter para CSV com separador ponto e vírgula
    const csvData = xlsx.utils.sheet_to_csv(worksheet, { FS: ';' });
    
    // Salvar arquivo CSV
    fs.writeFileSync(outputFile, csvData);
    
    console.log(`✅ Arquivo CSV criado: ${outputFile}`);
    console.log(`📝 Primeiras linhas do CSV:`);
    console.log(csvData.split('\n').slice(0, 3).join('\n'));
    
    return outputFile;
    
  } catch (error) {
    console.error(`❌ Erro ao converter Excel: ${error.message}`);
    throw error;
  }
}

async function main() {
  const inputFile = process.argv[2];
  
  if (!inputFile) {
    console.log(`
🔄 Conversor de Excel para CSV

Uso: node convert-excel-to-csv.js arquivo.xlsx

Este script irá:
- Ler a primeira planilha do Excel
- Converter para CSV com separador ponto e vírgula (;)
- Salvar como arquivo-convertido.csv
- Mostrar prévia dos dados
    `);
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Arquivo não encontrado: ${inputFile}`);
    process.exit(1);
  }

  const outputFile = inputFile.replace(/\.(xlsx|xls)$/i, '-convertido.csv');
  
  try {
    await convertExcelToCSV(inputFile, outputFile);
    console.log(`\n🎉 Conversão concluída!`);
    console.log(`\nPróximos passos:`);
    console.log(`1. Verifique o arquivo: ${outputFile}`);
    console.log(`2. Ajuste os cabeçalhos se necessário`);
    console.log(`3. Execute: node import-clients-script.js ${outputFile}`);
    
  } catch (error) {
    console.error(`💥 Erro na conversão: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { convertExcelToCSV };