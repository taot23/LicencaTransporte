module.exports = {
  apps: [{
    name: 'aet-sistema',
    script: 'server/index.ts',          // ✅ Usa index.ts
    interpreter: 'tsx',                 // ✅ Usa TSX para TypeScript
    cwd: '/var/www/aetlicensesystem/LicencaTransporte',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000, //porta que incializar o serviço
      UPLOAD_DIR: '/var/www/aetlicensesystem/uploads',
    },
    env_file: '.env.production',
    log_file: '/var/log/aet/combined.log',
    out_file: '/var/log/aet/out.log',
    error_file: '/var/log/aet/error.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'uploads', 'dist']
  }]
}