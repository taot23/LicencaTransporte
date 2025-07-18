#!/usr/bin/env node

/**
 * Script para ler e analisar arquivo Excel de clientes
 * Mostra estrutura dos dados sem fazer importação
 */

import fs from 'fs';
import xlsx from 'xlsx';

function lerArquivoExcel(caminhoArquivo) {
  console.log(`📖 Lendo arquivo: ${caminhoArquivo}`);
  
  try {
    // Ler arquivo Excel
    const workbook = xlsx.readFile(caminhoArquivo);
    const nomeAba = workbook.SheetNames[0];
    const planilha = workbook.Sheets[nomeAba];
    
    console.log(`📊 Processando aba: ${nomeAba}`);
    
    // Converter para JSON
    const dadosJson = xlsx.utils.sheet_to_json(planilha);
    
    console.log(`📈 Total de registros: ${dadosJson.length}`);
    
    if (dadosJson.length > 0) {
      console.log('\n🔍 Estrutura dos dados (primeiros 3 registros):');
      console.log('='.repeat(80));
      
      // Mostrar primeiros 3 registros
      dadosJson.slice(0, 3).forEach((linha, index) => {
        console.log(`\n📋 Registro ${index + 1}:`);
        Object.entries(linha).forEach(([coluna, valor]) => {
          console.log(`   ${coluna}: ${valor}`);
        });
      });
      
      console.log('\n📝 Colunas encontradas:');
      Object.keys(dadosJson[0]).forEach((coluna, index) => {
        console.log(`   ${index + 1}. ${coluna}`);
      });
      
      // Converter para CSV
      const csvData = xlsx.utils.sheet_to_csv(planilha, { FS: ';' });
      const nomeArquivoCSV = caminhoArquivo.replace(/\.(xlsx|xls)$/i, '.csv');
      
      fs.writeFileSync(nomeArquivoCSV, csvData);
      console.log(`\n💾 Arquivo CSV criado: ${nomeArquivoCSV}`);
      
      // Mostrar primeiras linhas do CSV
      const linhasCSV = csvData.split('\n');
      console.log('\n📄 Primeiras linhas do CSV:');
      linhasCSV.slice(0, 5).forEach((linha, index) => {
        console.log(`   ${index + 1}. ${linha}`);
      });
      
      return {
        totalRegistros: dadosJson.length,
        colunas: Object.keys(dadosJson[0]),
        dados: dadosJson,
        arquivoCSV: nomeArquivoCSV
      };
    }
    
  } catch (erro) {
    console.error(`❌ Erro ao ler arquivo Excel: ${erro.message}`);
    throw erro;
  }
}

// Execução principal
function main() {
  const arquivoExcel = process.argv[2] || 'attached_assets/dadosclientes_1752875553944.xlsx';
  
  if (!fs.existsSync(arquivoExcel)) {
    console.error(`❌ Arquivo não encontrado: ${arquivoExcel}`);
    console.log('\nUso: node ler-excel-clientes.js [arquivo.xlsx]');
    process.exit(1);
  }
  
  try {
    const resultado = lerArquivoExcel(arquivoExcel);
    
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('1. Verifique se os dados estão corretos');
    console.log('2. Identifique quais colunas correspondem a:');
    console.log('   - Nome da empresa/pessoa');
    console.log('   - CNPJ ou CPF');
    console.log('   - Cidade');
    console.log('   - Estado');
    console.log('   - Email');
    console.log('   - Telefone');
    console.log(`3. Use o arquivo CSV criado: ${resultado.arquivoCSV}`);
    console.log('4. Ajuste os cabeçalhos conforme necessário');
    console.log('5. Execute o script de importação');
    
  } catch (erro) {
    console.error(`💥 Erro: ${erro.message}`);
    process.exit(1);
  }
}

main();