# LAPS — laps.hostaka.fun

مستودع مستقل تابع لمنظومة هوستاكا، بنفس نمط aethercast/orbithub:
- سيرفر Express بسيط يخدّم `public/` ويعمل بروكسي شفاف لكل `/api/*` نحو `hostaka.fun`.
- **تسجيل دخول تلقائي عبر `oauth.hostaka.fun`**: عند فتح الصفحة، لو ما فيه توكن محلي، يسحبه الموقع بصمت من الوسيط المركزي (`GET /api/token` بكوكي مشترك `Domain=.hostaka.fun`)، ثم يتحقق من الهوية عبر `/api/me` — نفس آلية باقي النطاقات الفرعية (`short.js` بمشروع aethercast بعد إصلاحه).
- اللغة الافتراضية **إنجليزي**، مع زر تبديل للعربية (يحفظ التفضيل بـ`localStorage.hostaka_lang` ويُطبَّق فوراً بكل الصفحات المستقبلية عبر `i18n.js` المشترك).
- الثيم (فاتح/داكن) يتزامن تلقائياً مع باقي نطاقات هوستاكا الفرعية عبر كوكي مشتركة (`shared.js`).
- متوافق مع حزمة إيموجي هوستاكا (Fluent Emoji) عبر `emoji.js`/`emoji.css`/`emoji-catalog.json`.
- الصفحة الحالية الوحيدة: حالة فارغة تقول "لا توجد حالياً تجارب، يمكنك العودة لاحقاً"، بانتظار إضافة تجارب فعلية لاحقاً.
- 3 أزرار جانبية ثابتة: **Wiki** → `wiki.hostaka.fun`، **Main** → `hostaka.fun`، **Re-Console** → `reconsole.laps.hostaka.fun`.

## التشغيل محلياً
```bash
npm install
npm start
```

## متغيرات البيئة
- `HOSTAKA_API_BASE` (اختياري): عنوان الـ API الرئيسي المُستهدف بالبروكسي، افتراضياً `https://hostaka.fun`.
- `PORT` (اختياري): افتراضياً `3000`.

---

# Panya — معرض عام بتخزين Telegram Drive

Panya صفحة عامة بدون تسجيل دخول: أي زائر يفتح `/panya/` ويشاهد الصور والفيديوهات، وأي زائر يقدر يرفع صورة أو فيديو. الملفات نفسها تُخزَّن في مجلد **Panya** داخل Telegram Drive، والجسر المحلي يتكلم مع **REST API** الخاص بتطبيق Telegram Drive.

## تشغيل الجسر محلياً

1. افتح تطبيق **Telegram Drive** وسجّل الدخول.
2. من إعدادات التطبيق فعّل **REST API** على المنفذ `8550`.
3. أنشئ مجلداً اسمه `Panya` (أو استخدم الـ folder id مباشرة).
4. انسخ `.env.example` إلى `.env.panya` واملأ:
   - `PANYA_TELEGRAM_API_KEY`: مفتاح REST API (64 حرف hex).
   - `PANYA_TELEGRAM_FOLDER_ID`: رقم مجلد Panya من `GET /api/v1/folders`، أو اتركه فارغاً واستخدم `PANYA_TELEGRAM_FOLDER_NAME=Panya`.
5. شغّل الجسر:

```bash
npm install
# الجسر الكامل (LAPS + Panya) على 3000
npm run start:panya

# أو جسر Panya فقط على 3100 — هذا هو اللي يُعرَّض للنفق العام
npm run panya
```

> السكربتان يقرآن `.env.panya` تلقائياً. للتحكم اليدوي: `node --env-file=.env.panya panya-standalone.js`.

## النشر العام (Vercel + نفق Cloudflare)

- صفحة Panya تُخدَّم من `laps.hostaka.fun/panya/` عبر Vercel.
- الـ API يحتاج جسراً محلياً لأن Telegram Drive يعمل على جهازك. عرّض **الجسر المستقل فقط** (منفذ `3100`) عبر Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:3100
```

- في Vercel أضف متغير البيئة:
  - `PANYA_PUBLIC_API_BASE=https://<tunnel-host>/panya/api`
- لو ما تقدر تضيف متغير على Vercel، استخدم `?api=https://<tunnel-host>/panya/api` في رابط الصفحة (مفيد للتجربة فقط).
- للنشر الدائم استخدم **Named Tunnel** من Cloudflare بدل quick tunnel، وثبّت الـ hostname. النفق السريع (`trycloudflare.com`) مؤقت ويتغير عند إعادة التشغيل.

## ملاحظات مهمة

- **لا تسجيل دخول**: الرفع مفتوح للجميع. الجسر يطبّق حدود معدل، قائمة أنواع MIME مسموحة، وحد حجم افتراضي `95MB` (Cloudflare Free يحد الطلب بـ~100MB).
- **الوسائط في Telegram Drive**، بينما الوصف/الاسم الأصلي في `.panya-data/manifest.json` محلياً. لا تُرفع `.panya-data/` إلى Git.
- **تطبيق Telegram Drive يجب أن يبقى مفتوحاً ومسجلاً**. لو أُغلق، سيرجع الجسر خطأ تخزين.
- تم تعطيل **WebDAV** في إعدادات Telegram Drive لأن تشغيله مع REST API كان يسبب `database is locked` في جلسة SQLite. الجلسة نفسها حُوّلت إلى **WAL**. إن أعدت تفعيل WebDAV قد تعود مشكلة القفل.
- مفتاح REST API لا يظهر أبداً في صفحة `/panya/config` ولا في الواجهة؛ يبقى في `.env.panya` على السيرفر فقط.
- زمن تحميل الوسائط أول مرة قد يكون بطيئاً لأن Telegram Drive يجلب الملف من تيليجرام ثم يمرره للنفق. بعدها يعتمد على كاش Cloudflare/المتصفح و Range requests.
