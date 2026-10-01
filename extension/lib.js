// Shared by the popup, the background worker and the in-page panel.
// Wrapped so injecting it more than once into a page is harmless.
globalThis.VL = globalThis.VL || (() => {
  const DEFAULTS = {
    backendUrl: 'http://127.0.0.1:8000',
    appUrl: 'http://localhost:5173',
    apiKey: ''
  };

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const trimSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

  async function getSettings() {
    const saved = await chrome.storage.local.get(DEFAULTS);
    return { ...DEFAULTS, ...saved };
  }

  async function fetchImage(url) {
    if (url.startsWith('blob:')) {
      throw new Error("This image is a private blob and can't be read. Save it and upload it in the VeriLens popup.");
    }
    let res;
    try {
      res = await fetch(url);
    } catch {
      throw new Error("Couldn't download that image. Save it and upload it in the VeriLens popup.");
    }
    if (!res.ok) throw new Error(`Image download failed (${res.status}).`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error("That link isn't an image.");
    return blob;
  }

  async function analyze(blob, filename, settings) {
    const base = trimSlash(settings.backendUrl);
    const form = new FormData();
    form.append('file', blob, filename || 'image.jpg');
    if (settings.apiKey) form.append('api_key', settings.apiKey);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    try {
      const res = await fetch(`${base}/api/analyze-media`, { method: 'POST', body: form, signal: ctrl.signal });
      if (!res.ok) throw new Error(`The VeriLens backend returned an error (${res.status}).`);
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The analysis took too long. Try again.');
      if (err instanceof TypeError) throw new Error(`Can't reach the VeriLens backend at ${base}. Is it running?`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Backend notices can be long raw API errors — show a short, friendly version
  const friendlyNotice = (notice) => {
    const n = String(notice || '');
    if (!n) return '';
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(n)) return 'Gemini quota reached — showing the built-in forensic analysis instead.';
    if (/api key|API_KEY|permission|401|403/i.test(n)) return 'Gemini key problem — showing the built-in forensic analysis instead.';
    return n.length > 110 ? `${n.slice(0, 107)}…` : n;
  };

  const verdictClass = (category) => {
    const c = String(category || '').toLowerCase();
    if (/synthetic|generated/.test(c)) return 'bad';
    if (/manipulation|inpainting/.test(c)) return 'warn';
    if (/authentic|unmodified/.test(c)) return 'good';
    return 'neutral';
  };

  const likelihoodClass = (value) => {
    const v = String(value || '').toLowerCase();
    if (v.includes('unknown')) return 'neutral';
    if (v.includes('high')) return 'bad';
    if (v.includes('moderate') || v.includes('medium')) return 'warn';
    return 'good';
  };

  const levelClass = (level) => (level === 'high' ? 'bad' : level === 'medium' ? 'warn' : 'good');

  function renderReport(data) {
    const report = data.report || {};
    const meta = data.metadata || report.metadata || {};
    const likelihood = report.ai_assessment?.ai_likelihood;
    const findings = (report.findings || []).slice(0, 5);
    const edit = report.edit_analysis;

    const stat = (label, value, cls = '') =>
      `<div class="vl-stat"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`;

    return `
      <div class="vl-verdict vl-${verdictClass(report.verdict_category)}">${esc(report.verdict_category || 'Result')}</div>
      <p class="vl-summary">${esc(report.summary || '')}</p>
      ${report.api_notice ? `<p class="vl-note">${esc(friendlyNotice(report.api_notice))}</p>` : ''}
      <div class="vl-stats">
        ${stat('AI likelihood', likelihood ? String(likelihood).split(/[\s(/]/)[0] : '—', `vl-pill vl-${likelihoodClass(likelihood)}`)}
        ${stat('Confidence', report.confidence || '—')}
        ${stat('Camera data', meta.has_exif ? 'Present' : 'Missing', meta.has_exif ? 'vl-ok' : 'vl-bad-text')}
      </div>
      ${edit ? `<p class="vl-edit">Edit check: <b>${esc(edit.verdict)}</b> · ${esc(edit.edit_probability)}% edit likelihood</p>` : ''}
      ${findings.length ? `<div class="vl-label">Findings — tap to expand</div>` : ''}
      ${findings.map((f) => {
        const level = String(f.suspicion_level || '').toLowerCase();
        return `<details class="vl-find">
          <summary><span>${esc(f.label)}</span><i class="vl-tag vl-${levelClass(level)}">${esc(level || 'info')}</i></summary>
          <p>${esc(f.what_we_found)}</p>
          ${f.why_suspicious ? `<p class="vl-why"><b>Why: </b>${esc(f.why_suspicious)}</p>` : ''}
        </details>`;
      }).join('')}
      <p class="vl-foot">Evidence, not verdicts — verify before you trust or share.</p>`;
  }

  const CSS = `
    .vl-root{font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1B1E11}
    .vl-root *{box-sizing:border-box}
    .vl-root{overflow-wrap:anywhere}
    .vl-verdict{display:inline-block;padding:6px 12px;border-radius:10px;font-weight:700;font-size:13px}
    .vl-verdict.vl-bad{background:#6B1D2A;color:#fff}
    .vl-verdict.vl-good{background:#4B5320;color:#fff}
    .vl-verdict.vl-warn{background:#F9EEF0;color:#6B1D2A;border:1px solid #C98E98}
    .vl-verdict.vl-neutral{background:#E3E8D6;color:#434A33}
    .vl-summary{margin:10px 0;color:#2E3322}
    .vl-note{margin:8px 0;padding:6px 8px;border-radius:8px;background:#F9EEF0;border:1px solid #E2BCC2;color:#6B1D2A;font-size:11px}
    .vl-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
    .vl-stat{background:#F4F6EE;border:1px solid #E3E8D6;border-radius:10px;padding:8px}
    .vl-stat span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#737C5E;font-weight:600}
    .vl-stat b{display:block;margin-top:4px;font-size:13px}
    .vl-pill{display:inline-block;padding:1px 8px;border-radius:6px;font-size:12px}
    .vl-pill.vl-bad,.vl-tag.vl-bad{background:#6B1D2A;color:#fff}
    .vl-pill.vl-good,.vl-tag.vl-good{background:#4B5320;color:#fff}
    .vl-pill.vl-warn,.vl-tag.vl-warn{background:#F9EEF0;color:#6B1D2A;border:1px solid #C98E98}
    .vl-pill.vl-neutral{background:#E3E8D6;color:#434A33}
    .vl-ok{color:#4B5320}.vl-bad-text{color:#6B1D2A}
    .vl-edit{margin:6px 0;font-size:12px;color:#434A33}
    .vl-label{margin:12px 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:700;color:#737C5E}
    .vl-find{background:#F4F6EE;border:1px solid #E3E8D6;border-radius:10px;margin-top:6px;padding:8px 10px}
    .vl-find summary{display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer;font-weight:600;list-style:none}
    .vl-find summary::-webkit-details-marker{display:none}
    .vl-find p{margin:6px 0 0;font-size:12px;color:#434A33}
    .vl-why{padding-top:6px;border-top:1px solid #E3E8D6}
    .vl-why b{color:#4B5320}
    .vl-tag{flex:none;font-style:normal;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:999px}
    .vl-foot{margin:12px 0 0;font-size:11px;color:#737C5E}
    .vl-spinner{width:26px;height:26px;border-radius:50%;border:3px solid #E3E8D6;border-top-color:#6B1D2A;animation:vlspin .8s linear infinite;margin:0 auto 8px}
    @keyframes vlspin{to{transform:rotate(360deg)}}
    .vl-center{text-align:center;padding:18px 8px;color:#434A33}
    .vl-error{padding:10px;border-radius:10px;background:#F9EEF0;border:1px solid #E2BCC2;color:#6B1D2A;font-size:12px}
  `;

  return { DEFAULTS, esc, getSettings, fetchImage, analyze, renderReport, CSS };
})();
