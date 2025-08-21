import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

const UPLOAD_BASE = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

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
  const { absDir, relUrlBase } = buildLicenseDir(params);
  
  // Criar diretório recursivamente se não existir
  await fs.mkdir(absDir, { recursive: true });

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

  // Salvar arquivo
  await fs.writeFile(fullPath, params.buffer);

  const publicUrl = `${relUrlBase}/${encodeURIComponent(fileName)}`;
  return { filePath: fullPath, publicUrl };
}

// Função para obter dados da licença e transportadora (para ser usado nos endpoints)
export interface LicenseMetadata {
  transporter: string;
  state: string;
  licenseNumber: string;
}