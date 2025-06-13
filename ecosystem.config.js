module.exports = {
  apps: [{
    name: 'aet-license-system',
    script: 'server/production-server.js',
    cwd: '/var/www/aetlicensesystem/LicencaTransporte',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
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