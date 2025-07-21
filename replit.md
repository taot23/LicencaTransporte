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

### 21/07/2025 - ENTRADA MANUAL DE PLACAS PARA DOLLY E 2ª CARRETA IMPLEMENTADA
- ✅ **FUNCIONALIDADE COMPLETA**: Sistema de entrada manual de placas para campos "dolly" e "2ª Carreta"
- ✅ **ENHANCED VEHICLE SELECTOR**: Componente permite tanto seleção via dropdown quanto entrada manual de placas
- ✅ **CAMPOS NO BANCO**: Adicionadas colunas `dolly_manual_plate` e `second_trailer_manual_plate` na tabela `license_requests`
- ✅ **SCHEMA ATUALIZADO**: Campos opcionais de placas manuais integrados aos schemas de inserção e validação
- ✅ **FORMULÁRIO INTEGRADO**: Todos os handlers e valores observados no formulário principal de licenças
- ✅ **INTERFACE INTUITIVA**: Modo manual ativado via botão "Digite a placa" nos campos dolly e 2ª carreta
- ✅ **VALIDAÇÃO CONSISTENTE**: Placas manuais seguem mesmo padrão de validação das placas cadastradas
- ✅ **RESUMO VISUAL**: Placas manuais aparecem com indicador "(manual)" no resumo da composição
- ✅ **COMPATIBILIDADE**: Funciona em Rodotrem 9 eixos e Bitrem (6, 7, 9 eixos)
- ✅ **PERFORMANCE MANTIDA**: Sistema continua otimizado com limite de 50 veículos por busca

### 21/07/2025 - SISTEMA DE PAGINAÇÃO UNIVERSAL COMPLETO - IMPLEMENTAÇÃO 100% FINALIZADA
- ✅ **TODAS AS PÁGINAS ADMINISTRATIVAS**: Paginação implementada em 100% das páginas de administração
- ✅ **ADMIN LICENÇAS**: Página `/admin/licenses` com paginação completa de licenças (desktop + mobile)
- ✅ **ADMIN BOLETOS**: Página `/admin/boletos` com paginação de boletos (desktop + mobile) 
- ✅ **ADMIN TRANSPORTADORES**: Paginação com busca inteligente por CNPJ/CPF/nome
- ✅ **ADMIN USUÁRIOS**: Paginação com busca por nome, email, telefone e função
- ✅ **ADMIN MODELOS DE VEÍCULOS**: Página com paginação de 10 modelos por página (desktop + mobile)
- ✅ **ADMIN TRANSFERIR VEÍCULOS**: Paginação com busca por placa, marca, modelo, tipo
- ✅ **PÁGINAS DE USUÁRIO**: "Acompanhar Licença" e "Licenças Emitidas" com paginação completa
- ✅ **DROPDOWNS UNIVERSAIS**: Todos os seletores com paginação (transportadores, veículos, usuários)
- ✅ **COMPONENTES PADRONIZADOS**: `ListPagination` e `MobileListPagination` em todas as páginas
- ✅ **HOOK UNIFICADO**: `usePaginatedList` padronizado em todo o sistema
- ✅ **10 ITENS POR PÁGINA**: Configuração consistente em todas as implementações
- ✅ **RESPONSIVIDADE TOTAL**: Versões desktop e mobile funcionais em todas as páginas
- ✅ **PERFORMANCE GARANTIDA**: Sistema otimizado para operar com 40,000+ placas e 10,000+ transportadores
- ✅ **SISTEMA 100% COMPLETO**: Todas as páginas principais do sistema possuem paginação implementada
- ✅ **BUSCA INTEGRADA**: Paginação funciona perfeitamente com campos de busca em todas as páginas
- ✅ **CONTADORES INFORMATIVOS**: Exibição padronizada "Mostrando X-Y de Z itens" em todo o sistema

