# Implementação no Servidor - Importação de 4.604 Clientes

## Resumo dos Dados
- **Total de registros:** 4.604 clientes
- **Colunas:** Nome, CPF/CNPJ, Telefone
- **Arquivo processado:** dadosclientes_1752875553944.xlsx → .csv

## Scripts Criados

### 1. `ler-excel-clientes.js` ✅
- Lê arquivo Excel e converte para CSV
- Mostra estrutura dos dados
- **Já executado com sucesso**

### 2. `importar-clientes-sistema.js` 🚀
- Importa os 4.604 clientes para o banco PostgreSQL
- Processa em lotes de 50 registros
- Gera log detalhado
- **Pronto para execução**

## Comandos para Executar no Servidor

### 1. Verificar Arquivo CSV (já criado)
```bash
ls -la attached_assets/dadosclientes_1752875553944.csv
head -5 attached_assets/dadosclientes_1752875553944.csv
```

### 2. Executar Importação
```bash
# Certificar que DATABASE_URL está configurado
echo $DATABASE_URL

# Executar importação
node importar-clientes-sistema.js
```

## O que o Script Faz

### ✅ Validações Automáticas:
- Verifica CNPJ/CPF (11 ou 14 dígitos)
- Detecta duplicatas por documento
- Valida campos obrigatórios

### ✅ Processamento Inteligente:
- Processa em lotes de 50 registros
- Determina tipo de pessoa (PF/PJ) automaticamente
- Formata telefones brasileiros
- Converte nomes para maiúsculas

### ✅ Controle de Qualidade:
- Registra todos os processos em log
- Continua mesmo com erros
- Gera relatório final estatístico
- Preserva duplicatas existentes

## Exemplo de Execução

```bash
# Saída esperada:
🚀 Iniciando importação de clientes do arquivo: attached_assets/dadosclientes_1752875553944.csv
🔗 Conexão com banco de dados estabelecida
📊 Total de registros lidos: 4604

🔄 Processando lote 1/93 (50 registros)
✅ 1/4604 - Criado: 01A FORMIGA COLETA E GERENCIAMENTO AMBIENTAL LTDA (ID: 123)
✅ 2/4604 - Criado: 1.040 TRANSPORTES LTDA (ID: 124)
⚠️  3/4604 - Existe: FRIBON TRANSPORTES LTDA (ID: 2)
...

📈 RELATÓRIO FINAL DA IMPORTAÇÃO:
   📝 Total de registros processados: 4604
   ✅ Transportadores criados: 4580
   ⚠️  Já existiam: 20
   ❌ Erros: 4
   📊 Taxa de sucesso: 99.5%
```

## Arquivos de Log

### `import-clientes-YYYY-MM-DD.log`
- Log detalhado de toda a importação
- Inclui timestamp de cada operação
- Útil para auditoria e troubleshooting

## Estrutura dos Dados Importados

```sql
-- Cada cliente será inserido como:
INSERT INTO transporters (
  name,              -- Nome da empresa/pessoa (maiúsculas)
  tradeName,         -- Vazio (será preenchido manualmente se necessário)
  personType,        -- 'pf' para CPF, 'pj' para CNPJ
  documentNumber,    -- Apenas números do documento
  city,              -- Vazio (será preenchido manualmente se necessário)
  state,             -- Vazio (será preenchido manualmente se necessário)
  email,             -- Vazio (será preenchido manualmente se necessário)
  phone,             -- Telefone formatado
  subsidiaries,      -- Array vazio
  documents,         -- Array vazio
  isActive           -- true
);
```

## Monitoramento Durante Execução

### Progresso em Tempo Real:
- Mostra lote atual (1/93)
- Exibe progresso individual (1/4604)
- Indica status de cada registro

### Tratamento de Erros:
- Documentos inválidos são rejeitados
- Nomes vazios são rejeitados
- Duplicatas são ignoradas (não são erro)

## Backup e Segurança

### Antes da Importação:
```bash
# Fazer backup da tabela transporters
pg_dump -t transporters $DATABASE_URL > backup_transporters_$(date +%Y%m%d).sql
```

### Rollback (se necessário):
```bash
# Restaurar backup
psql $DATABASE_URL < backup_transporters_YYYYMMDD.sql
```

## Próximos Passos

### 1. Executar Importação:
```bash
node importar-clientes-sistema.js
```

### 2. Verificar Resultados:
```bash
# Contar total de transportadores
psql $DATABASE_URL -c "SELECT COUNT(*) FROM transporters;"

# Ver últimos criados
psql $DATABASE_URL -c "SELECT id, name, \"documentNumber\" FROM transporters ORDER BY id DESC LIMIT 10;"
```

### 3. Completar Dados (opcional):
- Adicionar cidades/estados manualmente
- Incluir emails quando disponíveis
- Ajustar nomes fantasia conforme necessário

## Estimativa de Tempo

- **Processamento:** ~15-20 minutos para 4.604 registros
- **Lotes de 50:** 93 lotes total
- **Pausa entre lotes:** 200ms (para não sobrecarregar o banco)

## Contato e Suporte

Em caso de problemas:
1. Consulte o arquivo de log gerado
2. Verifique conexão com banco de dados
3. Confirme variável DATABASE_URL
4. Teste com lote menor primeiro (edite LOTE_SIZE)

## Comando Final

```bash
# Executar tudo de uma vez:
node importar-clientes-sistema.js 2>&1 | tee importacao_$(date +%Y%m%d_%H%M%S).txt
```

Este comando executa a importação e salva todo o output em arquivo para referência futura.