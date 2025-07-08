
module.exports = {
  apps: [{
    name: 'aet-license-system',
    script: 'npx tsx server/index.ts',
    cwd: '/var/www/aetlicensesystem/LicencaTransporte',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      DATABASE_URL: 'postgresql://aetuser:AET@License2025!@localhost:5432/aetlicensesystem',
      DEBUG_PERMISSIONS: 'true',
      DEBUG_AUTH: 'true'
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/pm2/aet-license-system-error.log',
    out_file: '/var/log/pm2/aet-license-system-out.log',
    log_file: '/var/log/pm2/aet-license-system.log',
    time: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