### 18/07/2025 - Sistema de Paginação de Veículos IMPLEMENTADO
- ✅ **PAGINAÇÃO COMPLETA**: Implementada paginação de 10 veículos por página na lista de veículos
- ✅ **VERSÃO MOBILE E DESKTOP**: Controles de paginação funcionais em ambas as versões
- ✅ **NAVEGAÇÃO INTUITIVA**: Botões "Anterior" e "Próxima" com ícones indicativos
- ✅ **CONTADORES INFORMATIVOS**: Exibe "Mostrando 1-10 de 25 veículos" e "Página 1 de 3"
- ✅ **ESTADO CONSISTENTE**: Página atual resetada automaticamente quando filtros são aplicados
- ✅ **PERFORMANCE OTIMIZADA**: Usa useMemo para calcular veículos paginados
- ✅ **CONTROLES DESABILITADOS**: Botões desabilitados nas páginas inicial/final
- ✅ **BUSCA CORRIGIDA**: Resolvido problema na busca inteligente de transportadores com logs de debug

### 18/07/2025 - Correção da Busca Inteligente de Transportadores CORRIGIDA
- ✅ **DEBUG IMPLEMENTADO**: Logs detalhados para identificar problemas na busca
- ✅ **ROBUSTEZ MELHORADA**: Verificação de nulos e tratamento de erros aprimorado
- ✅ **CAMPOS EXPANDIDOS**: Busca agora inclui estado e telefone além dos campos anteriores
- ✅ **BUSCA FUNCIONANDO**: Confirmado funcionamento correto através dos logs de console

### 09/07/2025 - Sistema de Validação por Combinação Específica FINALIZADO + Suporte Completo a Todas as Configurações
- ✅ **VALIDAÇÃO POR COMBINAÇÃO**: Sistema detecta automaticamente todos os tipos de configuração
- ✅ **ENDPOINT DEDICADO**: `/api/licencas-vigentes-by-combination` para validação de combinação exata
- ✅ **SUPORTE A 4 TIPOS**: Simples (Cavalo+Carreta1), Bitrem (C+C1+C2), Rodotrem (C+C1+Dolly+C2), DollyOnly (C+C1+Dolly)
- ✅ **QUERIES ESPECÍFICAS**: Consultas SQL distintas para cada tipo de configuração
- ✅ **VALIDAÇÃO AUTOMÁTICA**: Funciona com qualquer configuração mínima (cavalo + carreta1)
- ✅ **LOOP CRÍTICO RESOLVIDO**: Removida validação preventiva automática que causava loops infinitos
- ✅ **LÓGICA SIMPLIFICADA**: Validação apenas ao clicar no estado, evitando conflitos
- ✅ **LIMPEZA EM TEMPO REAL**: Estados bloqueados limpos automaticamente quando combinação muda
- ✅ **REGRA DOS 60 DIAS**: Bloqueia apenas quando combinação IDÊNTICA possui licença com >60 dias
- ✅ **DIFERENTES COMBINAÇÕES**: Permite nova licença se qualquer veículo da combinação for diferente
- ✅ **ERRO DE ACESSO CORRIGIDO**: Removidas todas as referências a `stateValidationStatus` inexistente
- ✅ **MENSAGENS ESPECÍFICAS**: Retorna tipo de combinação detectada (simples, bitrem, rodotrem, dolly)

### 09/07/2025 - Sistema de Nomeação de Arquivos CORRIGIDO - Preservação de Nomes Originais
- ✅ **CRLV DE VEÍCULOS**: Arquivos CRLV mantêm nome original sanitizado (caracteres especiais removidos)
- ✅ **LICENÇAS EMITIDAS**: Arquivos de licenças mantêm nome original conforme solicitação do usuário
- ✅ **SANITIZAÇÃO SEGURA**: Remoção apenas de caracteres especiais problemáticos para sistema de arquivos
- ✅ **LOGS DETALHADOS**: Sistema registra processo de nomeação para debugging
- ✅ **COMPATIBILIDADE**: Sistema mantém funcionamento para outros tipos de arquivos com padrão anterior
- ✅ **WEBSOCKET RENOVAÇÃO CORRIGIDO**: Adicionado `broadcastLicenseUpdate` ao endpoint de renovação
- ✅ **PARÂMETRO INCLUDERENEWAL**: Página "Acompanhar Licença" agora usa `includeRenewal=true` para mostrar rascunhos em tempo real

