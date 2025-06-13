# Configuração de Produção do Sistema AET

## Configuração de Uploads Externos

### Problema Resolvido
Os arquivos de upload eram perdidos durante reinstalações do projeto porque ficavam dentro da pasta `LicencaTransporte`.

### Solução Implementada
O sistema agora detecta automaticamente o melhor diretório para uploads externos, seguindo esta ordem de prioridade:

1. **`UPLOAD_DIR`** (variável de ambiente personalizada)
2. **`/var/uploads`** (padrão para produção)
3. **`/tmp/uploads`** (fallback para sistemas com permissões limitadas)
4. **`../uploads`** (um nível acima do projeto)
5. **`./uploads`** (último recurso dentro do projeto)

### Configuração Recomendada para Produção

#### Opção 1: Diretório Dedicado (Recomendado)
```bash
# Criar diretório de uploads externo
sudo mkdir -p /var/uploads
sudo chown -R servidorvoipnvs:servidorvoipnvs /var/uploads
sudo chmod 755 /var/uploads

# Definir variável de ambiente (opcional)
export UPLOAD_DIR=/var/uploads
```

#### Opção 2: Usar Variável de Ambiente
```bash
# No arquivo .bashrc ou .profile
echo 'export UPLOAD_DIR=/caminho/para/uploads' >> ~/.bashrc
source ~/.bashrc
```

## Solução para Erros de Permissão no Servidor Google

### Problema Identificado
O aplicativo estava falhando com erros de permissão do Vite:
```
Error: EACCES: permission denied, mkdir '/var/www/aetlicensesystem/LicencaTransporte/node_modules/.vite/deps_temp_*'
```

### Solução Completa

#### 1. Parar o PM2 atual
```bash
pm2 stop aet-license-system
pm2 delete aet-license-system
```

#### 2. Copiar arquivos atualizados
Certifique-se que estes arquivos estão no servidor:
- `server/production-server.js` (novo arquivo criado)
- `ecosystem.config.js` (atualizado)

#### 3. Configurar uploads externos (opcional mas recomendado)
```bash
# Criar diretório de uploads seguro
sudo mkdir -p /var/uploads
sudo chown -R servidorvoipnvs:servidorvoipnvs /var/uploads
```

#### 4. Iniciar com nova configuração
```bash
pm2 start ecosystem.config.js
pm2 save
```

## Explicação Técnica

### Problema Original
1. O Vite tentava criar diretórios temporários em modo desenvolvimento
2. O usuário não tinha permissões para escrever em `node_modules/.vite/`
3. O aplicativo reiniciava constantemente devido ao erro
4. Arquivos de upload eram perdidos durante reinstalações

### Solução Implementada
1. Criamos `server/production-server.js` que não usa Vite em produção
2. Atualizamos `ecosystem.config.js` para usar o servidor de produção
3. Implementamos detecção automática de diretório de uploads externos
4. Adicionamos configurações de restart delay para evitar loops
5. Organizamos uploads em subpastas (`vehicles/` e `transporter/`)

## Verificação

### Logs do Sistema
```bash
pm2 logs aet-license-system --lines 20
```

Você deve ver:
- `[UPLOAD] Usando diretório: /caminho/para/uploads`
- `[UPLOAD] Servindo arquivos de /caminho/para/uploads em /uploads`
- "Production server running on port 5000"
- Sem erros de permissão do Vite
- Logs de API funcionando normalmente

### Estrutura de Arquivos
```
/var/uploads/  (ou diretório detectado)
├── vehicles/          # Arquivos CRLV de veículos
└── transporter/       # Documentos de transportadores
```

### Teste de Funcionalidade
1. Faça upload de um documento de veículo
2. Verifique se o arquivo foi salvo no diretório externo
3. Reinstale o projeto (simulando uma atualização)
4. Confirme que os arquivos continuam acessíveis

## Fallbacks Automáticos

### Se Build Frontend não existir
O servidor de produção detecta automaticamente se os arquivos de build existem:
- **Se existem:** serve arquivos estáticos + API
- **Se não existem:** serve apenas API com mensagem informativa

### Se Diretório de Uploads falhar
O sistema tenta automaticamente os próximos diretórios da lista até encontrar um com permissões adequadas.

## Monitoramento Contínuo
```bash
# Verificar status do PM2
pm2 status

# Monitorar logs em tempo real
pm2 logs aet-license-system --follow

# Verificar uso de espaço dos uploads
du -sh /var/uploads/
```