#!/usr/bin/env node

/**
 * Script completo para processar o arquivo Excel de clientes
 * Converte Excel → CSV → Importa para banco de dados
 */

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import csvParser from 'csv-parser';
import { db } from './server/db.js';
import { transporters } from './shared/schema.js';

async function processExcelFile(excelFilePath) {
  console.log(`🚀 Iniciando processamento de: ${excelFilePath}`);
  
  try {
    // Passo 1: Ler arquivo Excel
    console.log('📖 Lendo arquivo Excel...');
    const workbook = xlsx.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Passo 2: Converter para JSON para análise
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    console.log(`📊 Encontrados ${jsonData.length} registros na planilha`);
    
    // Passo 3: Mostrar estrutura dos dados
    if (jsonData.length > 0) {
      console.log('🔍 Estrutura dos dados (primeiro registro):');
      console.log(JSON.stringify(jsonData[0], null, 2));
      
      console.log('\n📋 Colunas encontradas:');
      Object.keys(jsonData[0]).forEach((key, index) => {
        console.log(`   ${index + 1}. ${key}`);
      });
    }
    
    // Passo 4: Mapear campos automaticamente
    const fieldMapping = detectFieldMapping(jsonData[0]);
    console.log('\n🎯 Mapeamento automático de campos:');
    Object.entries(fieldMapping).forEach(([key, value]) => {
      console.log(`   ${key} → ${value || 'NÃO ENCONTRADO'}`);
    });
    
    // Passo 5: Processar e importar dados
    console.log('\n⚡ Iniciando importação...');
    const results = await importTransportersFromData(jsonData, fieldMapping);
    
    // Passo 6: Relatório final
    console.log('\n📈 RELATÓRIO FINAL:');
    console.log(`   📝 Total de registros processados: ${results.total}`);
    console.log(`   ✅ Transportadores criados: ${results.created}`);
    console.log(`   ⚠️  Já existiam: ${results.exists}`);
    console.log(`   ❌ Erros: ${results.errors}`);
    
    if (results.errors > 0) {
      console.log('\n🚨 ERROS DETALHADOS:');
      results.errorList.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.nome}: ${error.erro}`);
      });
    }
    
    console.log('\n🎉 Processamento concluído!');
    return results;
    
  } catch (error) {
    console.error(`💥 Erro no processamento: ${error.message}`);
    throw error;
  }
}

function detectFieldMapping(firstRow) {
  const mapping = {
    nome: null,
    cnpj_cpf: null,
    tipo_pessoa: null,
    cidade: null,
    estado: null,
    email: null,
    telefone: null,
    observacoes: null
  };
  
  const keys = Object.keys(firstRow || {});
  
  // Detectar campo nome
  mapping.nome = keys.find(key => 
    /^(nome|razao|razão|empresa|company|name)$/i.test(key.trim())
  );
  
  // Detectar campo documento
  mapping.cnpj_cpf = keys.find(key => 
    /^(cnpj|cpf|documento|document|doc|rg)$/i.test(key.trim())
  );
  
  // Detectar campo tipo pessoa
  mapping.tipo_pessoa = keys.find(key => 
    /^(tipo|person|pessoa|pf|pj)$/i.test(key.trim())
  );
  
  // Detectar campo cidade
  mapping.cidade = keys.find(key => 
    /^(cidade|city|municipio|município)$/i.test(key.trim())
  );
  
  // Detectar campo estado
  mapping.estado = keys.find(key => 
    /^(estado|state|uf|sigla)$/i.test(key.trim())
  );
  
  // Detectar campo email
  mapping.email = keys.find(key => 
    /^(email|e-mail|mail|@)$/i.test(key.trim())
  );
  
  // Detectar campo telefone
  mapping.telefone = keys.find(key => 
    /^(telefone|phone|fone|tel|contato|whatsapp)$/i.test(key.trim())
  );
  
  // Detectar campo observações
  mapping.observacoes = keys.find(key => 
    /^(obs|observ|observações|observacoes|notas|notes|remarks)$/i.test(key.trim())
  );
  
  return mapping;
}

function normalizeData(row, fieldMapping) {
  const getValue = (fieldName) => {
    const columnName = fieldMapping[fieldName];
    return columnName ? row[columnName] : null;
  };
  
  const nome = getValue('nome');
  const documento = getValue('cnpj_cpf');
  
  if (!nome || !documento) {
    throw new Error('Nome e documento são obrigatórios');
  }
  
  // Limpar documento
  const documentoLimpo = documento.toString().replace(/\D/g, '');
  
  if (documentoLimpo.length !== 11 && documentoLimpo.length !== 14) {
    throw new Error(`Documento inválido: ${documento}`);
  }
  
  const tipoPessoa = getValue('tipo_pessoa');
  const personType = documentoLimpo.length === 11 ? 'pf' : 'pj';
  
  return {
    name: nome.toString().trim().toUpperCase(),
    documentNumber: documentoLimpo,
    personType: personType,
    city: getValue('cidade')?.toString().trim().toUpperCase() || '',
    state: getValue('estado')?.toString().trim().toUpperCase() || '',
    email: getValue('email')?.toString().trim().toLowerCase() || '',
    phone: getValue('telefone')?.toString().trim() || '',
    tradeName: '',
    subsidiaries: [],
    documents: [],
    isActive: true
  };
}

async function importTransportersFromData(data, fieldMapping) {
  const results = {
    total: data.length,
    created: 0,
    exists: 0,
    errors: 0,
    errorList: []
  };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    try {
      const transporterData = normalizeData(row, fieldMapping);
      
      // Verificar se já existe
      const existing = await db.query.transporters.findFirst({
        where: (transporters, { eq }) => eq(transporters.documentNumber, transporterData.documentNumber)
      });
      
      if (existing) {
        console.log(`⚠️  ${i + 1}/${data.length} - Já existe: ${transporterData.name}`);
        results.exists++;
        continue;
      }
      
      // Criar novo transportador
      const [newTransporter] = await db.insert(transporters).values(transporterData).returning();
      
      console.log(`✅ ${i + 1}/${data.length} - Criado: ${newTransporter.name} (ID: ${newTransporter.id})`);
      results.created++;
      
    } catch (error) {
      console.log(`❌ ${i + 1}/${data.length} - Erro: ${error.message}`);
      results.errors++;
      results.errorList.push({
        nome: row[fieldMapping.nome] || 'N/A',
        erro: error.message
      });
    }
  }
  
  return results;
}

// Execução principal
async function main() {
  const excelFile = process.argv[2] || 'attached_assets/dadosclientes_1752875553944.xlsx';
  
  if (!fs.existsSync(excelFile)) {
    console.error(`❌ Arquivo não encontrado: ${excelFile}`);
    console.log('\nUso: node processar-excel-clientes.js [arquivo.xlsx]');
    console.log('Exemplo: node processar-excel-clientes.js dadosclientes.xlsx');
    process.exit(1);
  }
  
  try {
    await processExcelFile(excelFile);
  } catch (error) {
    console.error(`💥 Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processExcelFile };