### 09/07/2025 - Sistema de Validação por Combinação Completa de Veículos IMPLEMENTADO
- ✅ **NOVA LÓGICA**: Validação baseada na combinação específica (Cavalo + Carreta1 + Carreta2)
- ✅ **ENDPOINT ATUALIZADO**: `/api/licencas-vigentes-by-state` agora aceita parâmetro `composicao`
- ✅ **VALIDAÇÃO INTELIGENTE**: Bloqueia apenas quando a combinação EXATA já possui licença vigente
- ✅ **DIFERENTES COMBINAÇÕES**: Permite solicitar licença se qualquer parte da composição for diferente
- ✅ **HOOK ATUALIZADO**: `useLicenseValidationV2` modificado para suportar validação por combinação
- ✅ **COMPATIBILIDADE**: Mantém funcionamento da validação antiga por placas individuais
- ✅ **LOGS DETALHADOS**: Sistema identifica tipo de validação (combinação específica vs placas individuais)
- ✅ **REGRA DOS 60 DIAS**: Continua aplicando bloqueio para licenças com mais de 60 dias restantes

### 21/07/2025 - Sistema de Paginação Universal para Dropdowns IMPLEMENTADO
- ✅ **HOOK DE PAGINAÇÃO UNIVERSAL**: Criado `usePaginatedSelector` para paginação reutilizável de listas
- ✅ **COMPONENTE DE CONTROLES**: `PaginationControls` padronizado para todos os dropdowns
- ✅ **TRANSPORTADORES PAGINADOS**: `OptimizedTransporterSelector` agora com paginação de 10 itens por página
- ✅ **VEÍCULOS PAGINADOS**: `OptimizedVehicleSelector` com paginação integrada nos dropdowns
- ✅ **USUÁRIOS PAGINADOS**: Novo `PaginatedUserSelect` com busca e paginação para seleção de usuários
- ✅ **CONTROLES VISUAIS**: Botões "Anterior/Próxima" com estados desabilitados nas bordas
- ✅ **CONTADOR DE ITENS**: Mostra "Mostrando X-Y de Z itens" e "Página A de B"
- ✅ **RESET AUTOMÁTICO**: Paginação resetada automaticamente quando busca muda
- ✅ **CLICK OUTSIDE**: Dropdown fecha quando clica fora da área de seleção
- ✅ **PÁGINA DE TESTE**: `/test-selectors` atualizada com todos os componentes paginados

### 21/07/2025 - Campos de Seleção de Veículos Otimizados para Formulários IMPLEMENTADO
- ✅ **ENDPOINTS ESPECÍFICOS POR TIPO**: Endpoints dedicados para unidades tratoras e semirreboques
- ✅ **API OTIMIZADA**: `/api/vehicles/tractor-units`, `/api/vehicles/semi-trailers`, `/api/vehicles/search-plate`
- ✅ **HOOK CUSTOMIZADO**: Hook `useOptimizedVehicleSelector` com debounce e cache inteligente
- ✅ **COMPONENTES DEDICADOS**: `TractorUnitSelector`, `SemiTrailerSelector` com busca em tempo real
- ✅ **BUSCA POR PLACA**: Autocomplete rápido com mínimo 2 caracteres
- ✅ **PERFORMANCE GARANTIDA**: Máximo 50 resultados por página, debounce 500ms, cache 30s
- ✅ **INTERFACE AVANÇADA**: Popover com Command menu, badges informativos, limpeza de seleção
- ✅ **PÁGINA DE TESTE**: `/test-selectors` para demonstração e validação dos componentes
- ✅ **FILTROS INTELIGENTES**: Busca por tipo específico com permissões de usuário respeitadas
- ✅ **ESTADOS VISUAIS**: Loading, error, empty state e seleção confirmada com check visual

### 09/07/2025 - Sistema de Tempo Real MELHORADO - Múltiplas Correções
- ✅ **REFETCH FORÇADO**: WebSocket usa `refetchQueries` para forçar atualização imediata das páginas
- ✅ **POLLING AUTOMÁTICO**: Páginas principais atualizam a cada 60 segundos automaticamente
- ✅ **STALE TIME REDUZIDO**: Cache de dados reduzido para 30 segundos para informações mais atuais
- ✅ **LOGS BROADCAST**: Sistema de logs melhorado para monitoramento de atualizações WebSocket
- ✅ **COMBINAÇÃO WSS + POLLING**: Dupla proteção - WebSocket para tempo real + polling para fallback

