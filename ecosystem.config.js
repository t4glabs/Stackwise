// pm2 start ecosystem.config.js
// Pick a PORT that isn't already used by your other /var/www apps (check `pm2 list`
// and `pm2 env <id>` first — Ghost commonly sits on 2368, Strapi/Next projects vary).
module.exports = {
  apps: [
    {
      name: "stackwise",
      cwd: __dirname,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3300,
      },
    },
  ],
};
