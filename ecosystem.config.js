# pm2 process definition for the production app.
# The app reads .env from this cwd, so keep /var/www/ai-tutor/.env in place.
module.exports = {
  apps: [
    {
      name: "ai-tutor",
      script: "npm",
      args: "start",
      cwd: "/var/www/ai-tutor",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
    },
  ],
};
