'use strict';

const STRINGS = {
  ar: {
    pageTitle: 'Panya — معرض هوستاكا العام',
    tagline: 'معرض عام',
    refresh: 'تحديث',
    upload: 'رفع',
    storageNote: 'مدعوم بتخزين Telegram Drive',
    trialBadge: 'تجربة',
    trialNote: 'Panya تجربة جديدة لتخزين الوسائط على Telegram Drive. قد يتوقف المعرض مؤقتًا إذا تعلّق تطبيق Telegram Drive أو انقطع الاتصال.',
    heroTitle: 'شارك لحظة، وشوفها أي أحد.',
    heroText: 'Panya معرض صور وفيديو عام بدون تسجيل دخول. ارفع ملفك وسيظهر مباشرة للجميع.',
    noLogin: 'بدون تسجيل دخول',
    galleryTitle: 'أحدث المشاركات',
    loading: 'جارٍ التحميل…',
    emptyTitle: 'المعرض فاضي حالياً',
    emptyText: 'كن أول من يرفع صورة أو فيديو إلى Panya.',
    errorTitle: 'تعذّر تحميل المعرض',
    retry: 'إعادة المحاولة',
    uploadEyebrow: 'إضافة إلى المعرض',
    uploadTitle: 'رفع صورة أو فيديو',
    chooseFile: 'اختر صورة أو فيديو',
    dropHint: 'أو اسحب الملف هنا',
    caption: 'وصف (اختياري)',
    captionPlaceholder: 'اكتب وصفاً قصيراً…',
    cancel: 'إلغاء',
    publish: 'نشر',
    uploading: 'جارٍ الرفع…',
    uploadSuccess: 'تم النشر في Panya.',
    uploadError: 'تعذّر رفع الملف.',
    fileTooLarge: 'حجم الملف أكبر من الحد المسموح.',
    unsupported: 'نوع الملف غير مدعوم.',
    noCaption: 'بدون وصف',
    image: 'صورة',
    video: 'فيديو',
    open: 'عرض',
    close: 'إغلاق',
    configuredHint: 'هذه النسخة تحتاج جسر Telegram Drive المحلي. شغّل الجسر ثم أضف ?api=... إلى الرابط.',
    storageError: 'تعذّر الوصول إلى Telegram Drive. تأكد من أن التطبيق مفتوح ومتصل.',
    count: '{n} مشاركة',
    groupExplore: 'استكشف',
    groupMedia: 'الوسائط',
    groupEcosystem: 'المنظومة',
    filterAll: 'كل الوسائط',
    filterImages: 'الصور',
    filterVideos: 'الفيديوهات',
    searchPlaceholder: 'ابحث في المعرض…',
    backToLaps: 'LAPS',
    navWiki: 'الويكي',
    navMain: 'الرئيسية',
    noResultsTitle: 'لا توجد نتائج',
    noResultsText: 'جرّب بحثاً أو تصنيفاً آخر.',
  },
  en: {
    pageTitle: 'Panya — Hostaka public gallery',
    tagline: 'Public gallery',
    refresh: 'Refresh',
    upload: 'Upload',
    storageNote: 'Stored on Telegram Drive',
    trialBadge: 'Trial',
    trialNote: 'Panya is a new experiment using Telegram Drive for media storage. The gallery may pause briefly if the Telegram Drive app hangs or loses connection.',
    heroTitle: 'Share a moment. Let everyone see it.',
    heroText: 'Panya is a public image and video gallery with no sign-in. Upload a file and it appears for everyone.',
    noLogin: 'No sign-in needed',
    galleryTitle: 'Latest posts',
    loading: 'Loading…',
    emptyTitle: 'The gallery is empty',
    emptyText: 'Be the first to upload an image or video to Panya.',
    errorTitle: 'Could not load the gallery',
    retry: 'Try again',
    uploadEyebrow: 'Add to the gallery',
    uploadTitle: 'Upload an image or video',
    chooseFile: 'Choose an image or video',
    dropHint: 'or drag the file here',
    caption: 'Caption (optional)',
    captionPlaceholder: 'Write a short caption…',
    cancel: 'Cancel',
    publish: 'Publish',
    uploading: 'Uploading…',
    uploadSuccess: 'Published to Panya.',
    uploadError: 'Could not upload the file.',
    fileTooLarge: 'The file is larger than the allowed limit.',
    unsupported: 'This file type is not supported.',
    noCaption: 'No caption',
    image: 'Image',
    video: 'Video',
    open: 'Open',
    close: 'Close',
    configuredHint: 'This deployment needs the local Telegram Drive bridge. Start the bridge, then add ?api=... to the URL.',
    storageError: 'Could not reach Telegram Drive. Make sure the app is open and connected.',
    count: '{n} posts',
    groupExplore: 'Explore',
    groupMedia: 'Media',
    groupEcosystem: 'Ecosystem',
    filterAll: 'All media',
    filterImages: 'Images',
    filterVideos: 'Videos',
    searchPlaceholder: 'Search gallery…',
    backToLaps: 'LAPS',
    navWiki: 'Wiki',
    navMain: 'Main',
    noResultsTitle: 'No results',
    noResultsText: 'Try a different search or filter.',
  },
};

