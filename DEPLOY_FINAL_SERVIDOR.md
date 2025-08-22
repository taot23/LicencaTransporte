# 🚀 Correção Final - Upload Directory no Servidor Google

## 🔍 Problema Identificado
- PM2 não está carregando `.env.production` corretamente
- Log mostra: `[dotenv@17.2.1] injecting env (0) from .env` (deveria ser .env.production)
- Sistema usando diretório local ao invés do externo

## ✅ Solução Completa

### 1. Copiar ecosystem.config.cjs Atualizado

No servidor Google, execute:

```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Backup do atual
cp ecosystem.config.cjs ecosystem.config.cjs.backup

# Criar novo ecosystem.config.cjs
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'aet-sistema',
    script: 'server/index.ts',
    interpreter: 'tsx',
    cwd: '/var/www/aetlicensesystem/LicencaTransporte',
    instances: 1, 
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      UPLOAD_DIR: '/var/www/aetlicensesystem/uploads'
    },
    env_file: '.env.production',
    log_file: '/var/log/aet/combined.log',
    out_file: '/var/log/aet/out.log',
    error_file: '/var/log/aet/error.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'uploads', 'dist']
  }]
}
EOF
```

### 2. Garantir Estrutura de Diretórios

```bash
# Criar diretório externo se não existir
sudo mkdir -p /var/www/aetlicensesystem/uploads/{licenses,vehicles,transporters,boletos,vehicle-set-types}

# Configurar permissões
sudo chown -R servidorvoipnvs:www-data /var/www/aetlicensesystem/uploads
sudo chmod -R 755 /var/www/aetlicensesystem/uploads

# Verificar estrutura
ls -la /var/www/aetlicensesystem/uploads/
```

### 3. Reiniciar Aplicação

```bash
# Parar aplicação atual
pm2 stop aet-sistema
pm2 delete aet-sistema

# Iniciar com nova configuração
pm2 start ecosystem.config.cjs

# Configurar para inicialização automática
pm2 startup
pm2 save
```

### 4. Verificar Correção

```bash
# Verificar logs - deve mostrar diretório externo
pm2 logs aet-sistema --lines 10

# Deve aparecer:
# [UPLOAD] Validando diretório de upload (SEM FALLBACK): /var/www/aetlicensesystem/uploads
# [UPLOAD] ✅ Diretório validado: /var/www/aetlicensesystem/uploads
```

### 5. Testar Upload

```bash
# Status da aplicação
pm2 status

# Acessar sistema e criar uma licença para testar
# Verificar se arquivo é salvo no local correto:
ls -la /var/www/aetlicensesystem/uploads/licenses/
```

## 🎯 Resultado Esperado

### Logs Corretos:
```
[UPLOAD] Validando diretório de upload (SEM FALLBACK): /var/www/aetlicensesystem/uploads
[UPLOAD] ✅ Diretório validado: /var/www/aetlicensesystem/uploads
[UPLOAD] 📁 Subdiretórios: vehicles, transporters, boletos, vehicle-set-types, licenses
[UPLOAD] Servindo arquivos de /var/www/aetlicensesystem/uploads em /uploads
```

### Estrutura Final:
```
/var/www/aetlicensesystem/
├── LicencaTransporte/              # Aplicação
│   ├── server/
│   ├── uploads/                    # ❌ Não usado mais
│   └── ecosystem.config.cjs        # ✅ Configuração corrigida
└── uploads/                        # ✅ Diretório externo correto
    └── licenses/
        └── benda-cia-ltda/sp/aet-2025-1570/arquivo.pdf
```

## 🔧 Troubleshooting

Se ainda não funcionar:

```bash
# Verificar variáveis de ambiente do PM2
pm2 show aet-sistema | grep -A 20 "env:"

# Verificar se UPLOAD_DIR aparece na lista

# Se necessário, definir manualmente:
pm2 set aet-sistema:UPLOAD_DIR /var/www/aetlicensesystem/uploads
pm2 restart aet-sistema
```

## 🚀 Benefícios da Correção

1. ✅ Arquivos salvos fora do projeto (seguros em reinstalações)
2. ✅ Configuração explícita no ecosystem.config.cjs
3. ✅ Logs claros mostrando diretório correto
4. ✅ Sistema sem fallback - falha se mal configurado
5. ✅ Estrutura organizada e profissional