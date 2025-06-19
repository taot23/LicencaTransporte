# Guia de Sincronização de Licenças Aprovadas - Servidor Google Produção

## Visão Geral
Este guia orienta a sincronização das licenças aprovadas existentes no servidor de produção para a nova tabela `licencas_emitidas`, permitindo que o sistema de validação inteligente funcione corretamente.

## Pré-requisitos
- Acesso SSH ao servidor Google Cloud
- Backup do banco de dados PostgreSQL
- Permissões de administrador no sistema

## Opção 1: Execução via Script Node.js

### 1. Upload do Script
```bash
# Copiar o script para o servidor
scp sync-approved-licenses.js usuario@servidor:/var/www/aetlicensesystem/
```

### 2. Execução no Servidor
```bash
# Conectar via SSH
ssh usuario@servidor

# Navegar para o diretório
cd /var/www/aetlicensesystem/

# Executar o script
NODE_ENV=production node sync-approved-licenses.js
```

### 3. Log Esperado
```
🔄 Iniciando sincronização de licenças aprovadas...
📋 Encontradas X licenças com estados aprovados

🔍 Processando licença AET-2025-XXXX (ID: XXX)
  ✅ AL: teste01 (válida até 2025-12-31)
  ✅ BA: teste02 (válida até 2026-01-29)
  ...

🎉 Sincronização concluída!
📊 Estatísticas:
   - Licenças processadas: X
   - Estados sincronizados: Y
   - Total de licenças ativas na tabela: Z
```

## Opção 2: Execução via SQL Direto

### 1. Conectar ao PostgreSQL
```bash
# Conectar ao banco
psql -h localhost -U postgres -d aet_database
```

### 2. Executar Script SQL
```sql
-- Copiar e colar todo o conteúdo do arquivo sync-approved-licenses.sql
\i sync-approved-licenses.sql
```

### 3. Verificar Resultado
```sql
-- Verificar licenças sincronizadas
SELECT 
    estado,
    COUNT(*) as quantidade,
    MIN(data_validade) as primeira_validade,
    MAX(data_validade) as ultima_validade
FROM licencas_emitidas 
WHERE status = 'ativa'
GROUP BY estado 
ORDER BY estado;
```

## Instalação do Sistema de Sincronização Automática

### 1. Criar Função de Trigger
```sql
-- Executar no PostgreSQL
CREATE OR REPLACE FUNCTION sync_approved_license()
RETURNS TRIGGER AS $$
DECLARE
    state_info TEXT;
    state_name TEXT;
    state_status TEXT;
    state_validity TEXT;
    state_issued TEXT;
    aet_number TEXT;
    cnpj_selected TEXT;
    placa_tratora TEXT;
    placa_primeira TEXT;
    placa_segunda TEXT;
BEGIN
    -- (código completo da função já está implementado)
END;
$$ LANGUAGE plpgsql;
```

### 2. Criar Trigger
```sql
-- Executar no PostgreSQL
CREATE TRIGGER trigger_sync_approved_licenses
    AFTER UPDATE ON license_requests
    FOR EACH ROW
    EXECUTE FUNCTION sync_approved_license();
```

### 3. Adicionar Constraint Única
```sql
-- Executar no PostgreSQL
ALTER TABLE licencas_emitidas 
ADD CONSTRAINT IF NOT EXISTS unique_pedido_estado UNIQUE (pedido_id, estado);
```

## Verificações Pós-Sincronização

### 1. Verificar Total de Licenças
```sql
SELECT COUNT(*) as total_licencas_ativas 
FROM licencas_emitidas 
WHERE status = 'ativa';
```

### 2. Verificar Estados Únicos
```sql
SELECT DISTINCT estado 
FROM licencas_emitidas 
WHERE status = 'ativa'
ORDER BY estado;
```

### 3. Testar Validação
```sql
-- Testar para um estado específico
SELECT 
    estado,
    numero_licenca,
    data_validade,
    EXTRACT(DAY FROM data_validade - CURRENT_DATE) as dias_restantes,
    CASE 
        WHEN EXTRACT(DAY FROM data_validade - CURRENT_DATE) > 60 THEN 'BLOQUEADO'
        ELSE 'LIBERADO'
    END as status_validacao
FROM licencas_emitidas
WHERE estado = 'SP' -- alterar estado conforme necessário
  AND status = 'ativa'
  AND (
    placa_unidade_tratora IN ('PLACA1', 'PLACA2') OR
    placa_primeira_carreta IN ('PLACA1', 'PLACA2') OR
    placa_segunda_carreta IN ('PLACA1', 'PLACA2')
  );
```

## Reinicialização dos Serviços

### 1. Reiniciar PM2
```bash
# Reiniciar todos os processos
pm2 restart all

# Verificar status
pm2 status

# Ver logs
pm2 logs aet-license-system
```

### 2. Verificar Logs
```bash
# Logs do sistema
tail -f /var/log/pm2/aet-license-system-out.log

# Logs de erro
tail -f /var/log/pm2/aet-license-system-error.log
```

## Teste da Validação Inteligente

### 1. Acessar Sistema
```
https://seu-dominio.com/nova-licenca
```

### 2. Verificar Estados Bloqueados
- Estados com licenças vigentes > 60 dias devem aparecer em amarelo
- Estados sem licenças devem aparecer normais (verde/branco)
- Mensagem informativa deve mostrar data de validade

### 3. Logs de Validação
```bash
# Verificar logs de validação em tempo real
pm2 logs aet-license-system | grep "VALIDAÇÃO CRÍTICA"
```

## Troubleshooting

### Problema: Script não encontra licenças
**Solução:**
```sql
-- Verificar se existem licenças com estados aprovados
SELECT COUNT(*) 
FROM license_requests 
WHERE state_statuses IS NOT NULL 
  AND array_to_string(state_statuses, ',') LIKE '%:approved:%';
```

### Problema: Erro de permissão
**Solução:**
```bash
# Verificar permissões do usuário
sudo -u postgres psql -d aet_database -c "SELECT current_user;"

# Dar permissões se necessário
sudo -u postgres psql -d aet_database -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO usuario;"
```

### Problema: Constraint já existe
**Solução:**
```sql
-- Verificar constraints existentes
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'licencas_emitidas';

-- Remover constraint se necessário
ALTER TABLE licencas_emitidas DROP CONSTRAINT IF EXISTS unique_pedido_estado;
```

## Backup de Segurança

### Antes da Execução
```bash
# Backup da tabela license_requests
pg_dump -h localhost -U postgres -d aet_database -t license_requests > backup_license_requests.sql

# Backup da tabela licencas_emitidas (se existir)
pg_dump -h localhost -U postgres -d aet_database -t licencas_emitidas > backup_licencas_emitidas.sql
```

### Restauração em Caso de Problema
```bash
# Restaurar tabela
psql -h localhost -U postgres -d aet_database < backup_license_requests.sql
```

## Contato para Suporte
Em caso de problemas durante a execução, documente:
1. Mensagens de erro completas
2. Logs do sistema
3. Resultado dos comandos de verificação
4. Versão do PostgreSQL e Node.js

Este guia garante a sincronização segura e eficiente das licenças aprovadas no seu ambiente de produção.