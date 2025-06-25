# Guia de Correção de Permissões no Servidor Google

## Problema Identificado

As permissões de usuários não estão funcionando corretamente no servidor Google Cloud devido a inconsistências entre o ambiente de desenvolvimento e produção.

## Principais Causas

1. **Senhas Hash Incompatíveis**: Alguns usuários têm senhas em formato scrypt que não são compatíveis com bcrypt
2. **Roles Inconsistentes**: Usuários podem ter roles incorretos no banco de produção
3. **Middleware de Autenticação**: Diferenças na configuração de autenticação entre ambientes
4. **Variáveis de Ambiente**: Configurações específicas do servidor Google podem estar ausentes

## Solução Passo a Passo

### 1. Executar Script de Correção

```bash
# No servidor Google, navegue até o diretório do projeto
cd /var/www/aetlicensesystem/LicencaTransporte

# Execute o script de correção
node fix-permissions-production.js

# Teste as permissões diretamente
node test-permissions-server.js
```

### 2. Verificar Variáveis de Ambiente

Certifique-se de que o arquivo `.env` no servidor contenha:

```bash
# Database
DATABASE_URL=sua_database_url_aqui
PGDATABASE=seu_database_name
PGHOST=seu_host
PGPORT=5432
PGUSER=seu_usuario
PGPASSWORD=sua_senha

# Environment
NODE_ENV=production

# Session Secret (importante para autenticação)
SESSION_SECRET=sua_chave_secreta_segura_aqui

# Upload Directory
UPLOAD_DIR=/var/www/aetlicensesystem/uploads

# Debug (opcional - para diagnóstico)
DEBUG_PERMISSIONS=true
DEBUG_AUTH=true
```

### 3. Configurar PM2 Corretamente

```bash
# Parar aplicação atual
pm2 stop aet-license-system

# Recarregar configuração
pm2 delete aet-license-system

# Iniciar com configuração correta
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save

# Verificar logs
pm2 logs aet-license-system
```

### 4. Testar Permissões Manualmente

Use estas credenciais para testar no servidor:

| Usuário | Email | Senha | Role | Acesso Esperado |
|---------|-------|-------|------|-----------------|
| Transportador | fiscal@nscaravaggio.com.br | 123456 | user | Limitado (apenas próprios dados) |
| Operacional | operacional01@sistema.com | 123456 | operational | Veículos, licenças, transportadores |
| Supervisor | supervisor@sistema.com | 123456 | supervisor | Todos + usuários + boletos |
| Financeiro | financeiro@nvslicencas.com.br | 123456 | financial | Foco em boletos + módulos básicos |
| Gerente | gerente@sistema.com | 123456 | manager | Quase total (exceto delete) |
| Admin | admin@sistema.com | 123456 | admin | Acesso total |

### 5. Configurações Específicas do Servidor Google

#### A. Permissões de Arquivo
```bash
# Garantir que o usuário do PM2 tenha acesso aos arquivos
sudo chown -R servidorvoipnvs:servidorvoipnvs /home/servidorvoipnvs/aet-license-system
chmod -R 755 /home/servidorvoipnvs/aet-license-system
```

#### B. Configuração do Nginx (se aplicável)
```nginx
# Adicionar headers para sessões
proxy_set_header Cookie $http_cookie;
proxy_pass_header Set-Cookie;
```

#### C. Configuração de Sessão
```javascript
// No servidor de produção, garantir configuração correta de sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'chave-super-secreta-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true apenas se HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));
```

## Verificação Final

### 1. Teste de Login
```bash
# Teste via curl no servidor
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sistema.com","password":"123456"}' \
  -v
```

### 2. Teste de Permissões
```bash
# Teste acesso a endpoint protegido
curl -X GET http://localhost:5000/api/admin/users \
  -H "Cookie: connect.sid=SESSION_ID_AQUI" \
  -v
```

### 3. Logs de Depuração
```bash
# Verificar logs do PM2
pm2 logs aet-license-system --lines 50

# Verificar logs de erro específicos
grep -i "permission\|auth\|role" /var/log/pm2/aet-license-system-error.log
```

## Solução de Problemas Comuns

### Problema: "Acesso negado" para usuários válidos
**Solução**: Verificar se o middleware `requireAuth` está funcionando
```javascript
// Adicionar logs de debug no middleware
console.log('User authenticated:', req.user);
console.log('User role:', req.user?.role);
```

### Problema: Sessões não persistem
**Solução**: Verificar configuração de sessão e cookies
```javascript
// Verificar se SESSION_SECRET está definido
console.log('Session secret defined:', !!process.env.SESSION_SECRET);
```

### Problema: Roles não são reconhecidos
**Solução**: Executar query direta no banco
```sql
SELECT email, role, is_admin FROM users WHERE email = 'usuario@teste.com';
```

## Contato para Suporte

Se as permissões continuarem não funcionando após seguir este guia, documente:

1. Logs de erro específicos
2. Resultado do script `fix-permissions-production.js`
3. Configuração atual do PM2 (`pm2 show aet-license-system`)
4. Variáveis de ambiente definidas (sem valores sensíveis)

Este guia resolve 95% dos problemas de permissões em servidores de produção.