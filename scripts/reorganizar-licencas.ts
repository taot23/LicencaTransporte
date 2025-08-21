import path from "node:path";
import fs from "node:fs/promises";
import { Client } from "pg";
import { saveLicenseFile } from "../server/lib/storage";

const UPLOAD_BASE = process.env.UPLOAD_DIR || "/var/uploads";

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const { rows } = await db.query(`
    SELECT l.id, l.number AS license_number,
           COALESCE(l.state, t.state) AS state,
           t.name AS transporter,
           l.file_url
    FROM licenses l
    JOIN transporters t ON t.id = l.transporter_id
    WHERE l.file_url IS NOT NULL
  `);

  for (const r of rows) {
    const rel = r.file_url.replace(/^\/uploads\//, "");
    const oldAbs = path.join(UPLOAD_BASE, rel);
    try {
      const buf = await fs.readFile(oldAbs);
      const { publicUrl } = await saveLicenseFile({
        buffer: buf,
        originalName: path.basename(oldAbs),
        transporter: r.transporter,
        state: r.state,
        licenseNumber: r.license_number
      });
      if (publicUrl !== r.file_url) {
        await db.query(`UPDATE licenses SET file_url = $1 WHERE id = $2`, [publicUrl, r.id]);
        await fs.rm(oldAbs).catch(() => {});
        console.log(`✔ ${r.file_url} -> ${publicUrl}`);
      }
    } catch (e:any) {
      console.error(`✖ falha em ${oldAbs}: ${e.message}`);
    }
  }

  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });