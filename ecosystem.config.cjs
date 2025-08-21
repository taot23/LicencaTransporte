module.exports = {
  apps: [
    {
      name: 'aet-license-system',
      script: 'server/index.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,          // Pode mudar para "max" se quiser usar todos os cores
      autorestart: true,     // Reinicia se cair
      watch: false,          // Evita reinício a cada alteração (bom em produção)
      env: {
        NODE_ENV: 'production',
        PORT: 5000,

        # Banco principal
        DATABASE_URL: 'postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem',

        # Configurações adicionais
        UPLOAD_DIR: '/var/uploads',
        SESSION_SECRET: 'sua_chave_secreta_muito_longa_e_segura_aqui_mude_isso_por_uma_chave_unica',
        COOKIE_SECURE: 'true',
        REDIS_URL: 'redis://localhost:6379',
        LOG_LEVEL: 'info',

        # Variáveis PostgreSQL
        PGHOST: 'localhost',
        PGPORT: '5432',
        PGDATABASE: 'aet_production',
        PGUSER: 'aet_user',
        PGPASSWORD: 'nvs123',

        # Backup
        BACKUP_ENABLED: 'true',
        BACKUP_SCHEDULE: '0 2 * * *',

        # Upload
        MAX_FILE_SIZE: '100'
      }
    }
  ]
};