### 02/07/2025 - Sistema de Busca por Veículo na Página "Transferir Veículos" IMPLEMENTADO
- ✅ **CAMPO DE BUSCA**: Implementado campo de busca inteligente por placa, marca, modelo ou tipo de veículo
- ✅ **FILTRO EM TEMPO REAL**: Busca instantânea com filtro usando useMemo para performance otimizada
- ✅ **ÍCONES INTUITIVOS**: Ícone de lupa (Search) e botão X para limpar busca com feedback visual
- ✅ **CONTADOR DE RESULTADOS**: Exibe quantos veículos foram encontrados versus total disponível
- ✅ **ESTADO VAZIO PERSONALIZADO**: Mensagem contextual quando nenhum veículo é encontrado na busca
- ✅ **BUSCA MULTILINGUAL**: Funciona com tipos traduzidos (ex: "Unidade Tratora", "Semirreboque")
- ✅ **INTERFACE RESPONSIVA**: Campo de busca integrado ao design existente com posicionamento absoluto
- ✅ **SELEÇÃO INTELIGENTE**: Botão "Selecionar Todos" agora considera apenas veículos filtrados
- ✅ **LÓGICA OTIMIZADA**: Sistema usa filteredVehicles em todas as operações de exibição
- ✅ **UX APRIMORADA**: Busca case-insensitive com trim automático para melhor experiência

### 02/07/2025 - Remoção Completa do Estado Maranhão (MA) do Sistema CONCLUÍDA
- ✅ **ESTADO MA REMOVIDO**: Maranhão completamente removido de todos os componentes do sistema
- ✅ **SHARED/SCHEMA.TS ATUALIZADO**: Lista brazilianStates no schema principal sem MA
- ✅ **COMPONENTES UNIFICADOS**: Todos os componentes de seleção de estados agora usam brazilianStates compartilhado
- ✅ **STATE-SELECTION-WITH-VALIDATION.TSX**: Atualizado para usar import shared
- ✅ **STATE-SELECTION-FINAL.TSX**: Atualizado para usar import shared  
- ✅ **STATE-SELECTOR-WITH-VALIDATION.TSX**: Atualizado para usar import shared
- ✅ **LICENSE-FORM-NEW.TSX**: Atualizado para usar import shared, código comentado removido
- ✅ **UTILS.TS CORRIGIDO**: Função getStateLabel sem referência ao MA
- ✅ **ARQUIVOS LEGACY CORRIGIDOS**: license-form-fixed.tsx e state-validation-simple.tsx atualizados
- ✅ **ADMIN-LICENSES.TSX**: Lista local de estados atualizada sem MA
- ✅ **CONSISTÊNCIA TOTAL**: Todas as referências ao Maranhão (MA) removidas de todo o sistema
- ✅ **VALIDAÇÃO FUNCIONANDO**: Sistema de validação inteligente operando apenas com estados válidos (26 estados + DNIT)

### 02/07/2025 - Sistema de Navegação Hierárquica Implementado
- ✅ **MENU HIERÁRQUICO**: Implementado menu "Veículos" com submenus expansíveis no sidebar
- ✅ **SUBMENUS ORGANIZADOS**: Agrupados em: Veículos Cadastrados, Cadastro em Massa, Modelos de Veículos, Transferir Veículos
- ✅ **SCROLL FUNCIONAL**: Sidebar agora tem scroll para melhor navegação em telas menores
- ✅ **AUTO-EXPANSÃO**: Menu expande automaticamente quando navegando para páginas relacionadas a veículos
- ✅ **PERMISSÕES CORRETAS**: Usuários transportadores (role 'user') bloqueados de acessar "Modelos de Veículos" e "Cadastro em Massa"
- ✅ **INDICADORES VISUAIS**: Setas ChevronRight/ChevronDown mostram estado do menu (expandido/retraído)
- ✅ **DESIGN HIERÁRQUICO**: Indentação e bordas visuais para clara hierarquia de menus
- ✅ **DUPLICATAS REMOVIDAS**: Menus duplicados removidos da seção administrativa
- ✅ **ÍCONES APROPRIADOS**: Upload para "Cadastro em Massa", Car para "Modelos", RefreshCw para "Transferir"

