#!/usr/bin/env node

/**
 * Script para importar os 4.604 clientes do arquivo Excel para o sistema AET
 * Processa CSV gerado: attached_assets/dadosclientes_1752875553944.csv
 */

import fs from 'fs';
import csvParser from 'csv-parser';
import { Pool } from 'pg';

// Configuração do banco
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const LOTE_SIZE = 50;
const ARQUIVO_LOG = `import-clientes-${new Date().toISOString().slice(0, 10)}.log`;

function log(mensagem) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${mensagem}`;
  console.log(logMessage);
  fs.appendFileSync(ARQUIVO_LOG, logMessage + '\n');
}

function validarCNPJCPF(documento) {
  if (!documento) return false;
  const numeros = documento.replace(/\D/g, '');
  return numeros.length === 11 || numeros.length === 14;
}

function formatarTelefone(telefone) {
  if (!telefone) return '';
  // Remove todos os caracteres não numéricos
  const numeros = telefone.replace(/\D/g, '');
  // Formatar telefone brasileiro
  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  } else if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }
  return telefone;
}

function determinarTipoPessoa(documento) {
  const numeros = documento.replace(/\D/g, '');
  return numeros.length === 11 ? 'pf' : 'pj';
}

async function verificarExistente(documento) {
  const numeros = documento.replace(/\D/g, '');
  try {
    const result = await pool.query(
      'SELECT id, name FROM transporters WHERE "documentNumber" = $1',
      [numeros]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error(`Erro ao verificar existente: ${error.message}`);
    return null;
  }
}

async function inserirTransportador(dados) {
  const sql = `
    INSERT INTO transporters (
      name, 
      "tradeName", 
      "personType", 
      "documentNumber", 
      city, 
      state, 
      email, 
      phone, 
      subsidiaries, 
      documents, 
      "isActive"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, name
  `;
  
  const valores = [
    dados.name,
    dados.tradeName,
    dados.personType,
    dados.documentNumber,
    dados.city,
    dados.state,
    dados.email,
    dados.phone,
    JSON.stringify(dados.subsidiaries),
    JSON.stringify(dados.documents),
    dados.isActive
  ];
  
  try {
    const result = await pool.query(sql, valores);
    return result.rows[0];
  } catch (error) {
    throw new Error(`Erro ao inserir: ${error.message}`);
  }
}

async function processarCliente(linha) {
  try {
    // Extrair dados da linha
    const nome = linha.Nome?.trim();
    const documento = linha['CPF/CNPJ']?.trim();
    const telefone = linha.Numero?.trim();
    
    // Validações
    if (!nome || !documento) {
      throw new Error('Nome e documento são obrigatórios');
    }
    
    if (!validarCNPJCPF(documento)) {
      throw new Error(`Documento inválido: ${documento}`);
    }
    
    const numeroDocumento = documento.replace(/\D/g, '');
    
    // Verificar se já existe
    const existente = await verificarExistente(documento);
    if (existente) {
      return { 
        status: 'exists', 
        dados: existente,
        nome: nome
      };
    }
    
    // Preparar dados para inserção
    const dadosTransportador = {
      name: nome.toUpperCase(),
      tradeName: '',
      personType: determinarTipoPessoa(documento),
      documentNumber: numeroDocumento,
      city: '',
      state: '',
      email: '',
      phone: formatarTelefone(telefone),
      subsidiaries: [],
      documents: [],
      isActive: true
    };
    
    // Inserir no banco
    const novoTransportador = await inserirTransportador(dadosTransportador);
    
    return {
      status: 'created',
      dados: novoTransportador,
      nome: nome
    };
    
  } catch (error) {
    return {
      status: 'error',
      erro: error.message,
      nome: linha.Nome || 'N/A'
    };
  }
}

async function importarClientes() {
  const arquivoCSV = 'attached_assets/dadosclientes_1752875553944.csv';
  
  if (!fs.existsSync(arquivoCSV)) {
    log(`❌ Arquivo CSV não encontrado: ${arquivoCSV}`);
    process.exit(1);
  }
  
  log(`🚀 Iniciando importação de clientes do arquivo: ${arquivoCSV}`);
  
  const resultados = {
    total: 0,
    criados: 0,
    existentes: 0,
    erros: 0,
    listaErros: []
  };
  
  const clientes = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(arquivoCSV)
      .pipe(csvParser({ separator: ';' }))
      .on('data', (linha) => {
        clientes.push(linha);
      })
      .on('end', async () => {
        log(`📊 Total de registros lidos: ${clientes.length}`);
        resultados.total = clientes.length;
        
        try {
          // Processar em lotes
          for (let i = 0; i < clientes.length; i += LOTE_SIZE) {
            const lote = clientes.slice(i, i + LOTE_SIZE);
            const numeroLote = Math.floor(i / LOTE_SIZE) + 1;
            const totalLotes = Math.ceil(clientes.length / LOTE_SIZE);
            
            log(`🔄 Processando lote ${numeroLote}/${totalLotes} (${lote.length} registros)`);
            
            // Processar lote em paralelo
            const promessasLote = lote.map((cliente, indexLote) => {
              const indexGlobal = i + indexLote + 1;
              return processarCliente(cliente).then(resultado => ({
                ...resultado,
                index: indexGlobal
              }));
            });
            
            const resultadosLote = await Promise.all(promessasLote);
            
            // Processar resultados do lote
            resultadosLote.forEach(resultado => {
              if (resultado.status === 'created') {
                resultados.criados++;
                log(`✅ ${resultado.index}/${clientes.length} - Criado: ${resultado.nome} (ID: ${resultado.dados.id})`);
              } else if (resultado.status === 'exists') {
                resultados.existentes++;
                log(`⚠️  ${resultado.index}/${clientes.length} - Existe: ${resultado.nome} (ID: ${resultado.dados.id})`);
              } else if (resultado.status === 'error') {
                resultados.erros++;
                resultados.listaErros.push({
                  index: resultado.index,
                  nome: resultado.nome,
                  erro: resultado.erro
                });
                log(`❌ ${resultado.index}/${clientes.length} - Erro: ${resultado.nome} - ${resultado.erro}`);
              }
            });
            
            // Pausa entre lotes
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          // Relatório final
          log(`\n📈 RELATÓRIO FINAL DA IMPORTAÇÃO:`);
          log(`   📝 Total de registros processados: ${resultados.total}`);
          log(`   ✅ Transportadores criados: ${resultados.criados}`);
          log(`   ⚠️  Já existiam: ${resultados.existentes}`);
          log(`   ❌ Erros: ${resultados.erros}`);
          log(`   📊 Taxa de sucesso: ${((resultados.criados / resultados.total) * 100).toFixed(1)}%`);
          
          if (resultados.erros > 0) {
            log(`\n🚨 PRIMEIROS 10 ERROS:`);
            resultados.listaErros.slice(0, 10).forEach(erro => {
              log(`   ${erro.index}. ${erro.nome}: ${erro.erro}`);
            });
            
            if (resultados.listaErros.length > 10) {
              log(`   ... e mais ${resultados.listaErros.length - 10} erros`);
            }
          }
          
          log(`\n📄 Log detalhado salvo em: ${ARQUIVO_LOG}`);
          log(`🎉 Importação concluída!`);
          
          resolve(resultados);
          
        } catch (error) {
          log(`💥 Erro durante processamento: ${error.message}`);
          reject(error);
        }
      })
      .on('error', (error) => {
        log(`❌ Erro ao ler arquivo CSV: ${error.message}`);
        reject(error);
      });
  });
}

// Função principal
async function main() {
  try {
    // Testar conexão com banco
    await pool.query('SELECT 1');
    log('🔗 Conexão com banco de dados estabelecida');
    
    // Executar importação
    const resultados = await importarClientes();
    
    // Fechar conexão
    await pool.end();
    
    log('🏁 Processo finalizado com sucesso!');
    process.exit(0);
    
  } catch (error) {
    log(`💥 Erro fatal: ${error.message}`);
    await pool.end();
    process.exit(1);
  }
}

// Executar se for script principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importarClientes, processarCliente };