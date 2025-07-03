# Guia de Troubleshooting - Validação de Licenças Vigentes

## 🔍 Problema Identificado
A validação de licenças vigentes não está funcionando no servidor Google.

## 📋 Possíveis Causas

### 1. Tabela `licencas_emitidas` vazia ou inexistente
**Sintoma**: Todas as validações retornam "liberado" mesmo para placas que deveriam estar bloqueadas.

### 2. Dados não sincronizados
**Sintoma**: Licenças aprovadas não aparecem na tabela de licenças emitidas.

### 3. Problemas de conexão com banco
**Sintoma**: Erros de timeout ou conexão nas consultas.

## 🔧 Solução Passo a Passo

### Passo 1: Diagnóstico Completo
```bash
cd /var/www/aetlicensesystem/LicencaTransporte
node diagnostico-validacao-google.js
```

### Passo 2: Teste Específico
```bash
node teste-validacao-servidor.js
```

### Passo 3: Correção Automática (se necessário)
```bash
node corrigir-validacao-google.js
```

### Passo 4: Reiniciar Serviços
```bash
pm2 restart ecosystem.config.js
pm2 save
```

### Passo 5: Verificar Logs
```bash
pm2 logs aet-license-system
```

## 🧪 Testes Manuais

### Teste 1: Via Navegador
1. Acesse: `/nova-licenca`
2. Selecione um transportador
3. Preencha placas: BDI1A71, BCB0886, BCB0887
4. Selecione estados: AL, BA, CE, DF, DNIT, MG, MS
5. **Resultado esperado**: Estados com licenças >60 dias devem aparecer em amarelo/bloqueados

### Teste 2: Via API (Postman/curl)
```bash
curl -X POST http://localhost:5000/api/validacao-critica \
  -H "Content-Type: application/json" \
  -d '{"estado": "MG", "placas": ["BDI1A71", "BCB0886", "BCB0887"]}'
```

**Resultado esperado para MG**: `{"bloqueado": true}` (se há licença >60 dias)

### Teste 3: Verificação Direta no Banco
```sql
SELECT 
  estado,
  numero_licenca,
  data_validade,
  EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) as dias_restantes,
  CASE 
    WHEN EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) > 60 THEN 'BLOQUEADO'
    ELSE 'LIBERADO'
  END as status_validacao
FROM licencas_emitidas
WHERE status = 'ativa'
  AND data_validade > CURRENT_DATE
  AND (
    placa_unidade_tratora = 'BDI1A71' OR
    placa_primeira_carreta = 'BCB0886' OR
    placa_segunda_carreta = 'BCB0887'
  )
ORDER BY estado;
```

## 📊 Estados de Teste Conhecidos

Com as placas BDI1A71 + BCB0886 + BCB0887:

| Estado | Status Esperado | Motivo |
|--------|----------------|---------|
| AL | BLOQUEADO | Licença >60 dias |
| BA | BLOQUEADO | Licença >60 dias |
| CE | BLOQUEADO | Licença >60 dias |
| DF | BLOQUEADO | Licença >60 dias |
| DNIT | BLOQUEADO | Licença >60 dias |
| MG | BLOQUEADO | Licença >60 dias |
| MS | BLOQUEADO | Licença >60 dias |
| SP | LIBERADO | Licença ≤60 dias |
| RJ | LIBERADO | Sem licenças |

## 🚨 Problemas Comuns e Soluções

### Problema: "Tabela licencas_emitidas não existe"
```bash
# Solução
node corrigir-validacao-google.js
```

### Problema: "Tabela vazia (COUNT = 0)"
```bash
# Solução
node sync-approved-licenses.js
pm2 restart ecosystem.config.js
```

### Problema: "Erro de conexão com banco"
```bash
# Verificar variável de ambiente
echo $DATABASE_URL

# Se vazia, adicionar ao .env
echo "DATABASE_URL=sua_connection_string" >> .env
```

### Problema: "Validação sempre retorna liberado"
1. Verificar se dados foram sincronizados
2. Conferir logs do PM2
3. Testar consulta SQL diretamente
4. Verificar se frontend está chamando endpoints corretos

## 📋 Checklist de Verificação

- [ ] Tabela `licencas_emitidas` existe
- [ ] Tabela tem dados (COUNT > 0)
- [ ] Licenças BDI1A71 estão sincronizadas
- [ ] Consulta SQL funciona manualmente
- [ ] Endpoint `/api/validacao-critica` responde
- [ ] Frontend chama validação corretamente
- [ ] PM2 está rodando sem erros
- [ ] Logs não mostram erros de conexão

## 🆘 Se Nada Funcionar

1. **Backup do banco atual**
2. **Executar migração completa**:
   ```bash
   npm run db:push
   node sync-approved-licenses.js
   ```
3. **Reiniciar tudo**:
   ```bash
   pm2 restart all
   pm2 save
   ```
4. **Testar novamente**

## 📞 Logs para Análise

Sempre verificar os logs antes de reportar problemas:

```bash
# Logs gerais
pm2 logs aet-license-system

# Logs específicos de validação (buscar por "VALIDAÇÃO")
pm2 logs aet-license-system | grep "VALIDAÇÃO"

# Logs de erro
pm2 logs aet-license-system --err
```