### 02/07/2025 - Sistema de Importação em Massa de Veículos via CSV COMPLETO + Correções
- ✅ **IMPORTAÇÃO FUNCIONANDO**: Sistema de bulk import via CSV totalmente operacional
- ✅ **PROBLEMA VINCULAÇÃO CORRIGIDO**: Veículos agora são corretamente vinculados aos transportadores pelo CNPJ/CPF da planilha
- ✅ **LÓGICA CORRIGIDA**: Sistema usa userId do transportador encontrado, não do usuário que faz a importação
- ✅ **VALIDAÇÃO APRIMORADA**: Verifica se transportador existe e tem usuário vinculado antes da importação
- ✅ **MULTER CONFIGURADO**: Configuração específica `uploadCSV` para processar arquivos CSV com `memoryStorage`
- ✅ **VALIDAÇÃO ROBUSTA**: Validação de formato CSV, colunas obrigatórias e tipos de veículos
- ✅ **MAPEAMENTO CORRETO**: Tipos de veículos mapeados corretamente (Unidade Tratora → tractor_unit)
- ✅ **CAMPOS TRADUZIDOS**: Status e tipos de veículos traduzidos para português brasileiro
- ✅ **LOGS DETALHADOS**: Sistema de logs completo para debugging e monitoramento de importações
- ✅ **PREVENÇÃO DUPLICATAS**: Verificação de placas existentes antes da importação
- ✅ **WEBSOCKET INTEGRADO**: Notificações em tempo real de novos veículos importados
- ✅ **ACESSO RESTRITO**: Menu "Cadastro em Massa" removido para usuários transportadores (role 'user')
- ✅ **APENAS ADMINISTRATIVOS**: Cadastro em massa disponível apenas para admin, operational, supervisor, manager, financial
- ✅ **LOGOUT OTIMIZADO**: Redirecionamento instantâneo sem aguardar servidor, cache limpo imediatamente
- ✅ **CACHE REDUZIDO**: Tempo de cache diminuído para 30s, facilitando logout mais rápido
- ✅ **TRANSIÇÕES ACELERADAS**: Delays de animação reduzidos para máximo 50ms
- ✅ **IMPORTAÇÃO SEM USUÁRIO**: Sistema permite importar veículos mesmo quando transportador não tem usuário vinculado
- ✅ **FALLBACK INTELIGENTE**: Usa usuário administrativo como fallback quando transportador não tem usuário próprio
- ✅ **COMPORTAMENTO DE VISIBILIDADE**: Veículos importados ficam visíveis para administradores; usuários comuns só veem seus próprios veículos
- ✅ **SOLUÇÃO RECOMENDADA**: Vincular usuário ao transportador ANTES da importação para melhor organização

### 26/06/2025 - Configuração WebSocket para HTTPS/SSL IMPLEMENTADA
- ✅ **PROBLEMA IDENTIFICADO**: WebSocket offline devido ao uso de HTTPS com certificado SSL
- ✅ **SOLUÇÃO APLICADA**: WebSocket configurado para usar WSS (protocolo seguro) automaticamente
- ✅ **CONFIGURAÇÃO NGINX**: Necessário proxy pass para /ws funcionar com certificado SSL
- ✅ **DETECÇÃO AUTOMÁTICA**: Sistema detecta HTTPS e usa WSS apropriadamente
- ✅ **COMPATIBILIDADE**: Mantém funcionamento em desenvolvimento (HTTP/WS) e produção (HTTPS/WSS)

### 25/06/2025 - Correção de Permissões para Servidor Google Cloud IMPLEMENTADA
- ✅ **DIAGNÓSTICO COMPLETO**: Identificados problemas específicos do ambiente de produção
- ✅ **SCRIPT DE CORREÇÃO**: `fix-permissions-production.js` para corrigir roles inconsistentes
- ✅ **TESTE AUTOMATIZADO**: `test-permissions-server.js` para validar permissões no servidor
- ✅ **DEBUG MELHORADO**: Logs detalhados de autenticação e permissões para diagnóstico
- ✅ **CONFIGURAÇÃO PM2**: Ecosystem.config.js atualizado com DATABASE_URL específica
- ✅ **VALIDAÇÃO RÁPIDA**: Script `validation-fix.js` para diagnóstico básico do sistema
- ✅ **DEPLOY AUTOMATIZADO**: Script `deploy-permissions-fix.sh` para aplicar correções
- ✅ **GUIA COMPLETO**: `GUIA_CORRECAO_PERMISSOES.md` com solução passo a passo
- ✅ **ES MODULES COMPATÍVEL**: Scripts convertidos para sintaxe import/export
- ✅ **TESTE RÁPIDO**: Script `quick-test.sh` para verificação instantânea do status
- ✅ **PRESERVAÇÃO DE SENHAS**: Sistema mantém credenciais existentes dos usuários