const state = {
  lang:
    localStorage.getItem('panya-lang') ||
    ((navigator.language || '').startsWith('ar') ? 'ar' : 'en'),
  apiBase: '/panya/api',
  items: [],
  filter: 'all',
  search: '',
  selectedFile: null,
  uploading: false,
  config: {
    maxUploadMb: 200,
    maxUploadBytes: 200 * 1024 * 1024,
  },
};

const gallery = document.getElementById('gallery');
const emptyState = document.getElementById('empty');
const errorState = document.getElementById('error');
const noResultsState = document.getElementById('no-results');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const countLabel = document.getElementById('count');
const refreshBtn = document.getElementById('refresh-btn');
const uploadBtn = document.getElementById('upload-btn');
const heroUpload = document.getElementById('hero-upload');
const emptyUpload = document.getElementById('empty-upload');
const langToggle = document.getElementById('lang-toggle');
const langLabel = document.getElementById('lang-label');
const panyaSearch = document.getElementById('panya-search');
const navUpload = document.getElementById('nav-upload');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarUpload = document.getElementById('sidebar-upload');
const sidebarRefresh = document.getElementById('sidebar-refresh');
const filterButtons = Array.from(document.querySelectorAll('[data-gallery-filter]'));

const uploadDialog = document.getElementById('upload-dialog');
const uploadForm = document.getElementById('upload-form');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const captionInput = document.getElementById('caption');
const submitUpload = document.getElementById('submit-upload');
const progressWrap = document.getElementById('progress-wrap');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const uploadError = document.getElementById('upload-error');

const viewer = document.getElementById('viewer');
const viewerStage = document.getElementById('viewer-stage');
const viewerCaption = document.getElementById('viewer-caption');
const viewerMeta = document.getElementById('viewer-meta');
const viewerClose = viewer.querySelector('[data-close-viewer]');

const toast = document.getElementById('toast');
let toastTimer = null;

function t(key) {
  const table = STRINGS[state.lang] || STRINGS.ar;
  return table[key] ?? STRINGS.ar[key] ?? key;
}

function normalizeApiBase(raw) {
  let value = String(raw || '').trim();
  if (!value) return '/panya/api';

  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    let pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname.endsWith('/panya/api')) {
      if (pathname.endsWith('/panya')) pathname += '/api';
      else pathname += '/panya/api';
    }
    url.pathname = pathname;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  }

  if (!value.startsWith('/')) value = `/${value}`;
  value = value.replace(/\/+$/, '');
  if (value.endsWith('/panya/api')) return value;
  if (value.endsWith('/panya')) return `${value}/api`;
  if (value === '' || value === '/') return '/panya/api';
  return `${value}/panya/api`;
}

async function resolveApiBase() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('api');
  if (fromQuery) return normalizeApiBase(fromQuery);

  if (window.PANYA_API_BASE) return normalizeApiBase(window.PANYA_API_BASE);

  try {
    const response = await fetch('/panya/config', { cache: 'no-store' });
    if (response.ok) {
      const config = await response.json();
      if (Number(config.maxUploadBytes) > 0) {
        state.config.maxUploadBytes = Number(config.maxUploadBytes);
      }
      if (Number(config.maxUploadMb) > 0) {
        state.config.maxUploadMb = Number(config.maxUploadMb);
      }
      if (config.apiBase) return normalizeApiBase(config.apiBase);
    }
  } catch {
    // Same-origin fallback is handled below.
  }

  return '/panya/api';
}

