module.exports = {
  apps: [{
    name: 'nextads',
    script: 'server.js',
    cwd: '/home/impulsione_midia1/nextads',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/home/impulsione_midia1/nextads/logs/err.log',
    out_file: '/home/impulsione_midia1/nextads/logs/out.log',
    log_file: '/home/impulsione_midia1/nextads/logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s'
  }],

  deploy: {
    production: {
      user: 'impulsione_midia1',
      host: 'nextads.pro',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/nextads.git',
      path: '/home/impulsione_midia1/nextads',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};