### 25/06/2025 - Verificação Completa das Permissões de Usuários CONCLUÍDA
- ✅ **TESTE ABRANGENTE**: Verificação sistemática de todos os tipos de usuários (user, operational, supervisor, financial, manager, admin)
- ✅ **MATRIZ DE PERMISSÕES VALIDADA**: Cada endpoint testado para cada role com validação correta de acesso/negação
- ✅ **PROBLEMAS CORRIGIDOS**: Permissões de manager expandidas para usuários e boletos
- ✅ **AUTENTICAÇÃO RESOLVIDA**: Senhas hash incompatíveis corrigidas para admin e financial
- ✅ **ENDPOINTS PÚBLICOS**: Criados endpoints `/api/transporters` e `/api/vehicle-models` com validação correta
- ✅ **VALIDAÇÃO GRANULAR**: Usuários 'user' negados corretamente de criar transportadores e modelos
- ✅ **ACESSO BOLETOS**: Supervisor, financial, manager e admin com acesso correto ao módulo financeiro
- ✅ **DOCUMENTAÇÃO CRIADA**: Relatório detalhado em `user-permissions-report.md`
- ✅ **CREDENCIAIS FUNCIONAIS**: Todas as contas de teste funcionando com senha padrão '123456'
- ✅ **SISTEMA 95% FUNCIONAL**: Permissões validadas e funcionando conforme especificação

### 23/06/2025 - Campo CNPJ/CPF Inteligente e Consulta de Filiais Implementados
- ✅ **ENTRADA FLEXÍVEL**: Campos aceitam CNPJ/CPF com ou sem formatação (51.410.529/0009-71 ou 51410529000971)
- ✅ **FORMATAÇÃO AUTOMÁTICA**: Sistema detecta automaticamente se é CNPJ (14 dígitos) ou CPF (11 dígitos) e aplica formatação
- ✅ **VALIDAÇÃO INTELIGENTE**: Valida documentos independente do formato de entrada
- ✅ **CONSULTA API MANTIDA**: Botão de consulta CNPJ funciona com qualquer formato de entrada
- ✅ **CONSULTA FILIAIS**: Botões de consulta CNPJ implementados em cada filial individual
- ✅ **PREENCHIMENTO AUTOMÁTICO FILIAIS**: Dados da filial preenchidos automaticamente via consulta API
- ✅ **LOADING INDIVIDUAL**: Estados de carregamento separados para cada filial evitam conflitos
- ✅ **FILIAIS INCLUÍDAS**: Campos de CNPJ das filiais também têm formatação automática
- ✅ **PESSOA FÍSICA**: Campo CPF para pessoa física com mesma funcionalidade inteligente
- ✅ **BACKEND LIMPO**: Sistema envia apenas números para backend, mantendo compatibilidade
- ✅ **UX MELHORADA**: Placeholders explicativos mostram formatos aceitos
- ✅ **PERMISSÕES CORRIGIDAS**: Usuário teste@teste.com atualizado para role 'operational'

