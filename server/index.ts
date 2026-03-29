import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import { log, setupVite } from "./vite";

const app = express();

// Flask will run on port 5001
const FLASK_PORT = 5001;
const SERVER_PORT = 5000;

// Start Flask application
log("Starting Flask API server...");

// First, seed the database
const seed = spawn('python', ['scripts/seed_db.py'], {
  env: process.env,
  stdio: 'pipe'
});

seed.stdout?.on('data', (data) => {
  log(data.toString().trim(), "seed");
});

seed.stderr?.on('data', (data) => {
  console.error(`Seed error: ${data}`);
});

seed.on('close', (code) => {
  if (code === 0) {
    log("Database seeded successfully", "seed");
  } else {
    log(`Database seed failed with code ${code}`, "seed");
  }
  
  // Start Flask server on port 5001
  const flaskEnv = { ...process.env, PORT: FLASK_PORT.toString() };
  const flask = spawn('python', ['app.py'], {
    env: flaskEnv,
    stdio: 'pipe'
  });

  flask.stdout?.on('data', (data) => {
    log(data.toString().trim(), "flask");
  });

  flask.stderr?.on('data', (data) => {
    console.error(`Flask: ${data}`);
  });

  flask.on('error', (error) => {
    console.error(`Failed to start Flask: ${error.message}`);
    process.exit(1);
  });

  flask.on('exit', (code) => {
    log(`Flask process exited with code ${code}`, "flask");
    process.exit(code || 0);
  });

  // Handle termination signals
  process.on('SIGTERM', () => {
    flask.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    flask.kill('SIGINT');
  });
});

// Proxy API requests to Flask
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${FLASK_PORT}`,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api' // Keep /api prefix when forwarding to Flask
  }
}));

// Setup Vite for frontend
const server = app.listen(SERVER_PORT, "0.0.0.0", async () => {
  await setupVite(app, server);
  log(`Server running on http://0.0.0.0:${SERVER_PORT}`);
});
