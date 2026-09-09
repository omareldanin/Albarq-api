module.exports = {
  apps: [
    {
      name: "my-app",
      script: "build/server.js",
      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      exp_backoff_restart_delay: 1000,

      max_memory_restart: "8000M",
      node_args: "--max-old-space-size=4024",

      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
