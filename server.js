// ============================================================
//  laps.hostaka.fun — سيرفر مستقل يخدّم منصة "LAPS" (تجارب هوستاكا)
//  كل منطق المصادقة/قاعدة البيانات يبقى على السيرفر الرئيسي (hostaka.fun)؛
//  هذا السيرفر واجهة + بروكسي شفاف لـ /api/* تجاهه (نفس أسلوب aethercast).
// ============================================================
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { createPanya } = require('./panya');

const app = express();

// النطاق الرئيسي لهوستاكا (وين تعيش فعلياً كل الـ API + قاعدة البيانات)
const HOSTAKA_API_BASE = process.env.HOSTAKA_API_BASE || 'https://hostaka.fun';

// ============================================================
// Panya — معرض عام مدعوم بتخزين Telegram Drive (REST API).
// الـ API يعمل فقط حين يتوفر PANYA_TELEGRAM_API_KEY (الجسر المحلي).
// على Vercel نكتفي بخدمة الواجهة + /panya/config، والواجهة
// تتصل بالجسر عبر PANYA_PUBLIC_API_BASE أو ?api=...
// ============================================================
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
// نثق بوكيل واحد فقط (بروكسي Vercel) قبل الطلب، بدل `true` اللي يثق بأي
// X-Forwarded-For ويسمح بتزوير req.ip — نفس نمط aethercast/orbithub.
app.set('trust proxy', 1);

// رؤوس أمان أساسية على كل الردود (كانت غائبة).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

// ============================================================
// بروكسي /api/* — نفس أسلوب aethercast/orbithub بالضبط
// يُستخدم هنا أساساً لجلب /api/me (تأكيد هوية المستخدم بعد سحب التوكن
// بصمت من oauth.hostaka.fun) و /api/track (تتبع الزيارات العام بالمنصة).
// ============================================================
// حدّ معدّل بسيط لكل IP على /api/* (in-memory، مثل aethercast/orbithub) —
// سابقاً كان البروكسي بلا أي حد، فمسارات الدخول/التسجيل قابلة للاجتياح عبر هذا النطاق.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 600);
const rateBuckets = new Map();
function apiRateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now - b.start > RATE_WINDOW_MS) { b = { start: now, count: 0 }; rateBuckets.set(key, b); }
  b.count += 1;
  res.setHeader('X-RateLimit-Limit', RATE_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_MAX - b.count));
  if (b.count > RATE_MAX) return res.status(429).json({ error: 'طلبات كثيرة، حاول لاحقاً' });
  if (rateBuckets.size > 10000) rateBuckets.clear();
  next();
}

app.use('/api', apiRateLimit, express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  try {
    const targetUrl = HOSTAKA_API_BASE + '/api' + req.url;

    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(key.toLowerCase())) continue;
      headers[key] = value;
    }

    const hasBody = req.body && Buffer.isBuffer(req.body) && req.body.length > 0;
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      redirect: 'manual'
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    const buf = await upstream.buffer();
    res.send(buf);
  } catch (e) {
    console.error('❌ laps proxy error:', e);
    res.status(502).json({ error: 'تعذر الاتصال بخادم هوستاكا الرئيسي' });
  }
});

// ============================================================
// Panya — الواجهة العامة + API التخزين (عبر Telegram Drive REST API)
// ============================================================
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

// لا نترك أي مسار فرعي غير موجود داخل Panya يسقط على صفحة LAPS.
app.use('/panya', (req, res) => res.status(404).send('Panya page not found'));

// ============================================================
// ملفات ثابتة (index.html/js/css، الحزم المشتركة: theme/emoji/i18n...)
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/robots.txt', (req, res) => {
  const origin = `https://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
});

// ============================================================
// sitemap.xml — Laps (laps.hostaka.fun), part of the Hostaka Ecosystem.
// Hostaka's experiments/labs page. Single-page site with no dynamic
// content yet, so the sitemap currently lists just the homepage — same
// pattern used by hostaka.fun/sitemap.xml, ready to grow if this
// subdomain gets more pages later.
// ============================================================
app.get('/sitemap.xml', (req, res) => {
  const origin = `https://${req.get('host')}`;
  res.type('application/xml').send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><priority>1.0</priority></url>
  <url><loc>${origin}/panya/</loc><priority>0.8</priority></url>
</urlset>`);
});

// صفحة واحدة فقط حالياً — أي مسار غير معروف يرجع لها بدل 404 فاضي
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ laps server running on port ${PORT} (proxying /api to ${HOSTAKA_API_BASE})`);
    console.log(
      process.env.PANYA_TELEGRAM_API_KEY
        ? '✅ Panya: Telegram Drive REST API configured'
        : 'ℹ️  Panya: storage not configured (UI/config only)'
    );
  });
}

module.exports = app;
