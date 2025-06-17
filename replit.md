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

### 17/06/2025 - Sistema de Validação Inteligente COMPLETO - Produção Final
- ✅ **VALIDAÇÃO PARA TODOS OS ESTADOS + ÓRGÃOS FEDERAIS**: 27 estados brasileiros + DNIT, ANTT, PRF
- ✅ **DADOS REAIS DE PRODUÇÃO**: Funciona com todas as licenças sincronizadas na tabela `licencas_emitidas`
- ✅ **QUERY SQL ROBUSTA**: Verifica múltiplos campos de placas (unidade tratora, primeira carreta, segunda carreta, dolly, prancha, reboque)
- ✅ **NORMALIZAÇÃO INTELIGENTE**: Estados e placas normalizadas automaticamente (maiúsculas, filtros)
- ✅ **VALIDAÇÃO ROBUSTA**: Apenas estados válidos aceitos, placas com mínimo 6 caracteres
- ✅ **LOGS DETALHADOS PRODUÇÃO**: Emojis visuais nos logs (❌ bloqueado, ✅ liberado, ⚠️ renovação)
- ✅ **INTEGRAÇÃO FORMULÁRIO ORIGINAL**: Validação em tempo real mantendo aparência exata do formulário
- ✅ **CORREÇÃO DNIT IMPLEMENTADA**: DNIT agora incluído na validação, bloqueia licenças de 365 dias
- ✅ **TESTE COMPLETO CONFIRMADO**: 
  - MG bloqueado (197 dias > 60)
  - DNIT bloqueado (365 dias > 60) 
  - SP permitido (44 dias ≤ 60)
  - RJ liberado (sem licenças)
- ✅ **ERRO HANDLING**: Em caso de erro, libera estado para não bloquear usuário
- ✅ **DADOS EXPANDIDOS**: Retorna informações completas (data emissão, dias desde emissão, motivo)

### 17/06/2025 - Sistema de Validação Inteligente de Licenças Vigentes - Atualização para 60 Dias
- ✅ **REGRA ALTERADA**: Período de bloqueio atualizado de 30 para 60 dias conforme solicitação
- ✅ **SINCRONIZAÇÃO CORRIGIDA**: Mapeamento das placas na tabela `licencas_emitidas` corrigido
- ✅ **PROBLEMA RESOLVIDO**: Placas primeira/segunda carreta estavam no campo reboque incorretamente
- ✅ **DADOS VALIDADOS**: 7 licenças aprovadas sincronizadas com mapeamento correto de placas
- ✅ **VALIDAÇÃO FUNCIONAL**: Estados com licenças >60 dias bloqueados corretamente
- ✅ **TESTE CONFIRMADO**: AL bloqueado com 80 dias, dados das placas mapeados adequadamente
- ✅ Endpoint `/api/licencas-vigentes` usando status 'ativa' para consulta na tabela sincronizada
- ✅ Hook `useLicenseValidationV2` atualizado para regra de 60 dias
- ✅ Componente `StateSelectionWithValidation` com mensagem corrigida para 60 dias
- ✅ Sistema completo testado e funcionando com dados reais sincronizados

### 16/06/2025 - Sistema de Modais Customizados para Confirmações
- ✅ Substituído todas as notificações `confirm()` nativas por modais customizados AlertDialog
- ✅ Implementado na página de transportadores (/admin/transporters) com confirmação de exclusão
- ✅ Implementado na página de usuários (/admin/users) com confirmação de exclusão
- ✅ Implementado na página de modelos de veículos (/admin/vehicle-models) com confirmação de exclusão
- ✅ Estados de controle adicionados: isDeleteDialogOpen, itemToDelete para cada página
- ✅ Funções handleDeleteItem e handleConfirmDelete implementadas consistentemente
- ✅ Interface melhorada: botões com estados de loading e cores de destaque para ações críticas
- ✅ Modais responsivos com descrições claras sobre consequências das ações
- ✅ Proteção contra múltiplas execuções durante processamento de exclusão

