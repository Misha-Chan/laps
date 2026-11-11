'use strict';

// ============================================================
//  Panya — public gallery backed by Telegram Drive.
//
//  The bridge talks to Telegram Drive's local REST API
//  (default: http://127.0.0.1:8550/api/v1) and keeps only
//  captions/original names in a small local manifest. The
//  media itself lives in a dedicated Telegram Drive folder.
// ============================================================

const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { pipeline } = require('stream/promises');

const MEDIA_TYPES = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/avif': { ext: 'avif', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
  'video/ogg': { ext: 'ogv', kind: 'video' },
};

const EXT_TYPES = {};
for (const [mime, info] of Object.entries(MEDIA_TYPES)) {
  EXT_TYPES[info.ext] = { mime, kind: info.kind };
}
EXT_TYPES.jpeg = EXT_TYPES.jpg;
EXT_TYPES.m4v = EXT_TYPES.mp4;

const EXT_ALIASES = { jpeg: 'jpg', m4v: 'mp4' };

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function normalizeUrl(value) {
  const base = String(value || '').trim();
  return base ? base.replace(/\/+$/, '') : '';
}

function normalizePublicApiBase(value) {
  const base = String(value || '').trim();
  return base ? base.replace(/\/+$/, '') : '';
}

function resolveMediaType(originalName, mime) {
  const cleanMime = String(mime || '')
    .toLowerCase()
    .split(';')[0]
    .trim();

  if (MEDIA_TYPES[cleanMime]) {
    return { mime: cleanMime, ...MEDIA_TYPES[cleanMime] };
  }

  const rawExt = path.extname(String(originalName || '')).slice(1).toLowerCase();
  const ext = EXT_ALIASES[rawExt] || rawExt;
  const fromExt = EXT_TYPES[ext];
  if (fromExt) {
    return { mime: fromExt.mime, ext, kind: fromExt.kind };
  }

  return null;
}

function safeOriginalName(value) {
  const name = path.basename(String(value || ''))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return name.slice(0, 200) || 'media';
}

function sanitizeCaption(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 500);
}

function normalizeApiDate(value) {
  const text = String(value || '').trim();
  if (!text) return new Date(0).toISOString();

  const match = text.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:\s*UTC)?$/
  );
  if (match) return `${match[1]}T${match[2]}Z`;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function makeItem(file, meta = {}) {
  const type = resolveMediaType(file.name, file.mime_type);
  if (!type) return null;

  const name = String(file.name || 'media');
  return {
    id: String(file.id),
    name: meta.originalName || name,
    caption: meta.caption || '',
    mime: type.mime,
    kind: type.kind,
    size: Number(meta.size || file.size || 0),
    uploadedAt: meta.uploadedAt || normalizeApiDate(file.created_at),
    mediaPath: `/media/${encodeURIComponent(String(file.id))}/${encodeURIComponent(name)}`,
  };
}

