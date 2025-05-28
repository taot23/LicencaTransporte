export default {
  apps: [{
    name: 'aet-license-system',
    script: 'npm',
    args: 'start',
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
    time: true
  }]
};