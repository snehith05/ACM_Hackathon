// Injected on demand by the background worker. Shows the result in a floating panel (shadow DOM
// keeps the page's styles from leaking in or out).
if (!globalThis.__verilensPanelLoaded) {
  globalThis.__verilensPanelLoaded = true;

  const HOST_ID = 'verilens-host';

  const getRoot = () => {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          ${VL.CSS}
          .panel{width:360px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:#fff;border:1px solid #CDD5BB;border-radius:16px;box-shadow:0 20px 50px -12px rgba(27,30,17,.45);overflow:hidden}
          .bar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#6B1D2A;color:#fff;font-weight:700}
          .bar span em{font-style:normal;color:#D0D7B0}
          .x{all:unset;cursor:pointer;width:22px;height:22px;text-align:center;line-height:22px;border-radius:6px;font-size:16px}
          .x:hover{background:rgba(255,255,255,.18)}
          .body{padding:14px;overflow-y:auto}
          .thumb{display:block;max-width:100%;max-height:120px;margin:0 auto 12px;border-radius:10px;border:1px solid #E3E8D6}
          .open{display:block;margin-top:12px;text-align:center;padding:8px;border-radius:10px;background:#6B1D2A;color:#fff;text-decoration:none;font-weight:600;font-size:12px}
        </style>
        <div class="vl-root panel">
          <div class="bar"><span>Veri<em>Lens</em></span><button class="x" title="Close">×</button></div>
          <div class="body" id="body"></div>
        </div>`;
      shadow.querySelector('.x').addEventListener('click', () => host.remove());
      document.documentElement.appendChild(host);
    }
    return host.shadowRoot;
  };

  const thumb = (url) => (url ? `<img class="thumb" src="${VL.esc(url)}" alt="">` : '');

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== 'verilens') return;
    const body = getRoot().getElementById('body');

    if (msg.state === 'loading') {
      body.innerHTML = `${thumb(msg.imageUrl)}<div class="vl-center"><div class="vl-spinner"></div>Analyzing image…<br><small>This can take up to a minute.</small></div>`;
    } else if (msg.state === 'error') {
      body.innerHTML = `${thumb(msg.imageUrl)}<div class="vl-error">${VL.esc(msg.message)}</div>`;
    } else if (msg.state === 'result') {
      body.innerHTML = `${thumb(msg.imageUrl)}${msg.html}<a class="open" href="${VL.esc(msg.appUrl)}" target="_blank" rel="noreferrer">Open full VeriLens report</a>`;
    }
  });
}