### 16/06/2025 - Sistema de Validação Inteligente de Licenças Vigentes por Estado
- ✅ Endpoint `/api/licenses/check-existing` implementado para verificação de licenças ativas
- ✅ Validação automática considera licenças com mais de 30 dias até vencimento como bloqueadoras
- ✅ Hook `useLicenseValidation` criado para comunicação frontend-backend
- ✅ Modal `LicenseConflictModal` implementado com informações detalhadas de conflitos
- ✅ Integração completa no formulário de licenças com validação em tempo real
- ✅ Remoção automática de estados conflitantes da seleção do usuário
- ✅ Notificações claras sobre regra dos 30 dias para renovação
- ✅ Coleta automática de todas as placas do formulário (principal, adicionais, veículos)
- ✅ Interface intuitiva com contagem de dias restantes e orientações

### 16/06/2025 - Sistema de Controle de Acesso Detalhado por Perfil de Usuário
- ✅ Sistema de permissões granular implementado conforme matriz especificada
- ✅ 5 perfis de usuário: Operacional, Supervisor, Financeiro, Gerente, Administrador
- ✅ Controle de acesso no backend: middleware de verificação de permissões implementado
- ✅ Restrições específicas aplicadas: DELETE apenas para admin, POST /usuarios (admin, supervisor)
- ✅ POST /boletos limitado a financeiro e admin, POST /transportador (todos exceto operacional)
- ✅ Hook usePermissions() criado no frontend para verificação de permissões
- ✅ Sidebar atualizado com controle de visibilidade de menus por perfil
- ✅ Arquivo shared/permissions.ts com matriz completa de permissões por módulo
- ✅ Funções de verificação: hasPermission, canAccessModule, canCreateIn, canEditIn, canDeleteIn
- ✅ **CORREÇÃO CRÍTICA**: Rota duplicada `/api/staff/check-operational` removida
- ✅ **ACESSO MANAGER RESOLVIDO**: Todas verificações de permissão incluem role 'manager'
- ✅ **AUTENTICAÇÃO HÍBRIDA**: Sistema suporta bcrypt e scrypt para compatibilidade
- ✅ **CREDENCIAIS FUNCIONAIS**: gerente@sistema.com / 123456 (role: manager)
- ✅ **USUÁRIO OPERACIONAL CORRIGIDO**: operacional01@sistema.com / 123456 (role: operational)
- ✅ **MENUS ADMINISTRATIVOS**: Role 'operational' incluído em todas as verificações do sidebar
- ✅ **ACESSO COMPLETO**: Usuários operacionais veem "Gerenciar Licenças" e "Transportadores"
- ✅ **SERVIDOR GOOGLE CORRIGIDO**: Função isAdminUser inclui role 'operational' para acesso total
- ✅ **DADOS OPERACIONAIS**: Usuários operacionais veem todos os veículos e licenças do sistema
- ✅ **DASHBOARD EXCLUSIVO TRANSPORTADORES**: Botão "Dashboard" apenas para role 'user', oculto para admin e demais roles
- ✅ **CAMPO OBSERVAÇÕES**: Implementado em todas as páginas de detalhes de licenças (emitidas, acompanhar, admin)

### 16/06/2025 - Filtros Inteligentes e Exportações CSV Padronizadas
- ✅ Filtro inteligente implementado na página de licenças administrativas (/admin/licenses)
- ✅ Substituído dropdown de transportadores por campo de busca por nome/CNPJ/CPF
- ✅ Filtro inteligente implementado na página de usuários (/admin/users)
- ✅ Campo de busca por nome, email, telefone ou função de usuários
- ✅ Exportação CSV implementada na página "Minhas Licenças Emitidas" (/licencas-emitidas)
- ✅ Exportação CSV implementada na página "Acompanhar Licença" (/acompanhar-licenca)
- ✅ Todas as exportações CSV padronizadas com separador ";" (ponto e vírgula)
- ✅ Tradução completa dos dados exportados para português brasileiro
- ✅ Filtros em tempo real com busca instantânea enquanto o usuário digita

### 15/06/2025 - Correção Crítica: Exibição de Datas no Módulo Financeiro
- ✅ Corrigido problema das datas de emissão e vencimento não aparecendo nas tabelas
- ✅ Implementada conversão adequada de datas usando `new Date()` no frontend
- ✅ Corrigidas ambas páginas: "Meus Boletos" (/meus-boletos) e Admin (/admin/boletos)
- ✅ Exportação CSV agora exibe datas corretamente formatadas
- ✅ Filtros por vencimento funcionando adequadamente com datas válidas
- ✅ Atualização em tempo real via WebSocket implementada na página "Meus Boletos"

