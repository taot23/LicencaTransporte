module.exports = {
  apps: [{
    name: 'aet-license-system',
    script: './start-production.sh',
    cwd: '/var/www/aetlicensesystem/LicencaTransporte',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      VITE_CACHE_DIR: '/tmp/vite-cache',
      TMPDIR: '/tmp'
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/pm2/aet-license-system-error.log',
    out_file: '/var/log/pm2/aet-license-system-out.log',
    log_file: '/var/log/pm2/aet-license-system.log',
    time: true
  }]
};