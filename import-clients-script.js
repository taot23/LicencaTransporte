#!/usr/bin/env node

/**
 * Script para importação em massa de transportadores/clientes
 * Uso: node import-clients-script.js dados_clientes.csv
 * 
 * Formato esperado do CSV (separado por ponto e vírgula):
 * nome;cnpj_cpf;tipo_pessoa;cidade;estado;email;telefone;observacoes
 */

import fs from 'fs';
import csvParser from 'csv-parser';
import { db } from './server/db.js';
import { transporters } from './shared/schema.js';
import bcrypt from 'bcrypt';

const BATCH_SIZE = 10;
const LOG_FILE = `import-clients-${new Date().toISOString().slice(0, 10)}.log`;

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function formatCNPJCPF(documento) {
  if (!documento) return '';
  
  // Remove caracteres não numéricos
  const numbers = documento.replace(/\D/g, '');
  
  if (numbers.length === 11) {
    // CPF: 000.000.000-00
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (numbers.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return numbers; // Retorna apenas números se não for CPF nem CNPJ
}

function validateCNPJCPF(documento) {
  const numbers = documento.replace(/\D/g, '');
  return numbers.length === 11 || numbers.length === 14;
}

function normalizePersonType(tipo) {
  if (!tipo) return 'pj';
  
  const tipoLower = tipo.toLowerCase().trim();
  if (tipoLower.includes('fisica') || tipoLower === 'pf' || tipoLower === 'cpf') {
    return 'pf';
  }
  return 'pj';
}

async function processClientData(clientData) {
  try {
    // Validar dados obrigatórios
    if (!clientData.nome || !clientData.cnpj_cpf) {
      throw new Error('Nome e CNPJ/CPF são obrigatórios');
    }

    if (!validateCNPJCPF(clientData.cnpj_cpf)) {
      throw new Error('CNPJ/CPF inválido');
    }

    const documentNumber = clientData.cnpj_cpf.replace(/\D/g, '');
    
    // Verificar se já existe
    const existing = await db.query.transporters.findFirst({
      where: (transporters, { eq }) => eq(transporters.documentNumber, documentNumber)
    });

    if (existing) {
      log(`⚠️  Cliente já existe: ${clientData.nome} (${formatCNPJCPF(documentNumber)})`);
      return { status: 'exists', data: existing };
    }

    // Preparar dados para inserção
    const transporterData = {
      name: clientData.nome.trim().toUpperCase(),
      tradeName: clientData.nome_fantasia?.trim() || '',
      personType: normalizePersonType(clientData.tipo_pessoa),
      documentNumber: documentNumber,
      city: clientData.cidade?.trim().toUpperCase() || '',
      state: clientData.estado?.trim().toUpperCase() || '',
      email: clientData.email?.trim().toLowerCase() || '',
      phone: clientData.telefone?.trim() || '',
      subsidiaries: [],
      documents: [],
      isActive: true
    };

    // Inserir no banco
    const [newTransporter] = await db.insert(transporters).values(transporterData).returning();
    
    log(`✅ Cliente cadastrado: ${newTransporter.name} (ID: ${newTransporter.id})`);
    return { status: 'created', data: newTransporter };

  } catch (error) {
    log(`❌ Erro ao processar cliente ${clientData.nome}: ${error.message}`);
    return { status: 'error', error: error.message, data: clientData };
  }
}

async function importClientsFromCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    log(`❌ Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  log(`📁 Iniciando importação de clientes do arquivo: ${filePath}`);
  
  const clients = [];
  const results = {
    total: 0,
    created: 0,
    exists: 0,
    errors: 0,
    errorList: []
  };

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser({ separator: ';' }))
      .on('data', (row) => {
        clients.push({
          nome: row.nome || row.NOME,
          nome_fantasia: row.nome_fantasia || row.NOME_FANTASIA || row['nome fantasia'],
          cnpj_cpf: row.cnpj_cpf || row.CNPJ_CPF || row.cnpj || row.CNPJ || row.cpf || row.CPF,
          tipo_pessoa: row.tipo_pessoa || row.TIPO_PESSOA || row.tipo || row.TIPO,
          cidade: row.cidade || row.CIDADE,
          estado: row.estado || row.ESTADO || row.uf || row.UF,
          email: row.email || row.EMAIL,
          telefone: row.telefone || row.TELEFONE || row.phone || row.PHONE,
          observacoes: row.observacoes || row.OBSERVACOES || row.obs || row.OBS
        });
      })
      .on('end', async () => {
        log(`📊 Total de registros lidos: ${clients.length}`);
        results.total = clients.length;

        // Processar em lotes
        for (let i = 0; i < clients.length; i += BATCH_SIZE) {
          const batch = clients.slice(i, i + BATCH_SIZE);
          log(`🔄 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(clients.length / BATCH_SIZE)}`);

          const batchPromises = batch.map(client => processClientData(client));
          const batchResults = await Promise.all(batchPromises);

          batchResults.forEach(result => {
            if (result.status === 'created') {
              results.created++;
            } else if (result.status === 'exists') {
              results.exists++;
            } else if (result.status === 'error') {
              results.errors++;
              results.errorList.push({
                cliente: result.data?.nome || 'N/A',
                erro: result.error
              });
            }
          });

          // Pequena pausa entre lotes
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Relatório final
        log(`\n📈 RELATÓRIO FINAL:`);
        log(`   Total de registros: ${results.total}`);
        log(`   ✅ Criados: ${results.created}`);
        log(`   ⚠️  Já existiam: ${results.exists}`);
        log(`   ❌ Erros: ${results.errors}`);

        if (results.errors > 0) {
          log(`\n🚨 ERROS DETALHADOS:`);
          results.errorList.forEach((error, index) => {
            log(`   ${index + 1}. ${error.cliente}: ${error.erro}`);
          });
        }

        log(`\n📄 Log salvo em: ${LOG_FILE}`);
        resolve(results);
      })
      .on('error', (error) => {
        log(`❌ Erro ao ler arquivo CSV: ${error.message}`);
        reject(error);
      });
  });
}

// Exemplo de uso
async function main() {
  try {
    const csvFile = process.argv[2];
    
    if (!csvFile) {
      console.log(`
🚀 Script de Importação de Clientes/Transportadores

Uso: node import-clients-script.js arquivo.csv

Formato CSV esperado (separado por ponto e vírgula):
nome;cnpj_cpf;tipo_pessoa;cidade;estado;email;telefone;observacoes

Exemplo:
TRANSPORTADORA EXEMPLO LTDA;12.345.678/0001-90;pj;SÃO PAULO;SP;contato@exemplo.com;(11) 99999-9999;Cliente VIP

Campos obrigatórios: nome, cnpj_cpf
Campos opcionais: tipo_pessoa (pf/pj, padrão: pj), cidade, estado, email, telefone, observacoes

O script irá:
- Validar CNPJ/CPF
- Verificar duplicatas
- Processar em lotes para melhor performance  
- Gerar log detalhado
- Criar relatório final
      `);
      process.exit(1);
    }

    await importClientsFromCSV(csvFile);
    log('🎉 Importação concluída com sucesso!');
    
  } catch (error) {
    log(`💥 Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importClientsFromCSV, processClientData };