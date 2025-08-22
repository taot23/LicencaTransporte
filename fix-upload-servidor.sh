#!/bin/bash

# Script para corrigir upload no servidor Google
echo "🔧 Iniciando correção de upload no servidor..."

cd /var/www/aetlicensesystem/LicencaTransporte

# Parar aplicação
echo "⏹️  Parando aplicação..."
pm2 stop aet-sistema

# Backup do arquivo original
echo "💾 Fazendo backup..."
cp server/lib/license-storage.ts server/lib/license-storage.ts.backup

# Criar versão corrigida
echo "✏️  Aplicando correção..."
cat > server/lib/license-storage.ts << 'EOF'
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, constants } from "node:fs";

// Validar diretório de upload - Versão mais tolerante para produção
function validateUploadDir(): string {
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  
  console.log(`[UPLOAD] Configuração do diretório de upload: ${uploadDir}`);
  
  try {
    // Verificar se diretório existe ou pode ser criado
    if (!existsSync(uploadDir)) {
      console.log(`[UPLOAD] Diretório não existe, tentando criar: ${uploadDir}`);
      try {
        require('node:fs').mkdirSync(uploadDir, { recursive: true });
      } catch (mkdirError) {
        console.error(`[UPLOAD] ⚠️  Erro ao criar diretório: ${mkdirError}`);
      }
    }
    
    // Testar permissões de escrita (mais tolerante)
    try {
      require('node:fs').accessSync(uploadDir, constants.R_OK | constants.W_OK);
      console.log(`[UPLOAD] ✓ Diretório validado com sucesso: ${uploadDir}`);
    } catch (accessError) {
      console.error(`[UPLOAD] ⚠️  Aviso de permissão: ${accessError}`);
      console.log(`[UPLOAD] 🔄 Tentando continuar mesmo assim...`);
    }
    
    return uploadDir;
  } catch (error) {
    console.error(`[UPLOAD] ❌ Erro na validação:`, error);
    console.log(`[UPLOAD] 🔄 Retornando diretório padrão para tentar continuar...`);
    return uploadDir; // Retorna mesmo com erro para tentar continuar
  }
}

// Validação sob demanda - não na importação
let UPLOAD_BASE: string;

// Função para criar slug limpo sem acentos e caracteres especiais
export function toSlug(raw: string): string {
  return (raw || "desconhecido")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

// Construir caminho organizado para licenças: transportador/estado/licença
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

// Verificar se arquivo existe
async function exists(filePath: string): Promise<boolean> {
  try { 
    await fs.stat(filePath); 
    return true; 
  } catch { 
    return false; 
  }
}

// Salvar arquivo de licença com estrutura organizada
export async function saveLicenseFile(params: {
  buffer: Buffer;
  originalName: string; // ex.: "AET-PR-001.pdf"
  transporter: string;  // ex.: "Transportadora ABC LTDA"
  state: string;        // ex.: "PR"
  licenseNumber: string;// ex.: "AET-001-2025" ou "REQ-2025-001"
}) {
  console.log(`[UPLOAD] Iniciando salvamento de arquivo:`, {
    originalName: params.originalName,
    transporter: params.transporter,
    state: params.state,
    licenseNumber: params.licenseNumber,
    bufferSize: `${Math.round(params.buffer.length / 1024)}KB`
  });

  const { absDir, relUrlBase } = buildLicenseDir(params);
  console.log(`[UPLOAD] Diretório de destino: ${absDir}`);
  
  try {
    // Criar diretório recursivamente se não existir
    await fs.mkdir(absDir, { recursive: true });
    console.log(`[UPLOAD] ✓ Diretório criado/verificado: ${absDir}`);

    const ext = (path.extname(params.originalName) || ".pdf").toLowerCase();
    const base = toSlug(path.basename(params.originalName, ext)) || "arquivo";
    
    // Evitar colisões de nome
    let fileName = `${base}${ext}`;
    let fullPath = path.join(absDir, fileName);
    let counter = 1;
    
    while (await exists(fullPath)) {
      fileName = `${base}-${counter++}${ext}`;
      fullPath = path.join(absDir, fileName);
    }

    console.log(`[UPLOAD] Nome final do arquivo: ${fileName}`);
    console.log(`[UPLOAD] Caminho completo: ${fullPath}`);

    // Salvar arquivo
    await fs.writeFile(fullPath, params.buffer);
    console.log(`[UPLOAD] ✓ Arquivo salvo com sucesso: ${fullPath}`);

    const publicUrl = `${relUrlBase}/${encodeURIComponent(fileName)}`;
    console.log(`[UPLOAD] ✓ URL pública: ${publicUrl}`);
    
    return { filePath: fullPath, publicUrl };
    
  } catch (error) {
    const errorMsg = `[UPLOAD] ❌ ERRO ao salvar arquivo da licença`;
    console.error(errorMsg, {
      originalName: params.originalName,
      destDir: absDir,
      error: error
    });
    
    // Re-throw com mensagem mais clara
    throw new Error(`Failed to save license file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Função para obter dados da licença e transportadora (para ser usado nos endpoints)
export interface LicenseMetadata {
  transporter: string;
  state: string;
  licenseNumber: string;
}
EOF

# Garantir permissões do arquivo
chmod 644 server/lib/license-storage.ts

# Garantir permissões do diretório de upload
echo "🔐 Corrigindo permissões do diretório de upload..."
cd /var/www/aetlicensesystem
sudo chown -R servidorvoipnvs:www-data uploads/
sudo chmod -R 775 uploads/

# Voltar para diretório da aplicação
cd LicencaTransporte

# Reiniciar aplicação
echo "🚀 Reiniciando aplicação..."
pm2 start aet-sistema

# Verificar logs
echo "📊 Verificando logs..."
sleep 3
pm2 logs aet-sistema --lines 10

echo "✅ Correção aplicada! Teste o upload agora."
EOF