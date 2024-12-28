require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const secretToken = process.env.WEBHOOK_SERVER_AUTH_TOKEN;

// Middleware Configuration
app.set('trust proxy', 1); // For rate limiter behind a proxy
app.use(bodyParser.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests, please try again later.',
  })
);

// Middleware for validating the secret token
app.use((req, res, next) => {
  const authToken = req.headers['x-auth-token'];
  if (authToken !== secretToken) {
    console.error(`[${new Date().toISOString()}] ERROR: Invalid or missing token`);
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
  next();
});

// Helper function to log and respond to webhook errors
const handleWebhookError = (res, error, message) => {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error);
  res.status(500).json({ error: message });
};

// Webhook endpoint for initiating scans
app.post('/webhook', (req, res) => {
  const { url: websiteUrl, isBaseline } = req.body;
  if (!websiteUrl) {
    console.error(`[${new Date().toISOString()}] ERROR: Missing website URL in request body`);
    return res.status(400).json({ error: 'Missing website URL' });
  }

  console.log(`[${new Date().toISOString()}] INFO: Webhook received: URL=${websiteUrl}, Baseline=${isBaseline}`);
  res.status(200).json({
    message: 'Webhook received successfully',
    websiteUrl,
    baseline: isBaseline,
    timestamp: new Date().toISOString(),
  });

  const baselineFlag =
    isBaseline?.toString().trim().toLowerCase() === 'true' ? '--baseline' : '';
  const commandArgs = ['inspections/scan-website.js', websiteUrl];
  if (baselineFlag) commandArgs.push(baselineFlag);

  console.log(`[${new Date().toISOString()}] INFO: Executing scan-website.js with args: ${commandArgs.join(' ')}`);
  const scanProcess = spawn('node', commandArgs, { stdio: 'inherit' });

  scanProcess.on('close', (code) => {
    if (code === 0) {
      console.log(`[${new Date().toISOString()}] INFO: Inspection completed successfully for ${websiteUrl}`);
    } else {
      console.error(`[${new Date().toISOString()}] ERROR: scan-website.js exited with code ${code}`);
    }
  });

  scanProcess.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] ERROR: Error executing scan-website.js: ${err.message}`);
  });
});

// Webhook endpoint for outbound regression notifications
app.post('/regression', async (req, res) => {
  const { htmlContent } = req.body;
  const outboundEndpoint = process.env.OUTBOUND_ENDPOINT;

  if (!htmlContent) {
    console.error(`[${new Date().toISOString()}] ERROR: Missing HTML content in regression notification`);
    return res.status(400).json({ error: 'Missing HTML content' });
  }

  console.log(`[${new Date().toISOString()}] INFO: Regression notification received`);
  try {
    await axios.post(outboundEndpoint, { htmlContent });
    console.log(`[${new Date().toISOString()}] INFO: Regression notification sent successfully`);
    res.status(200).json({ message: 'Regression notification sent' });
  } catch (error) {
    handleWebhookError(res, error, 'Failed to send regression notification');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] INFO: Webhook server running on port ${PORT}`);
});