function apiUrl(pathname) {
  return `${state.apiBase}${pathname}`;
}

function formatSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('pageTitle');
  const langText = state.lang === 'ar' ? 'EN' : 'ع';
  if (langLabel) langLabel.textContent = langText;
  else if (langToggle) langToggle.textContent = langText;

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    const value = t(key);
    if (value) element.textContent = value;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    const value = t(key);
    if (value) element.placeholder = value;
  });

  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const key = element.dataset.i18nTitle;
    const value = t(key);
    if (value) element.title = value;
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    const value = t(key);
    if (value) element.setAttribute('aria-label', value);
  });

  if (state.items.length) {
    renderItems();
  } else if (gallery.querySelector('.skeleton-card')) {
    countLabel.textContent = t('loading');
  }
}

function showToast(message) {
  if (!message) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 4500);
}

function showSkeleton() {
  gallery.textContent = '';
  gallery.setAttribute('aria-busy', 'true');
  emptyState.hidden = true;
  errorState.hidden = true;
  if (noResultsState) noResultsState.hidden = true;
  countLabel.textContent = t('loading');

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 8; index += 1) {
    const card = document.createElement('div');
    card.className = 'card skeleton-card';

    const media = document.createElement('div');
    media.className = 'skeleton-media';
    media.style.height = `${160 + (index % 4) * 58}px`;

    const body = document.createElement('div');
    body.className = 'skeleton-body';
    const line = document.createElement('div');
    line.className = 'skeleton-line';
    const shortLine = document.createElement('div');
    shortLine.className = 'skeleton-line short';
    body.append(line, shortLine);

    card.append(media, body);
    fragment.appendChild(card);
  }

  gallery.appendChild(fragment);
}

function showError(message, allowRetry = true) {
  gallery.textContent = '';
  gallery.setAttribute('aria-busy', 'false');
  emptyState.hidden = true;
  errorState.hidden = false;
  if (noResultsState) noResultsState.hidden = true;
  errorMessage.textContent = message || t('storageError');
  countLabel.textContent = '';
  retryBtn.hidden = !allowRetry;
}

function hideError() {
  errorState.hidden = true;
}

