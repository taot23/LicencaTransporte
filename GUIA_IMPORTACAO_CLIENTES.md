# Guia de Importação de Clientes/Transportadores

## Visão Geral
Este guia explica como importar clientes/transportadores em massa para o sistema AET usando os scripts desenvolvidos.

## Scripts Disponíveis

### 1. `convert-excel-to-csv.js`
**Função:** Converte arquivos Excel (.xlsx/.xls) para CSV
**Uso:** 
```bash
node convert-excel-to-csv.js dadosclientes.xlsx
```

### 2. `import-clients-script.js`
**Função:** Importa clientes de arquivo CSV para o banco de dados
**Uso:**
```bash
node import-clients-script.js arquivo.csv
```

### 3. `test-import-clients.js`
**Função:** Testa a importação com dados de exemplo
**Uso:**
```bash
node test-import-clients.js
```

## Formato dos Dados

### Cabeçalhos Obrigatórios no CSV:
- `nome` - Nome da empresa/pessoa (obrigatório)
- `cnpj_cpf` - CNPJ ou CPF (obrigatório)
- `tipo_pessoa` - "pj" ou "pf" (opcional, padrão: pj)
- `cidade` - Cidade (opcional)
- `estado` - Estado com 2 letras (opcional)
- `email` - Email de contato (opcional)
- `telefone` - Telefone (opcional)
- `observacoes` - Observações adicionais (opcional)

### Exemplo de CSV:
```csv
nome;cnpj_cpf;tipo_pessoa;cidade;estado;email;telefone;observacoes
TRANSPORTADORA EXEMPLO LTDA;12.345.678/0001-90;pj;SÃO PAULO;SP;contato@exemplo.com;(11) 99999-9999;Cliente VIP
JOÃO SILVA;123.456.789-01;pf;RIO DE JANEIRO;RJ;joao@silva.com;(21) 88888-8888;Transportador autônomo
```

## Passo a Passo

### 1. Preparar os Dados
1. **Se você tem um arquivo Excel:**
   ```bash
   node convert-excel-to-csv.js dadosclientes.xlsx
   ```
   - Isso criará um arquivo `dadosclientes-convertido.csv`

2. **Se você tem um arquivo CSV:**
   - Verifique se os cabeçalhos estão corretos
   - Use ponto e vírgula (;) como separador

### 2. Executar Importação
```bash
node import-clients-script.js dadosclientes-convertido.csv
```

### 3. Verificar Resultados
O script irá:
- ✅ Mostrar progresso em tempo real
- ✅ Validar CNPJ/CPF automaticamente
- ✅ Detectar duplicatas
- ✅ Gerar log detalhado
- ✅ Criar relatório final

## Exemplo de Execução

```bash
# Passo 1: Converter Excel para CSV
node convert-excel-to-csv.js dadosclientes.xlsx

# Saída:
# 📁 Lendo arquivo Excel: dadosclientes.xlsx
# 📊 Processando planilha: Sheet1
# ✅ Arquivo CSV criado: dadosclientes-convertido.csv

# Passo 2: Importar dados
node import-clients-script.js dadosclientes-convertido.csv

# Saída:
# 📁 Iniciando importação de clientes do arquivo: dadosclientes-convertido.csv
# 📊 Total de registros lidos: 50
# 🔄 Processando lote 1/5
# ✅ Cliente cadastrado: TRANSPORTADORA EXEMPLO LTDA (ID: 123)
# ⚠️  Cliente já existe: FRIBON TRANSPORTES LTDA (12.345.678/0001-90)
# 
# 📈 RELATÓRIO FINAL:
#    Total de registros: 50
#    ✅ Criados: 45
#    ⚠️  Já existiam: 3
#    ❌ Erros: 2
```

## Validações Automáticas

### ✅ O script verifica:
- CNPJ/CPF válidos (11 ou 14 dígitos)
- Duplicatas por documento
- Dados obrigatórios preenchidos
- Formato correto dos dados

### ⚠️ Comportamento para duplicatas:
- Se o CNPJ/CPF já existe, o cliente é ignorado
- Uma mensagem de aviso é exibida
- O processo continua normalmente

### ❌ Tratamento de erros:
- Documentos inválidos são rejeitados
- Dados obrigatórios faltando geram erro
- Erros são registrados no log
- O processo continua mesmo com erros

## Arquivos Gerados

### Log de Importação
- Nome: `import-clients-YYYY-MM-DD.log`
- Contém: Todos os detalhes da importação
- Útil para: Auditoria e troubleshooting

### Relatório Final
- Resumo estatístico
- Lista de erros detalhada
- Clientes criados vs. rejeitados

## Dicas Importantes

### 🎯 Antes de Importar:
1. Faça backup do banco de dados
2. Teste com poucos registros primeiro
3. Verifique o formato dos dados
4. Confirme que os cabeçalhos estão corretos

### 🚀 Durante a Importação:
- O script processa em lotes de 10 registros
- Logs são exibidos em tempo real
- Interromper com Ctrl+C é seguro

### 📊 Após a Importação:
- Verifique o relatório final
- Consulte o log para detalhes
- Acesse o sistema para confirmar

## Troubleshooting

### Erro: "Arquivo não encontrado"
**Solução:** Verifique o caminho do arquivo

### Erro: "CNPJ/CPF inválido"
**Solução:** Verifique se os documentos têm 11 ou 14 dígitos

### Erro: "Nome é obrigatório"
**Solução:** Verifique se a coluna 'nome' está preenchida

### Erro: "Duplicata detectada"
**Solução:** Normal, o sistema evita duplicatas automaticamente

## Suporte

Para problemas ou dúvidas:
1. Consulte o arquivo de log gerado
2. Verifique o formato dos dados
3. Teste com arquivo de exemplo primeiro
4. Entre em contato com o suporte técnico

## Exemplo de Arquivo de Teste

Use o arquivo `exemplo-dados-clientes.csv` para testar:
```bash
node test-import-clients.js
```

Este arquivo contém dados de exemplo que você pode usar para entender o formato esperado.