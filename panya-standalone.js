'use strict';

// ============================================================
//  Panya — standalone public bridge.
//
//  This is the process you expose through a tunnel (or run on a
//  small VPS next to the Telegram Drive desktop app). It serves
//  ONLY the Panya page and its API; it does not expose the LAPS
//  proxy or any other part of the main site.
//
//  Start it with:
//    node --env-file=.env.panya panya-standalone.js
// ============================================================

const express = require('express');
const path = require('path');
const { createPanya } = require('./panya');

const app = express();
const panya = createPanya({
  apiUrl: process.env.PANYA_TELEGRAM_API_URL,
  apiKey: process.env.PANYA_TELEGRAM_API_KEY,
  folderId: process.env.PANYA_TELEGRAM_FOLDER_ID,
  folderName: process.env.PANYA_TELEGRAM_FOLDER_NAME,
  publicApiBase: process.env.PANYA_PUBLIC_API_BASE,
  dataDir: process.env.PANYA_DATA_DIR,
  maxUploadMb: process.env.PANYA_MAX_UPLOAD_MB,
  maxItems: process.env.PANYA_MAX_ITEMS,
  uploadsPerHour: process.env.PANYA_UPLOADS_PER_HOUR,
  listPerMinute: process.env.PANYA_LIST_PER_MINUTE,
  mediaPerMinute: process.env.PANYA_MEDIA_PER_MINUTE,
  allowedOrigins: process.env.PANYA_ALLOWED_ORIGINS,
});

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

app.get('/panya/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(panya.config());
});

app.use('/panya/api', panya.router);

app.get(/^\/panya$/, (req, res) => res.redirect(301, '/panya/'));

app.use(
  '/panya',
  express.static(path.join(__dirname, 'public', 'panya'), {
    index: 'index.html',
    maxAge: '1h',
  })
);

app.use('/panya', (req, res) => res.status(404).send('Panya page not found'));

app.use((req, res) => res.status(404).send('Panya bridge'));

const PORT = Number(process.env.PANYA_PORT) || 3100;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Panya bridge running on port ${PORT}`);
    console.log(
      process.env.PANYA_TELEGRAM_API_KEY
        ? '✅ Telegram Drive REST API configured'
        : 'ℹ️  Telegram Drive REST API not configured'
    );
  });
}

module.exports = app;
