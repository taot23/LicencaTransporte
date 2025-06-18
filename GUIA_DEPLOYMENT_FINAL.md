# Guia Definitivo de Deployment - Sistema AET Produção

## Resumo da Versão
**Sistema AET com Validação Inteligente Completa (17/06/2025)**
- Validação para todos os 27 estados brasileiros + DNIT, ANTT, PRF
- Bloqueio automático de estados com licenças vigentes >60 dias
- Dados reais da tabela `licencas_emitidas`
- Interface original mantida com validação em tempo real

## Passos Rápidos para Deployment

### 1. Preparação no Servidor
```bash
# 1. Clonar/atualizar código
git clone seu-repositorio aet-system
cd aet-system

# 2. Configurar ambiente
cp .env.production.example .env.production
# Edite .env.production com suas configurações

# 3. Executar deployment automatizado
./deploy-production.sh
```

### 2. Configurações Essenciais

**Arquivo .env.production (editar antes do deployment):**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://usuario:senha@localhost:5432/aet_production
UPLOAD_DIR=/var/uploads
SESSION_SECRET=sua_chave_muito_longa_e_segura
PORT=5000
```

### 3. Verificação Pós-Deployment
```bash
# Status da aplicação
pm2 status

# Logs em tempo real
pm2 logs aet-system

# Teste da validação inteligente
curl -X POST http://localhost:5000/api/validacao-critica \
  -H "Content-Type: application/json" \
  -d '{"estado":"MG","placas":["ABC1234"]}'
```

## Funcionalidades da Nova Versão

### Sistema de Validação Inteligente
- **Endpoint:** `POST /api/validacao-critica`
- **Validação:** Todos os 27 estados + órgãos federais
- **Regra:** Bloqueia estados com licenças >60 dias
- **Dados:** Tabela `licencas_emitidas` em produção

### Melhorias no Frontend
- Botão "Selecionar Todos" com validação individual
- Remoção automática de estados bloqueados
- Interface original mantida
- Prevenção de condições de corrida

## Comandos de Monitoramento

```bash
# Status completo
pm2 monit

# Reiniciar se necessário
pm2 restart aet-system

# Backup manual do banco
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Verificar espaço de uploads
df -h /var/uploads
```

## Solução de Problemas

### Validação não funciona
```bash
# Verificar logs específicos
pm2 logs aet-system | grep "VALIDAÇÃO CRÍTICA"

# Verificar tabela licencas_emitidas
psql $DATABASE_URL -c "SELECT COUNT(*) FROM licencas_emitidas;"
```

### Aplicação não inicia
```bash
# Ver erros detalhados
pm2 logs aet-system --err

# Verificar dependências
npm list --production
```

### Performance lenta
```bash
# Monitorar recursos
pm2 monit

# Verificar banco de dados
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('aet_production'));"
```

## Arquivos de Produção Incluídos

1. **deploy-production.sh** - Script automatizado de deployment
2. **.env.production.example** - Template de configuração
3. **ecosystem.config.js** - Configuração PM2 para produção
4. **server/production-server.js** - Servidor dedicado sem Vite
5. **DEPLOYMENT_PRODUCTION.md** - Documentação detalhada

## Contato e Suporte

O sistema está pronto para produção com todas as validações necessárias. 

Para problemas específicos, verificar logs com foco na validação:
```bash
pm2 logs aet-system | grep -E "(VALIDAÇÃO|ERROR|BLOQUEADO)"
```