function visibleItems() {
  const query = state.search;

  return state.items.filter((item) => {
    if (state.filter === 'images' && item.kind !== 'image') return false;
    if (state.filter === 'videos' && item.kind !== 'video') return false;

    if (query) {
      const haystack = `${item.caption || ''} ${item.name || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function renderItems() {
  gallery.textContent = '';
  gallery.setAttribute('aria-busy', 'false');
  hideError();

  if (!state.items.length) {
    emptyState.hidden = false;
    if (noResultsState) noResultsState.hidden = true;
    countLabel.textContent = '';
    return;
  }

  const items = visibleItems();
  emptyState.hidden = true;
  if (noResultsState) noResultsState.hidden = items.length !== 0;
  countLabel.textContent = t('count').replace('{n}', String(items.length));

  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.appendChild(createCard(item)));
  gallery.appendChild(fragment);
}

function createCard(item) {
  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('aria-label', item.caption || item.name || t('open'));

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'card-media';

  const source = apiUrl(item.mediaPath);

  if (item.kind === 'video') {
    const video = document.createElement('video');
    video.src = source;
    video.controls = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    mediaWrap.appendChild(video);
  } else {
    const image = document.createElement('img');
    image.src = source;
    image.alt = item.caption || item.name || 'Panya media';
    image.loading = 'lazy';
    image.decoding = 'async';
    mediaWrap.appendChild(image);
  }

  const badge = document.createElement('span');
  badge.className = `badge ${item.kind === 'video' ? 'video' : 'image'}`;
  badge.textContent = t(item.kind === 'video' ? 'video' : 'image');
  mediaWrap.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'card-body';

  const caption = document.createElement('p');
  caption.className = 'card-caption';
  if (item.caption) {
    caption.textContent = item.caption;
  } else {
    caption.textContent = t('noCaption');
    caption.classList.add('muted');
  }

  const meta = document.createElement('p');
  meta.className = 'card-meta';
  meta.textContent = [formatSize(item.size), formatDate(item.uploadedAt)]
    .filter(Boolean)
    .join(' · ');

  body.append(caption, meta);
  card.append(mediaWrap, body);

  card.addEventListener('click', (event) => {
    if (event.target.closest('video, a, button')) return;
    openViewer(item);
  });

  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('video, a, button')) return;
    event.preventDefault();
    openViewer(item);
  });

  return card;
}

async function loadItems({ silent = false } = {}) {
  if (!silent) showSkeleton();
  hideError();

  try {
    const response = await fetch(apiUrl('/items'), { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.code = data.code;
      throw error;
    }

    state.items = Array.isArray(data.items) ? data.items : [];
    renderItems();
  } catch (error) {
    if (silent && state.items.length) return;

    if (error.code === 'PANYA_NOT_CONFIGURED') {
      showError(t('configuredHint'), false);
    } else {
      showError(error.message || t('storageError'), true);
    }
  }
}

function openViewer(item) {
  if (viewer.open) viewer.close();
  viewerStage.textContent = '';

  const source = apiUrl(item.mediaPath);

  if (item.kind === 'video') {
    const video = document.createElement('video');
    video.src = source;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    viewerStage.appendChild(video);
  } else {
    const image = document.createElement('img');
    image.src = source;
    image.alt = item.caption || item.name || 'Panya media';
    viewerStage.appendChild(image);
  }

  viewerCaption.textContent = item.caption || item.name || t('noCaption');
  viewerMeta.textContent = [formatSize(item.size), formatDate(item.uploadedAt)]
    .filter(Boolean)
    .join(' · ');

  viewer.showModal();
  viewerClose.focus();
}

function isAllowedFile(file) {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/ogg',
  ];
  const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'mp4', 'webm', 'mov', 'ogv'];
  const ext = String(file.name || '').split('.').pop().toLowerCase();
  return allowedMimes.includes(file.type) || allowedExt.includes(ext);
}

function showFormError(message) {
  uploadError.textContent = message;
  uploadError.hidden = !message;
}

function clearFormError() {
  uploadError.textContent = '';
  uploadError.hidden = true;
}

function setSelectedFile(file) {
  if (state.uploading) return;

  clearFormError();

  if (!isAllowedFile(file)) {
    state.selectedFile = null;
    fileInfo.hidden = true;
    submitUpload.disabled = true;
    showFormError(t('unsupported'));
    return;
  }

  if (file.size > state.config.maxUploadBytes) {
    state.selectedFile = null;
    fileInfo.hidden = true;
    submitUpload.disabled = true;
    showFormError(`${t('fileTooLarge')} (${state.config.maxUploadMb}MB)`);
    return;
  }

  state.selectedFile = file;
  fileInfo.textContent = `${file.name} · ${formatSize(file.size)}`;
  fileInfo.hidden = false;
  submitUpload.disabled = false;
}

function resetUploadForm() {
  state.selectedFile = null;
  state.uploading = false;
  fileInput.value = '';
  captionInput.value = '';
  fileInfo.textContent = '';
  fileInfo.hidden = true;
  progressWrap.hidden = true;
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  submitUpload.disabled = true;
  submitUpload.textContent = t('publish');
  clearFormError();
}

function openUploadDialog() {
  resetUploadForm();
  uploadDialog.showModal();
  window.setTimeout(() => dropzone.focus(), 60);
}

function closeUploadDialog() {
  if (state.uploading) return;
  uploadDialog.close();
}

function uploadSelectedFile() {
  if (!state.selectedFile || state.uploading) return;

  state.uploading = true;
  clearFormError();
  submitUpload.disabled = true;
  submitUpload.textContent = t('uploading');
  progressWrap.hidden = false;
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  const formData = new FormData();
  formData.append('file', state.selectedFile);

  const caption = captionInput.value.trim();
  if (caption) formData.append('caption', caption);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl('/upload'), true);

  xhr.upload.addEventListener('progress', (event) => {
    if (!event.lengthComputable) {
      progressText.textContent = '…';
      return;
    }
    const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
  });

  xhr.addEventListener('load', () => {
    state.uploading = false;
    submitUpload.textContent = t('publish');
    submitUpload.disabled = false;

    let data = {};
    try {
      data = JSON.parse(xhr.responseText || '{}');
    } catch {
      data = {};
    }

    if (xhr.status >= 200 && xhr.status < 300 && data.item) {
      state.items.unshift(data.item);
      renderItems();
      showToast(t('uploadSuccess') + (data.warning ? ` ${data.warning}` : ''));
      uploadDialog.close();
      resetUploadForm();
      return;
    }

    if (data.code === 'FILE_TOO_LARGE') {
      showFormError(`${t('fileTooLarge')} (${state.config.maxUploadMb}MB)`);
    } else {
      showFormError(data.error || t('uploadError'));
    }
  });

  xhr.addEventListener('error', () => {
    state.uploading = false;
    submitUpload.textContent = t('publish');
    submitUpload.disabled = false;
    showFormError(t('storageError'));
  });

  xhr.addEventListener('abort', () => {
    state.uploading = false;
    submitUpload.textContent = t('publish');
    submitUpload.disabled = false;
  });

  xhr.send(formData);
}

// ---- events -------------------------------------------------

langToggle.addEventListener('click', () => {
  state.lang = state.lang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('panya-lang', state.lang);
  applyLanguage();
});

refreshBtn.addEventListener('click', () => loadItems());
retryBtn.addEventListener('click', () => loadItems());
uploadBtn.addEventListener('click', openUploadDialog);
heroUpload.addEventListener('click', openUploadDialog);
emptyUpload.addEventListener('click', openUploadDialog);
navUpload?.addEventListener('click', openUploadDialog);
sidebarUpload?.addEventListener('click', openUploadDialog);
sidebarRefresh?.addEventListener('click', () => loadItems());

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.galleryFilter || 'all';
    filterButtons.forEach((candidate) => {
      candidate.classList.toggle('active', candidate === button);
    });
    renderItems();
  });
});

panyaSearch?.addEventListener('input', () => {
  state.search = panyaSearch.value.trim().toLowerCase();
  renderItems();
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    panyaSearch?.focus();
    panyaSearch?.select();
  }
});

// Mobile sidebar drawer
function closeSidebar() {
  if (!sidebar) return;
  sidebar.classList.remove('open');
  sidebarOverlay?.classList.remove('show');
  sidebarToggle?.setAttribute('aria-expanded', 'false');
}

if (sidebar && sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    sidebarOverlay?.classList.toggle('show', open);
    sidebarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  sidebarOverlay?.addEventListener('click', closeSidebar);
  sidebar.querySelectorAll('a, button').forEach((element) => {
    element.addEventListener('click', closeSidebar);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) setSelectedFile(file);
});

['dragenter', 'dragover'].forEach((type) => {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropzone.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((type) => {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropzone.classList.remove('dragging');
  });
});

dropzone.addEventListener('drop', (event) => {
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) setSelectedFile(file);
});

uploadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  uploadSelectedFile();
});

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', closeUploadDialog);
});

uploadDialog.addEventListener('click', (event) => {
  if (event.target === uploadDialog) closeUploadDialog();
});

uploadDialog.addEventListener('cancel', (event) => {
  if (state.uploading) event.preventDefault();
});

uploadDialog.addEventListener('close', resetUploadForm);

viewerClose.addEventListener('click', () => viewer.close());
viewer.addEventListener('click', (event) => {
  if (event.target === viewer) viewer.close();
});
viewer.addEventListener('close', () => {
  const video = viewerStage.querySelector('video');
  if (video) video.pause();
  viewerStage.textContent = '';
});

window.setInterval(() => {
  if (!document.hidden && !state.uploading) loadItems({ silent: true });
}, 60000);

// ---- boot ---------------------------------------------------

applyLanguage();
resolveApiBase().then((apiBase) => {
  state.apiBase = apiBase;
  loadItems();
});
