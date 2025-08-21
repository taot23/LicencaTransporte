module.exports = {
  apps: [
    {
      name: "aet-license-system",
      cwd: "/var/www/aetlicensesystem/LicencaTransporte",
      script: "server/production-server.js",
      instances: 1,                     // "max" depois
      exec_mode: "cluster",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 5000,
        UPLOAD_DIR: "/var/uploads",
        DATABASE_URL: "postgresql://aetuser:*****@localhost:5432/aetlicensesystem",
        SESSION_SECRET: "troque_por_uma_chave_unica_longa"
      }
    }
  ]
}