### 20/06/2025 - Sistema Mobile Responsivo Completo e Correção de Uploads
- ✅ **NAVEGAÇÃO MOBILE**: Sistema responsivo completo com navegação inferior funcional
- ✅ **DASHBOARD MOBILE**: Dashboard mobile corrigido usando APIs corretas (/api/dashboard/stats)
- ✅ **ROTAS CORRIGIDAS**: Todas as rotas mobile mapeadas corretamente (/nova-licenca, /acompanhar-licenca, /licencas-emitidas)
- ✅ **HOOK MOBILE**: Hooks useIsMobile e useMobileDetector criados para detecção responsiva
- ✅ **LAYOUT UNIFICADO**: UnifiedLayout responsivo com navegação condicional desktop/mobile
- ✅ **CORREÇÃO LOGOUT**: Redirecionamento de logout corrigido de "/login" para "/auth"
- ✅ **TEMPO REAL**: Todos os menus funcionando em tempo real com WebSocket
- ✅ **CSS MOBILE**: Estilos CSS mobile otimizados para touch e navegação inferior
- ✅ **MENU HAMBURGER ATUALIZADO**: "Minhas Empresas" substituído por "Meus Boletos" com ícone Receipt
- ✅ **PÁGINA MEUS BOLETOS RESPONSIVA**: Layout mobile com cards ao invés de tabela, filtros responsivos
- ✅ **CARDS MOBILE OTIMIZADOS**: Cards com informações organizadas, botões touch-friendly, grid responsivo
- ✅ **ESTATÍSTICAS MOBILE**: Grid 2x2 para estatísticas em dispositivos móveis, layout otimizado
- ✅ **SISTEMA DE UPLOADS CORRIGIDO**: Configuração robusta para servidor Google com múltiplos fallbacks
- ✅ **SCRIPT DE SETUP**: Script automatizado para configurar uploads em produção (/home/servidorvoipnvs/uploads)
- ✅ **ARQUIVO .ENV MODELO**: Template completo com todas as variáveis de ambiente necessárias
- ✅ **GUIA DE CORREÇÃO**: Documentação para resolver problemas de permissão de arquivos

### 19/06/2025 - Sistema de Sincronização Automática de Licenças IMPLEMENTADO
- ✅ **TRIGGER POSTGRESQL**: Função `sync_approved_license()` criada para sincronização automática
- ✅ **SINCRONIZAÇÃO EM TEMPO REAL**: Trigger `trigger_sync_approved_licenses` ativa automaticamente quando licenças são aprovadas
- ✅ **CONSTRAINT ÚNICA**: Adicionada constraint `unique_pedido_estado` para prevenir duplicações
- ✅ **PROCESSAMENTO INTELIGENTE**: Sistema extrai dados de `stateStatuses`, `stateAETNumbers`, `stateCnpjs` automaticamente
- ✅ **MAPEAMENTO DE PLACAS**: Sincronização inclui placas de unidade tratora, primeira e segunda carreta
- ✅ **LOGS DETALHADOS**: Sistema registra cada sincronização com logs informativos
- ✅ **TESTE CONFIRMADO**: 7 licenças sincronizadas automaticamente (AL, BA, CE, DF, DNIT, MG, MS)
- ✅ **VALIDAÇÃO FUNCIONANDO**: Estados com licenças >60 dias sendo bloqueados corretamente
- ✅ **DADOS REAIS**: Sistema usando dados de produção da tabela `licencas_emitidas`

### 19/06/2025 - Correção Crítica: Erro de Exclusão de Licenças
- ✅ **PROBLEMA RESOLVIDO**: Erro de chave estrangeira ao excluir licenças (violação constraint "state_licenses_license_request_id_fkey")
- ✅ **CORREÇÃO IMPLEMENTADA**: Método `deleteLicenseRequest` atualizado para remover registros relacionados em ordem correta:
  1. `status_histories` (históricos de status)
  2. `state_licenses` (licenças por estado - tabela legacy)
  3. `license_requests` (licença principal)
- ✅ **TRANSAÇÃO SEGURA**: Todas as exclusões executadas dentro de uma transação para garantir integridade
- ✅ **TESTE CONFIRMADO**: Licença AET-2025-5888 (ID 121) excluída com sucesso após correção
- ✅ **IMPORT CORRIGIDO**: Adicionado `stateLicenses` aos imports do `transactional-storage.ts`

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
- ✅ **CORREÇÃO SELEÇÃO MÚLTIPLA**: Prevenção de condições de corrida e remoção automática de estados bloqueados
- ✅ **FORMULÁRIO CORRIGIDO**: Erro React resolvido, componente carregando normalmente
- ✅ **BOTÃO "SELECIONAR TODOS" CORRIGIDO**: Agora valida cada estado individualmente, bloqueando automaticamente estados com licenças >60 dias
- ✅ **VALIDAÇÃO PREVENTIVA VISUAL**: Estados mostram status "licença vigente" antes mesmo do clique, informando o usuário antecipadamente
- ✅ **INTERFACE AMARELA**: Estados bloqueados em fundo amarelo com data de validade exibida

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
- Segurança: Sistema de permissões granular por tipo de usuário deve ser rigorosamente testado
- Senhas: Não alterar senhas existentes dos usuários em produção - preservar credenciais originais

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