module.exports = {
  apps: [
    {
      name: "aet-license-system",
      script: "server/dist/index.js",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem",
        PORT: 5050
      }
    }
  ]
}
