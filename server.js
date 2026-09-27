#!/usr/bin/env node
/**
 * One-button WhatsApp sender.
 *
 *   npm run ui   ->  http://localhost:3000
 *
 * The page has a single button. Pressing it posts here, and this sends the
 * template named by TWILIO_CONTENT_SID to the number in MY_WHATSAPP_TO. All
 * configuration lives server-side; the browser sends no parameters and receives
 * nothing identifying.
 *
 * Credentials never reach the browser, and Twilio's API rejects direct browser
 * calls anyway - which is why a backend is required at all.
 */

'use strict';

try {
  require('dotenv').config();
} catch (err) {
  console.error('Could not load dotenv. Run `npm install` first.');
  process.exit(1);
}

const path = require('path');
const express = require('express');
const { loadConfig, send } = require('./lib/twilio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Twilio allows one WhatsApp message every three seconds. On a public URL this
// cooldown is also the only thing between visitors and the trial's quota.
const COOLDOWN_MS = 3000;
let lastSendAt = 0;

app.post('/api/send', async (req, res) => {
  const config = loadConfig();
  if (!config.ok) {
    return res.status(500).json({
      ok: false,
      message: 'The server is not configured.',
      note: `Missing environment variables: ${config.missing.join(', ')}`,
    });
  }

  const waitMs = COOLDOWN_MS - (Date.now() - lastSendAt);
  if (waitMs > 0) {
    return res.status(429).json({
      ok: false,
      message: 'Too fast.',
      note: `Twilio allows one message every ${COOLDOWN_MS / 1000} seconds. Try again in ${Math.ceil(waitMs / 1000)}s.`,
    });
  }
  lastSendAt = Date.now();

  const result = await send(config.config);

  // Log the outcome only. Never the recipient, the SID, or the message body.
  console.log(result.ok ? `send ok (status=${result.status})` : `send failed (code=${result.code ?? 'none'})`);

  res.status(result.ok ? 200 : 502).json(result);
});

// Only bind a port when run directly. On Vercel the app is imported by
// api/index.js and invoked per request, where listen() would be wrong.
if (require.main === module) {
  app.listen(PORT, () => {
    const config = loadConfig();
    console.log('');
    console.log(`  WhatsApp sender  ->  http://localhost:${PORT}`);
    console.log('');
    if (config.ok) {
      console.log('  Configured and ready. One button, one template send.');
    } else {
      console.log(`  Not configured. Missing: ${config.missing.join(', ')}`);
      console.log('  The page will report this when you press the button.');
    }
    console.log('');
  });
}

module.exports = app;
