# 🔧 Correção Build - Erro Vite no Servidor

## ❌ Problema Identificado
```
sh: 1: vite: not found
```

O Vite não está disponível como comando global no servidor.

## ✅ Soluções

### Solução 1: Instalar Vite localmente (Recomendado)
```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Instalar todas as dependências (incluindo dev)
npm install

# Agora fazer build
npm run build
```

### Solução 2: Build alternativo sem Vite global
```bash
# Usar npx para executar vite local
npx vite build && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

### Solução 3: Script personalizado para produção
Criar script que não depende de comandos globais:

```bash
# Editar package.json para usar npx
nano package.json
```

Modificar a seção "scripts":
```json
{
  "scripts": {
    "build": "npx vite build && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "build:prod": "NODE_ENV=production npx vite build && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
  }
}
```

## 🚀 Comandos de Correção Imediata

Execute na ordem:

### 1. Instalar dependências completas
```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Remover node_modules se houver problemas
rm -rf node_modules package-lock.json

# Instalar TODAS as dependências (dev + prod)
npm install
```

### 2. Verificar se Vite está instalado
```bash
# Verificar se vite está nas dependências locais
./node_modules/.bin/vite --version

# Ou usar npx
npx vite --version
```

### 3. Fazer build usando npx
```bash
# Build usando npx (não precisa de instalação global)
npx vite build

# Build do servidor
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Ou tudo junto
npm run build
```

### 4. Verificar se build foi criado
```bash
ls -la dist/
ls -la dist/public/
```

## 🎯 Script Completo de Deploy

Salvar como `deploy.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 Iniciando deploy do Sistema AET"

# Navegar para diretório
cd /var/www/aetlicensesystem/LicencaTransporte

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Fazer build
echo "🏗️ Fazendo build..."
npm run build

# Verificar build
if [ ! -d "dist" ]; then
    echo "❌ Build falhou - diretório dist não encontrado"
    exit 1
fi

# Configurar banco de dados
echo "🗄️ Configurando banco de dados..."
npm run db:push --force

# Parar aplicação atual se estiver rodando
echo "⏹️ Parando aplicação atual..."
pm2 stop aet-sistema || true

# Iniciar aplicação
echo "▶️ Iniciando aplicação..."
pm2 start ecosystem.config.cjs

# Salvar configuração PM2
pm2 save

echo "✅ Deploy concluído!"
echo "📊 Status:"
pm2 status
```

Tornar executável e executar:
```bash
chmod +x deploy.sh
./deploy.sh
```

## 🔍 Verificação de Problemas

### Verificar dependências instaladas
```bash
npm list vite
npm list esbuild
```

### Verificar estrutura do projeto
```bash
ls -la
cat package.json | grep -A 10 "scripts"
```

### Logs detalhados de build
```bash
npm run build --verbose
```

## 🛠️ Se ainda houver problemas

### Opção A: Usar apenas produção
```bash
# Para produção, instalar só dependências necessárias
NODE_ENV=production npm install --production=false

# Build
npm run build
```

### Opção B: Build manual
```bash
# Fazer build do frontend manualmente
npx vite build --mode production

# Build do backend
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --minify
```

### Opção C: Usar servidor de produção direto
Se o build continuar falhando, usar diretamente:
```bash
# Usar tsx para produção (mais simples)
npm install -g tsx
tsx server/production-server.js
```

## 📝 Notas Importantes

1. **Dependências Dev**: Em produção, você precisa das dependências de desenvolvimento para fazer build
2. **npx vs global**: Use npx para evitar problemas de instalação global
3. **Permissões**: Certifique-se que o usuário tem permissões para instalar e executar
4. **Memória**: Build pode precisar de mais memória, considere usar `--max-old-space-size=4096`

## ✅ Resultado Esperado

Após correção:
- ✅ Build criado em `dist/`
- ✅ Frontend otimizado em `dist/public/`
- ✅ Backend bundle em `dist/index.js`
- ✅ Aplicação funcionando com PM2