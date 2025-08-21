import path from "node:path";
import fs from "node:fs/promises";

const UPLOAD_BASE = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

function toSlug(raw: string): string {
  return (raw || "desconhecido")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function exists(p: string) { try { await fs.stat(p); return true; } catch { return false; } }

export function buildLicenseDir(opts: { transporter: string; state: string; licenseNumber: string }) {
  const t = toSlug(opts.transporter);
  const uf = toSlug(opts.state).toUpperCase();
  const lic = toSlug(opts.licenseNumber);
  return {
    absDir: path.join(UPLOAD_BASE, "licenses", t, uf, lic),
    relUrlBase: `/uploads/licenses/${encodeURIComponent(t)}/${encodeURIComponent(uf)}/${encodeURIComponent(lic)}`
  };
}

export async function saveLicenseFile(params: {
  buffer: Buffer;
  originalName: string;    // ex.: "2025-08-07.pdf"
  transporter: string;     // ex.: "Transportadora X"
  state: string;           // ex.: "PR"
  licenseNumber: string;   // ex.: "AET-09466425"
}) {
  const { absDir, relUrlBase } = buildLicenseDir(params);
  await fs.mkdir(absDir, { recursive: true });

  const ext = (path.extname(params.originalName) || ".pdf").toLowerCase();
  const base = toSlug(path.basename(params.originalName, ext)) || "arquivo";
  let file = `${base}${ext}`;
  let outPath = path.join(absDir, file);
  let i = 1;
  while (await exists(outPath)) { file = `${base}-${i++}${ext}`; outPath = path.join(absDir, file); }

  await fs.writeFile(outPath, params.buffer);
  const publicUrl = `${relUrlBase}/${encodeURIComponent(file)}`;
  console.info("[UPLOAD] destino:", outPath, "url:", publicUrl);
  return { outPath, publicUrl };
}