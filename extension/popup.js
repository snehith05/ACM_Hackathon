const $ = (id) => document.getElementById(id);

const style = document.createElement('style');
style.textContent = VL.CSS;
document.head.appendChild(style);

let busy = false;

const showResult = (html) => {
  $('result').hidden = false;
  $('result').innerHTML = html;
};

const loading = (preview) =>
  showResult(`${preview}<div class="vl-center"><div class="vl-spinner"></div>Analyzing image…<br><small>This can take up to a minute.</small></div>`);

const previewTag = (src) => (src ? `<img class="preview" src="${VL.esc(src)}" alt="">` : '');

async function run(getBlob, name, previewSrc) {
  if (busy) return;
  busy = true;
  const settings = await VL.getSettings();
  const preview = previewTag(previewSrc);
  loading(preview);
  try {
    const blob = await getBlob();
    const data = await VL.analyze(blob, name, settings);
    const open = `<a class="primary" style="display:block;margin-top:12px" href="${VL.esc(settings.appUrl)}" target="_blank" rel="noreferrer">Open full VeriLens report</a>`;
    showResult(preview + VL.renderReport(data) + open);
  } catch (err) {
    showResult(`${preview}<div class="vl-error">${VL.esc(err.message)}</div>`);
  } finally {
    busy = false;
  }
}

function checkFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showResult('<div class="vl-error">Please choose an image file.</div>');
    return;
  }
  run(async () => file, file.name, URL.createObjectURL(file));
}

// Backend status
async function checkBackend() {
  const settings = await VL.getSettings();
  const el = $('status');
  try {
    const res = await fetch(`${settings.backendUrl.replace(/\/+$/, '')}/api/health`);
    const info = await res.json();
    el.className = 'status ok';
    el.querySelector('span').textContent = `Backend online · ${info.gemini_configured || settings.apiKey ? 'Gemini ready' : 'built-in checks only (no Gemini key)'}`;
  } catch {
    el.className = 'status bad';
    el.querySelector('span').textContent = 'Backend offline — start it, or change the URL in ⚙ settings';
  }
}

// Settings
$('gear').addEventListener('click', async () => {
  const panel = $('settings');
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    const s = await VL.getSettings();
    $('backendUrl').value = s.backendUrl;
    $('appUrl').value = s.appUrl;
    $('apiKey').value = s.apiKey;
  }
});

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    backendUrl: $('backendUrl').value.trim() || VL.DEFAULTS.backendUrl,
    appUrl: $('appUrl').value.trim() || VL.DEFAULTS.appUrl,
    apiKey: $('apiKey').value.trim()
  });
  $('settings').hidden = true;
  checkBackend();
});

// File input, drag & drop, paste
$('file').addEventListener('change', (e) => checkFile(e.target.files[0]));

const drop = $('drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => checkFile(e.dataTransfer.files[0]));
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });

document.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) checkFile(item.getAsFile());
});

// Image URL
$('urlForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const url = $('imageUrl').value.trim();
  if (!url) return;
  const name = decodeURIComponent((url.split('?')[0].split('/').pop() || 'image').slice(0, 80));
  run(() => VL.fetchImage(url), name, url);
});

checkBackend();
