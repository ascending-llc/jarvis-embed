require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use('/sdk', express.static(path.join(__dirname, '../../dist')));

// Expose public config to the frontend (client secret never leaves the server)
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    redirectUri: process.env.REDIRECT_URI,
    jarvisUrl: process.env.JARVIS_URL ?? 'https://jarvis-demo.ascendingdc.com',
    jarvisSpec: process.env.JARVIS_SPEC || undefined,
  });
});

// Exchange a Google authorization code for an id_token.
// Keeping GOOGLE_CLIENT_SECRET server-side is critical — never expose it in the browser.
app.post('/api/google/token', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(400).json({ error: data.error_description ?? data.error });

  res.json({ token: data.id_token });
});

app.get('/redirect', (req, res) => res.sendFile(path.join(__dirname, 'redirect.html')));

const port = process.env.PORT || 5500;
app.listen(port, () => console.log(`Running at http://localhost:${port}`));