function clientKey(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createLimiter({ windowMs, max, prefix }) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = `${prefix}:${clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      return res.status(429).json({
        error: 'طلبات كثيرة، حاول بعد قليل.',
        code: 'RATE_LIMITED',
      });
    }

    if (buckets.size > 20000) {
      for (const [bucketKey, value] of buckets) {
        if (now - value.start >= windowMs) buckets.delete(bucketKey);
      }
    }

    next();
  };
}

function createPanya(options = {}) {
  const apiUrl = normalizeUrl(options.apiUrl) || 'http://127.0.0.1:8550/api/v1';
  const apiKey = String(options.apiKey || '').trim();
  const configuredFolderId = Number(options.folderId) || null;
  const folderName = String(options.folderName || 'Panya').trim() || 'Panya';
  const publicApiBase = normalizePublicApiBase(options.publicApiBase);
  const maxUploadMb = Math.max(
    1,
    Math.min(Number(options.maxUploadMb) || 200, 2000)
  );
  const maxUploadBytes = maxUploadMb * 1024 * 1024;
  const maxItems = Math.max(1, Math.min(Number(options.maxItems) || 500, 5000));
  const uploadsPerHour = Math.max(
    1,
    Number(options.uploadsPerHour) || 20
  );
  const listPerMinute = Math.max(1, Number(options.listPerMinute) || 120);
  const mediaPerMinute = Math.max(1, Number(options.mediaPerMinute) || 600);
  const configured = Boolean(apiUrl && apiKey && (configuredFolderId || folderName));

  const dataDir = path.resolve(
    String(options.dataDir || path.join(__dirname, '.panya-data'))
  );
  const manifestPath = path.join(dataDir, 'manifest.json');
  fs.mkdirSync(dataDir, { recursive: true });

  const allowedOrigins =
    String(options.allowedOrigins || '*').trim() === '*'
      ? '*'
      : String(options.allowedOrigins)
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

  const uploadDir = path.join(os.tmpdir(), 'panya-uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, _file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`),
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: maxUploadBytes,
      files: 1,
      fields: 4,
      fieldSize: 2048,
    },
    fileFilter: (_req, file, cb) => {
      const type = resolveMediaType(file.originalname, file.mimetype);
      if (type) return cb(null, true);
      const error = new Error('نوع الملف غير مدعوم. ارفع صورة أو فيديو.');
      error.status = 415;
      error.code = 'UNSUPPORTED_MEDIA_TYPE';
      cb(error);
    },
  });

  function redact(message) {
    let text = String(message || '').split(apiUrl).join('<telegram-api>');
    if (apiKey) text = text.split(apiKey).join('<api-key>');
    return text;
  }

  function requestTelegram(pathname, requestOptions = {}) {
    const target = new URL(`${apiUrl}${pathname}`);
    const transport = target.protocol === 'https:' ? https : http;
    const headers = {
      'X-API-Key': apiKey,
      ...(requestOptions.headers || {}),
    };
    let bodyBuffer = null;

    if (requestOptions.body != null) {
      bodyBuffer = Buffer.isBuffer(requestOptions.body)
        ? requestOptions.body
        : Buffer.from(String(requestOptions.body));
      if (!headers['Content-Length'] && !headers['content-length']) {
        headers['Content-Length'] = String(bodyBuffer.length);
      }
    }

    return new Promise((resolve, reject) => {
      const req = transport.request(
        target,
        {
          method: requestOptions.method || 'GET',
          headers,
          timeout: requestOptions.timeout || 120000,
        },
        (res) => resolve(res)
      );

      req.on('timeout', () =>
        req.destroy(new Error('Telegram Drive API request timed out'))
      );
      req.on('error', reject);

      if (requestOptions.bodyStream) {
        requestOptions.bodyStream.on('error', (error) => req.destroy(error));
        requestOptions.bodyStream.pipe(req);
        return;
      }

      req.end(bodyBuffer || undefined);
    });
  }

  async function readBody(res, limit = 10 * 1024 * 1024) {
    const chunks = [];
    let total = 0;

    for await (const chunk of res) {
      total += chunk.length;
      if (total > limit) throw new Error('Telegram Drive response is too large');
      chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString('utf8');
  }

  async function readJson(res) {
    const text = await readBody(res);
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  function apiError(res, body) {
    const detail = body && body.error;
    const message =
      typeof detail === 'string'
        ? detail
        : detail && detail.message
          ? detail.message
          : `Telegram Drive API returned ${res.statusCode}`;
    const code =
      detail && typeof detail === 'object' && detail.code
        ? detail.code
        : 'TELEGRAM_API_ERROR';
    const error = new Error(message);
    error.code = code;
    error.status =
      res.statusCode === 404
        ? 404
        : res.statusCode === 503
          ? 503
          : 502;
    return error;
  }

  // ---- local metadata manifest --------------------------------

  let manifestCache = { at: 0, value: null };
  const MANIFEST_TTL = 5000;

  async function loadManifest(force = false) {
    if (
      !force &&
      manifestCache.value &&
      Date.now() - manifestCache.at < MANIFEST_TTL
    ) {
      return manifestCache.value;
    }

    try {
      const text = await fsp.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(text);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        !parsed.items ||
        typeof parsed.items !== 'object' ||
        Array.isArray(parsed.items)
      ) {
        throw new Error('invalid manifest shape');
      }
      manifestCache = { at: Date.now(), value: parsed };
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        const empty = { version: 1, items: {} };
        manifestCache = { at: Date.now(), value: empty };
        return empty;
      }
      if (error instanceof SyntaxError || error.message === 'invalid manifest shape') {
        const empty = { version: 1, items: {} };
        manifestCache = { at: Date.now(), value: empty };
        return empty;
      }
      throw error;
    }
  }

  async function saveManifest(manifest) {
    const temporary = `${manifestPath}.${process.pid}.tmp`;
    await fsp.writeFile(temporary, JSON.stringify(manifest), 'utf8');
    await fsp.rename(temporary, manifestPath);
    manifestCache = { at: Date.now(), value: manifest };
  }

  let manifestQueue = Promise.resolve();

  function withManifestLock(fn) {
    const run = manifestQueue.then(fn, fn);
    manifestQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  // ---- Telegram Drive API -------------------------------------

  let cachedFolderId = configuredFolderId;

  async function resolveFolderId() {
    if (cachedFolderId) return cachedFolderId;

    const res = await requestTelegram('/folders', { timeout: 60000 });
    const body = await readJson(res);
    if (res.statusCode !== 200) throw apiError(res, body);

    const folders = Array.isArray(body) ? body : [];
    const found = folders.find(
      (folder) =>
        String(folder.name || '').toLowerCase() === folderName.toLowerCase()
    );
    if (found && found.id) {
      cachedFolderId = Number(found.id);
      return cachedFolderId;
    }

    const createRes = await requestTelegram('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName }),
      timeout: 60000,
    });
    const created = await readJson(createRes);
    if (createRes.statusCode !== 200 || !created.id) {
      throw apiError(createRes, created);
    }
    cachedFolderId = Number(created.id);
    return cachedFolderId;
  }

  async function listFiles(folderId) {
    const files = [];
    const limit = 100;
    let page = 1;

    while (files.length < maxItems) {
      const query = new URLSearchParams({
        folder_id: String(folderId),
        limit: String(limit),
        page: String(page),
        sort: 'created_at',
        order: 'desc',
      });
      const res = await requestTelegram(`/files?${query.toString()}`, {
        timeout: 120000,
      });
      const body = await readJson(res);
      if (res.statusCode !== 200) throw apiError(res, body);

      const pageFiles = Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.files)
          ? body.files
          : [];
      files.push(...pageFiles);

      if (!body.pagination || !body.pagination.has_next || pageFiles.length === 0) {
        break;
      }
      page += 1;
    }

    return files.slice(0, maxItems);
  }

  let listCache = { at: 0, items: [] };
  const LIST_TTL = 15000;

  async function getItems(force = false) {
    if (!force && listCache.items.length && Date.now() - listCache.at < LIST_TTL) {
      return listCache.items;
    }

    const folderId = await resolveFolderId();
    const [files, manifest] = await Promise.all([
      listFiles(folderId),
      loadManifest(),
    ]);

    const items = files
      .map((file) => makeItem(file, manifest.items[String(file.id)] || {}))
      .filter(Boolean)
      .sort((a, b) => {
        const left = new Date(b.uploadedAt).getTime() || 0;
        const right = new Date(a.uploadedAt).getTime() || 0;
        return left - right;
      });

    listCache = { at: Date.now(), items };
    return items;
  }

  // ---- HTTP router --------------------------------------------

  const router = express.Router();

  router.use((req, res, next) => {
    const origin = req.headers.origin;
    let allowed = '*';

    if (allowedOrigins !== '*') {
      allowed = origin && allowedOrigins.includes(origin) ? origin : '';
    }

    if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range, Accept-Ranges'
    );
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  if (!configured) {
    router.use((_req, res) =>
      res.status(503).json({
        error:
          'تخزين Panya غير مهيأ على هذا النشر. شغّل جسر Telegram Drive المحلي وحدّد PANYA_PUBLIC_API_BASE.',
        code: 'PANYA_NOT_CONFIGURED',
      })
    );
    return {
      router,
      config: () => ({
        service: 'Panya',
        storage: 'Telegram Drive (REST API)',
        apiBase: publicApiBase,
        configured: false,
        maxUploadMb,
        maxUploadBytes,
      }),
    };
  }

  const uploadLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: uploadsPerHour,
    prefix: 'upload',
  });
  const listLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: listPerMinute,
    prefix: 'list',
  });
  const mediaLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: mediaPerMinute,
    prefix: 'media',
  });

  router.get(
    '/items',
    listLimiter,
    asyncHandler(async (_req, res) => {
      const items = await getItems();
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        service: 'Panya',
        items,
        count: items.length,
        configured: true,
      });
    })
  );

  router.post(
    '/upload',
    uploadLimiter,
    upload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        return res.status(400).json({
          error: 'اختر صورة أو فيديو أولاً.',
          code: 'FILE_REQUIRED',
        });
      }

      const type = resolveMediaType(req.file.originalname, req.file.mimetype);
      if (!type) {
        return res.status(415).json({
          error: 'نوع الملف غير مدعوم. ارفع صورة أو فيديو.',
          code: 'UNSUPPORTED_MEDIA_TYPE',
        });
      }

      const caption = sanitizeCaption(req.body && req.body.caption);
      const id = `${Date.now().toString(36)}-${crypto
        .randomBytes(4)
        .toString('hex')}`;
      const remoteName = `panya-${id}.${type.ext}`;

      try {
        const stat = await fsp.stat(req.file.path);
        const folderId = await resolveFolderId();

        const form = new FormData();
        form.append('file', fs.createReadStream(req.file.path), {
          filename: remoteName,
          contentType: type.mime,
          knownLength: stat.size,
        });
        form.append('folder_id', String(folderId));

        const headers = {
          ...form.getHeaders(),
          'X-API-Key': apiKey,
          'Content-Length': String(form.getLengthSync()),
        };

        const apiRes = await requestTelegram('/files', {
          method: 'POST',
          headers,
          bodyStream: form,
          timeout: 10 * 60 * 1000,
        });
        const body = await readJson(apiRes);
        if (apiRes.statusCode !== 200 || !body.id) {
          throw apiError(apiRes, body);
        }

        const meta = {
          caption,
          originalName: safeOriginalName(req.file.originalname),
          mime: type.mime,
          size: stat.size,
          uploadedAt: normalizeApiDate(body.created_at),
        };

        let warning = null;
        try {
          await withManifestLock(async () => {
            const manifest = await loadManifest(true);
            manifest.items[String(body.id)] = meta;
            await saveManifest(manifest);
          });
        } catch (error) {
          warning = 'تم رفع الملف، لكن تعذّر حفظ الوصف.';
          console.error('Panya manifest update failed:', redact(error.message));
        }

        listCache = { at: 0, items: [] };

        return res.status(201).json({
          service: 'Panya',
          item: makeItem(body, meta),
          warning,
        });
      } finally {
        await fsp.unlink(req.file.path).catch(() => {});
      }
    })
  );

  async function serveMedia(req, res) {
    const fileId = Number(req.params.id);
    if (!Number.isInteger(fileId) || fileId <= 0) {
      return res.status(404).json({ error: 'الملف غير موجود.', code: 'NOT_FOUND' });
    }

    const name = String(req.params.name || '');
    const type = resolveMediaType(name, '');
    if (!type) {
      return res.status(404).json({ error: 'الملف غير موجود.', code: 'NOT_FOUND' });
    }

    const folderId = await resolveFolderId();
    const isHead = req.method === 'HEAD';
    const clientRange = req.headers.range;
    const headers = {};
    if (clientRange) headers.Range = clientRange;
    if (req.headers['if-range']) headers['If-Range'] = req.headers['if-range'];
    // Telegram Drive's Actix route is GET-only (HEAD returns 404), so probe
    // with a one-byte ranged GET when the client asked for HEAD without a
    // range. The 206 headers tell us the real total size.
    if (isHead && !clientRange) headers.Range = 'bytes=0-0';

    const downloadPath = `/files/${fileId}/download?folder_id=${encodeURIComponent(
      String(folderId)
    )}`;

    const upstream = await requestTelegram(downloadPath, {
      method: 'GET',
      headers,
      timeout: 10 * 60 * 1000,
    });

    if (![200, 206].includes(upstream.statusCode)) {
      const body = await readJson(upstream);
      const error = apiError(upstream, body);
      return res.status(error.status || 502).json({
        error:
          error.status === 404
            ? 'الملف غير موجود.'
            : 'تعذّر جلب الملف من Telegram Drive.',
        code: error.code || 'STORAGE_ERROR',
      });
    }

    const headProbe = isHead && !clientRange;
    res.status(headProbe ? 200 : upstream.statusCode);
    res.setHeader('Content-Type', type.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`
    );

    if (headProbe) {
      const totalMatch = String(upstream.headers['content-range'] || '').match(
        /\/\s*(\d+)\s*$/
      );
      if (totalMatch) {
        res.setHeader('Content-Length', totalMatch[1]);
      } else if (upstream.headers['content-length']) {
        res.setHeader('Content-Length', upstream.headers['content-length']);
      }
    } else {
      if (upstream.headers['content-length']) {
        res.setHeader('Content-Length', upstream.headers['content-length']);
      }
      if (upstream.headers['content-range']) {
        res.setHeader('Content-Range', upstream.headers['content-range']);
      }
    }

    if (upstream.headers['etag']) {
      res.setHeader('ETag', upstream.headers['etag']);
    }
    if (upstream.headers['last-modified']) {
      res.setHeader('Last-Modified', upstream.headers['last-modified']);
    }

    if (isHead) {
      upstream.resume();
      return res.end();
    }

    try {
      await pipeline(upstream, res);
    } catch (error) {
      if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        if (!res.headersSent) throw error;
        res.destroy();
      }
    }
  }

  router.get('/media/:id/:name', mediaLimiter, asyncHandler(serveMedia));
  router.head('/media/:id/:name', mediaLimiter, asyncHandler(serveMedia));

  router.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `حجم الملف أكبر من الحد المسموح (${maxUploadMb}MB).`,
          code: 'FILE_TOO_LARGE',
          maxUploadMb,
        });
      }
      return res.status(400).json({
        error: 'تعذّر قراءة الملف المرفوع.',
        code: error.code || 'UPLOAD_ERROR',
      });
    }

    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code || 'PANYA_ERROR',
      });
    }

    console.error('Panya storage error:', redact(error.stack || error.message));
    res.status(502).json({
      error:
        'تعذّر الوصول إلى Telegram Drive. تأكد من أن التطبيق مفتوح وأن REST API مفعّل.',
      code: 'STORAGE_ERROR',
    });
  });

  return {
    router,
    config: () => ({
      service: 'Panya',
      storage: 'Telegram Drive (REST API)',
      apiBase: publicApiBase,
      configured: true,
      maxUploadMb,
      maxUploadBytes,
    }),
  };
}

module.exports = { createPanya };
