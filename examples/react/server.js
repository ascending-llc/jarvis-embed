require('dotenv').config();
const express = require('express');

const app = express();

// Expose public config to the frontend.
app.get('/api/config', (req, res) => {
  if (!process.env.JARVIS_URL) {
    return res.status(400).json({ error: 'JARVIS_URL environment variable is required' });
  }
  res.json({
    jarvisUrl: process.env.JARVIS_URL ?? 'https://jarvis-demo.ascendingdc.com',
    jarvisSpec: process.env.JARVIS_SPEC || undefined,
  });
});

const port = process.env.PORT || 5500;
app.listen(port);
