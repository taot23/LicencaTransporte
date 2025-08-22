# 🔄 Sincronização de Código - Servidor Google

## 🎯 Situação Atual

As correções de upload foram aplicadas no ambiente Replit, mas ainda não foram transferidas para o servidor Google. O servidor ainda está usando a versão antiga do código que valida o diretório na importação.

## 📋 Comandos para Sincronizar

Execute no servidor Google para aplicar as correções:

```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# 1. Parar aplicação
pm2 stop aet-sistema

# 2. Fazer backup do código atual (segurança)
cp server/lib/license-storage.ts server/lib/license-storage.ts.bak

# 3. Aplicar correção manualmente no arquivo
nano server/lib/license-storage.ts
```

## 🔧 Alteração Necessária no Arquivo

No arquivo `server/lib/license-storage.ts`, localize a linha:

```typescript
const UPLOAD_BASE = validateUploadDir();
```

E substitua por:

```typescript
// Remover validação na importação - será validado quando necessário
let UPLOAD_BASE: string;
```

Em seguida, localize a função `buildLicenseDir` e modifique para:

```typescript
export function buildLicenseDir(opts: { 
  transporter: string; 
  state: string; 
  licenseNumber: string 
}) {
  // Validar diretório toda vez que for usado (sem cache)
  if (!UPLOAD_BASE) {
    UPLOAD_BASE = validateUploadDir();
  }
  
  const t = toSlug(opts.transporter);
  const uf = toSlug(opts.state);
  const lic = toSlug(opts.licenseNumber);
  
  return {
    absDir: path.join(UPLOAD_BASE, "licenses", t, uf, lic),
    relUrlBase: `/uploads/licenses/${encodeURIComponent(t)}/${encodeURIComponent(uf)}/${encodeURIComponent(lic)}`
  };
}
```

## 🚀 Alternativa Rápida (Edição Direta)

```bash
cd /var/www/aetlicensesystem/LicencaTransporte

# Parar aplicação
pm2 stop aet-sistema

# Aplicar correção diretamente
sed -i 's/const UPLOAD_BASE = validateUploadDir();/let UPLOAD_BASE: string;/' server/lib/license-storage.ts

# Adicionar validação na função buildLicenseDir
sed -i '/export function buildLicenseDir/,/^}/ s/const t = toSlug/  if (!UPLOAD_BASE) {\n    UPLOAD_BASE = validateUploadDir();\n  }\n  \n  const t = toSlug/' server/lib/license-storage.ts

# Verificar alteração
grep -A 10 "let UPLOAD_BASE" server/lib/license-storage.ts

# Reiniciar aplicação
pm2 start aet-sistema

# Verificar logs
pm2 logs aet-sistema --lines 10
```

## ✅ Verificação de Sucesso

Após aplicar a correção, os logs devem mostrar:

```
[UPLOAD] Validando diretório de upload (SEM FALLBACK): /var/www/aetlicensesystem/uploads
[UPLOAD] ✅ Diretório validado: /var/www/aetlicensesystem/uploads
```

E o upload deve funcionar sem erro de "Upload directory not writable".

## 🎯 Resultado Esperado

Com esta correção aplicada no servidor:
- Sistema validará permissões apenas quando necessário
- Upload funcionará corretamente
- Arquivos serão organizados na estrutura: `/licenses/transportadora/estado/licenca/`
- Arquivos temporários serão removidos automaticamente

## 📊 Teste Final

Após reiniciar, teste fazendo upload de um arquivo. Deve aparecer nos logs:

```
[LICENSE ORGANIZATION] ✅ Arquivo organizado: /uploads/licenses/empresa/sp/req-xxx/arquivo.pdf
```

Esta sincronização resolverá definitivamente o problema de upload no servidor Google.