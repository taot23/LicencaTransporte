module.exports = {
  apps: [
    {
      name: "aet-license-system",
      script: "./server/dist/index.js",
      instances: 1,            // ou "max"
      exec_mode: "cluster",    // melhor em produção
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 5050
        // EVITE pôr segredos aqui (ver nota no fim)
        DATABASE_URL: "postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem",
      }
    }
  ]
}