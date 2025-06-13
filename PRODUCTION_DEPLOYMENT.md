# Solução para Erros de Permissão no Servidor Google

## Problema Identificado
O aplicativo está falhando com erros de permissão do Vite:
```
Error: EACCES: permission denied, mkdir '/var/www/aetlicensesystem/LicencaTransporte/node_modules/.vite/deps_temp_*'
```

## Solução Rápida

### 1. Parar o PM2 atual
```bash
pm2 stop aet-license-system
pm2 delete aet-license-system
```

### 2. Copiar arquivos atualizados
Certifique-se que estes arquivos estão no servidor:
- `server/production-server.js` (novo arquivo criado)
- `ecosystem.config.js` (atualizado)

### 3. Iniciar com nova configuração
```bash
pm2 start ecosystem.config.js
pm2 save
```

## Explicação da Solução

O problema ocorria porque:
1. O Vite tentava criar diretórios temporários em modo desenvolvimento
2. O usuário não tinha permissões para escrever em `node_modules/.vite/`
3. O aplicativo reiniciava constantemente devido ao erro

A solução:
1. Criamos `server/production-server.js` que não usa Vite em produção
2. Atualizamos `ecosystem.config.js` para usar o servidor de produção
3. Adicionamos configurações de restart delay para evitar loops

## Verificação
Após a implementação, verifique:
```bash
pm2 logs aet-license-system --lines 10
```

Você deve ver:
- "Production server running on port 5000"
- Sem erros de permissão do Vite
- Logs de API funcionando normalmente

## Fallback se Build não existir
O servidor de produção detecta automaticamente se os arquivos de build existem:
- Se existem: serve arquivos estáticos + API
- Se não existem: serve apenas API com mensagem informativa

Isso evita crashes e permite que a API funcione mesmo sem frontend buildado.