# Sistema AET - Licenças de Transporte

## Visão Geral
Sistema robusto de gestão de licenças AET (Autorização Especial de Trânsito) e veículos com otimizações avançadas de performance server-side e resiliência de deployment.

**Tecnologias:**
- Frontend: React.js com TypeScript
- Backend: Node.js/Express 
- Banco de dados: PostgreSQL
- Comunicação em tempo real: WebSocket
- Validação: Zod schemas
- Design: Tailwind CSS responsivo
- Deploy: PM2 com estratégias avançadas
- Monitoramento: Logging completo de produção

## Arquitetura do Projeto

### Sistema de Uploads Externos (13/06/2025)
**Problema resolvido:** Arquivos de upload eram perdidos durante reinstalações do projeto.

**Solução implementada:**
- Configuração automática de diretório externo em `server/routes.ts`
- Ordem de prioridade para localização de uploads:
  1. `UPLOAD_DIR` (variável de ambiente)
  2. `/var/uploads` (produção)
  3. `/tmp/uploads` (fallback)
  4. `../uploads` (um nível acima do projeto)
  5. `./uploads` (último recurso)

**Configuração técnica:**
- Subpastas organizadas: `vehicles/` e `transporter/`
- Detecção automática de permissões de escrita
- Logging detalhado da configuração escolhida
- Endpoint `/uploads` serve arquivos estáticos da pasta externa

### Servidor de Produção (13/06/2025)
**Problema resolvido:** Erros de permissão do Vite em produção no servidor Google.

**Solução implementada:**
- Arquivo `server/production-server.js` dedicado para produção
- Configuração PM2 atualizada em `ecosystem.config.js`
- Eliminação de dependências do Vite em ambiente de produção
- Detecção automática de build frontend disponível

## Mudanças Recentes

### 13/06/2025 - Módulo Financeiro Implementado
- ✅ Criado sistema completo de gestão de boletos brasileiros
- ✅ Interface administrativa em `/admin/boletos` com CRUD completo
- ✅ Formulário de criação/edição com upload de arquivos (boleto e NF)
- ✅ Validação e formatação de dados financeiros brasileiros
- ✅ Papel de usuário "financial" adicionado com permissões específicas
- ✅ Navegação na sidebar para usuários admin e financial
- ✅ Integração com sistema de uploads externos
- ✅ Layout corrigido para seguir padrão das outras páginas com sidebar lateral
- ✅ Métodos de boletos implementados na TransactionalStorage (PostgreSQL)

### 13/06/2025 - Configuração de Uploads Externos
- ✅ Implementado sistema de detecção automática de diretório de uploads
- ✅ Configuração de subpastas organizadas para veículos e transportadores
- ✅ Endpoint de arquivos estáticos configurado para pasta externa
- ✅ Logging detalhado da configuração de uploads
- ✅ Fallback inteligente para diferentes ambientes de deployment

### 13/06/2025 - Servidor de Produção Dedicado
- ✅ Criado `server/production-server.js` para evitar problemas do Vite
- ✅ Atualizado `ecosystem.config.js` para usar servidor dedicado
- ✅ Configurações de restart delay para evitar loops
- ✅ Documentação de deployment em `PRODUCTION_DEPLOYMENT.md`

## Preferências do Usuário
- Idioma: Português brasileiro
- Foco: Manter arquivos seguros durante reinstalações
- Prioridade: Estabilidade em produção sobre conveniência de desenvolvimento

## Configuração de Deployment

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
pm2 start ecosystem.config.js
pm2 save
```

### Variáveis de Ambiente Importantes
- `UPLOAD_DIR`: Localização personalizada para uploads
- `NODE_ENV=production`: Ativa modo de produção
- `DATABASE_URL`: Conexão PostgreSQL

## Logs e Monitoramento
- Upload directory: Detectado automaticamente e logado na inicialização
- PM2 logs: `/var/log/pm2/aet-license-system-*.log`
- Restart automático configurado com delays apropriados