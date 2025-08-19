module.exports = {
  apps: [
    {
      name: "aet-server",
      script: "server/dist/index.js", // caminho do seu build do backend
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 5050
      }
    },
    {
      name: "aet-client",
      script: "node_modules/vite/bin/vite.js",
      args: "preview --host 0.0.0.0 --port 5000",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}
