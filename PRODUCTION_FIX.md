# Correção para Problemas de Permissão em Produção

## Problema Identificado
O Vite estava tentando criar diretórios temporários em `node_modules/.vite/deps_temp_*` sem as permissões necessárias no servidor de produção.

## Solução Implementada
Criado servidor de produção dedicado que serve arquivos estáticos pré-construídos, evitando completamente o uso do Vite em tempo de execução.

## Passos para Aplicar no Servidor

### 1. Parar o PM2 Atual
```bash
pm2 stop aet-license-system
pm2 delete aet-license-system
```

### 2. Limpar Cache e Preparar Ambiente
```bash
cd /var/www/aetlicensesystem/LicencaTransporte
rm -rf node_modules/.vite
rm -rf dist
```

### 3. Construir a Aplicação
```bash
npm run build
```

### 4. Ajustar Permissões
```bash
sudo chown -R servidorvoipnvs:servidorvoipnvs /var/www/aetlicensesystem/LicencaTransporte
chmod +x /var/www/aetlicensesystem/LicencaTransporte/start-production.sh
```

### 5. Iniciar com PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 6. Verificar Status
```bash
pm2 status
pm2 logs aet-license-system --lines 10
```

## Arquivos Criados/Modificados
- `server/production.ts`: Novo servidor de produção sem dependência do Vite
- `start-production.sh`: Script atualizado para usar servidor de produção
- `ecosystem.config.js`: Configurado para usar o novo script

## Vantagens da Nova Solução
- Elimina problemas de permissão do Vite
- Melhor performance em produção (arquivos estáticos)
- Menos consumo de recursos
- Mais estável para ambiente de produção

## Teste da Aplicação
Após aplicar as correções, a aplicação deve iniciar corretamente e estar acessível em http://34.44.159.254:5000