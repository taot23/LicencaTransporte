# Scripts de Manutenção

## Reorganizar Licenças (reorganizar-licencas.ts)

Este script migra arquivos de licenças existentes para a nova estrutura organizada por transportadora/estado/licença.

### Como usar:

```bash
# No servidor de produção:
export NODE_ENV=production
export UPLOAD_DIR=/var/uploads
export DATABASE_URL="postgresql://aetuser:***@localhost:5432/aetlicensesystem"

# Executar o script:
npx tsx scripts/reorganizar-licencas.ts
```

### O que faz:

1. Busca todas as licenças com file_url no banco
2. Move cada arquivo para a nova estrutura: `/uploads/licenses/{transportadora-slug}/{ESTADO}/{licenca-slug}/`
3. Atualiza o file_url no banco de dados
4. Remove arquivos antigos após migração bem-sucedida

### Estrutura criada:

```
/var/uploads/licenses/
├── transportadora-abc-ltda/
│   ├── PR/
│   │   ├── aet-001-2025/
│   │   │   └── arquivo.pdf
│   │   └── aet-002-2025/
│   │       └── documento.pdf
│   └── SP/
│       └── aet-003-2025/
│           └── licenca.pdf
└── transportes-xyz-sa/
    └── MG/
        └── aet-004-2025/
            └── arquivo.pdf
```

### Logs:

- `✔` - Migração bem-sucedida
- `✖` - Falha na migração (arquivo não encontrado, etc.)