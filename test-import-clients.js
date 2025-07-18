#!/usr/bin/env node

/**
 * Script de teste para importação de clientes
 * Testa a importação com dados do arquivo exemplo
 */

import { importClientsFromCSV } from './import-clients-script.js';

async function testImport() {
  try {
    console.log('🧪 Testando importação de clientes...\n');
    
    const results = await importClientsFromCSV('./exemplo-dados-clientes.csv');
    
    console.log('\n📊 Resultados do teste:');
    console.log(`   ✅ Criados: ${results.created}`);
    console.log(`   ⚠️  Já existiam: ${results.exists}`);
    console.log(`   ❌ Erros: ${results.errors}`);
    
    if (results.errors > 0) {
      console.log('\n🚨 Erros encontrados:');
      results.errorList.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.cliente}: ${error.erro}`);
      });
    }
    
    console.log('\n🎉 Teste concluído!');
    
  } catch (error) {
    console.error(`💥 Erro no teste: ${error.message}`);
    process.exit(1);
  }
}

testImport();