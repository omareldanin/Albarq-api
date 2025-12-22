module.exports = {
  apps: [
    {
      name: "my-app",
      script: "dist/server.js",
      instances: 1, // 🔥 IMPORTANT for Puppeteer
      exec_mode: "fork",
      max_memory_restart: "8000M",
      node_args: "--max-old-space-size=4024",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