### 16/06/2025 - Padronização de Exportação CSV com Separador Ponto e Vírgula
- ✅ Botão "Exportar CSV" implementado na página de licenças emitidas (/licencas-emitidas)
- ✅ Biblioteca csv-export.ts padronizada para usar separador ";" em todo o sistema
- ✅ Tradução completa para português brasileiro nos dados exportados
- ✅ Tipos de veículo traduzidos: "bitrain_9_axles" → "Bitrem 9 Eixos"
- ✅ Status traduzidos: "approved" → "Aprovado"
- ✅ Formatação de datas em padrão brasileiro (DD/MM/AAAA)
- ✅ Todas as páginas com exportação CSV agora usam separador ";" por padrão:
  - Licenças emitidas, Boletos, Transportadores, Veículos, Licenças administrativas

### 16/06/2025 - Dashboard AET Administrativo Implementado
- ✅ Dashboard AET centralizado criado conforme especificações técnicas
- ✅ Cards de resumo diário: AETs solicitadas, emitidas, pendentes, vencidas hoje
- ✅ Gráficos operacionais: licenças por status (7 dias), por tipo de veículo, por estado
- ✅ Tabelas de apoio: AETs recentes e últimos boletos gerados
- ✅ Endpoint `/api/dashboard/aet` implementado com dados reais do sistema
- ✅ Rota `/admin/dashboard-aet` adicionada com permissões para admin e manager
- ✅ Link "Dashboard AET" incluído no sidebar administrativo
- ✅ Removido menu "Relatórios" do sidebar para melhor organização
- ✅ Atualização em tempo real implementada via WebSocket
- ✅ Opção "Financeiro" adicionada no formulário de criação de usuários

### 15/06/2025 - Refinamentos do Sidebar e Navegação
- ✅ Removido menu "Minhas Empresas" do sidebar conforme solicitação
- ✅ Ajustado menu "Modelos de Veículos" para seguir padrão das páginas administrativas
- ✅ Permissões de "Modelos de Veículos" expandidas para admin e operational
- ✅ Melhorias na organização e consistência da navegação

### 15/06/2025 - Otimizações de Performance e Logout
- ✅ Eliminado delay no logout - agora instantâneo com limpeza imediata de cache
- ✅ Otimizado QueryClient para melhor performance de navegação
- ✅ Reduzido staleTime para 2 minutos e desabilitado refetch automático
- ✅ Implementado retry inteligente que evita loops em erros de autenticação
- ✅ Otimizado WebSocket para reduzir reconexões desnecessárias
- ✅ Removido delay artificial de carregamento entre páginas
- ✅ Melhorado gerenciamento de cache com limpeza a cada 15 minutos
- ✅ Logout instantâneo com fetch em background para melhor UX

### 13/06/2025 - Melhorias de Interface e UX
- ✅ Header fixo implementado com informações do usuário no canto superior direito
- ✅ Sistema de exclusão atualizado para usar AlertDialog nativo ao invés de confirm()
- ✅ Ícones de download corrigidos: Receipt para boleto, FileText para nota fiscal
- ✅ Logout otimizado com redirecionamento imediato para melhor performance
- ✅ Proteção contra múltiplos cliques simultâneos no logout
- ✅ Correção das datas divergentes no sistema de boletos
- ✅ Layout responsivo mantido para mobile e desktop
- ✅ Tooltips adicionados aos botões para maior clareza

### 13/06/2025 - Módulo Financeiro Implementado
- ✅ Criado sistema completo de gestão de boletos brasileiros
- ✅ Interface administrativa em `/admin/boletos` com CRUD completo
- ✅ Formulário de criação/edição com upload de arquivos (boleto e NF)
- ✅ Validação e formatação de dados financeiros brasileiros
- ✅ Papel de usuário "financial" adicionado com permissões específicas
- ✅ Navegação na sidebar para usuários admin e financial
- ✅ Integração com sistema de uploads externos
- ✅ Layout corrigido para seguir padrão AdminLayout das outras páginas
- ✅ Métodos de boletos implementados na TransactionalStorage (PostgreSQL)
- ✅ Botão "Exportar" com ícone Download implementado para exportação CSV
- ✅ Layout enquadrado corretamente na interface seguindo grid padrão

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
- API calls: Usar fetch padrão ao invés de apiRequest para logout e operações simples

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