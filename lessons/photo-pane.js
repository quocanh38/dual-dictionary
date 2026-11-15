// Experimental photo-to-reading pane, end-to-end in this overlay.
// Loads AFTER app.js (deferred). No core edits: builds the vision request,
// shows inspect-and-consent here, sends via Gemini, records the usage ledger
// through storage.js, and fills the source textarea for normal review.
(function () {
  'use strict';
  var booted = false;
  function el(tag, text) {
    var e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function metaConfig() {
    var keyInput = document.querySelector('#studio-gemini-key');
    
    return {
      tabKey: keyInput ? keyInput.value : '',
      model: document.querySelector('#studio-gemini-model')?.value,
    };
  }
  async function mount() {
    if (booted) return;
    var app = document.querySelector('#app');
    if (!app) return;
    booted = true;
    var box = el('section');
    box.id = 'photo-author';
    box.append(el('h2', 'Experimental: photograph a printed notice'));
    var note = el('p', 'For notices you have the right to use. Gemini transcribes visible English into the reading box below for your review — 100+ legible characters or it is rejected. Inspect the exact payload, consent per request, outcome lands in the usage ledger. Nothing is drafted, saved or approved automatically.');
    note.className = 'notice';
    box.append(note);
    var file = el('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png,image/webp';
    file.setAttribute('aria-label', 'Photograph or choose a notice photo');
    box.append(file);
    var status = el('p', '');
    status.setAttribute('role', 'status');
    box.append(status);
    var previewWrap = el('div');
    box.append(previewWrap);
    var inspectBtn = el('button', 'Inspect photo transcription request');
    inspectBtn.type = 'button';
    box.append(inspectBtn);
    app.append(box);
    var pending = null;
    inspectBtn.addEventListener('click', async function () {
      status.textContent = '';
      previewWrap.replaceChildren();
      pending = null;
      try {
        var f = file.files && file.files[0];
        if (!f) throw Error('Choose a photo first.');
        var down = await import('./photo-downscale.js');
        var req = await import('./photo-request.js');
        var prov = await import('./provider.js');
        var scaled = await down.downscalePhoto(f);
        var cfg = metaConfig();
        var payload = req.buildVisionRequest({ dataUrl: scaled.dataUrl, model: cfg.model });
        pending = { req: req, payload: payload, scaled: scaled, prov: prov };
        var meta = prov.GEMINI_PROVIDER;
        previewWrap.append(el('h3', 'Inspect before sending to ' + meta.label));
        var dest = el('p', 'Provider: ' + meta.label + ' · Purpose: ' + payload.purpose + ' · Model: ' + cfg.model + ' · Endpoint: ' + meta.baseUrl);
        dest.className = 'meta';
        previewWrap.append(dest);
        var det = el('details');
        det.open = true;
        det.append(el('summary', 'Exact instructions and photo payload (image truncated)'));
        var pre = el('pre', JSON.stringify({ instructions: payload.instructions, input: req.previewVisionRequest(payload, 120).input, model: payload.model }, null, 2));
        det.append(pre);
        previewWrap.append(det);
        var agree = el('label');
        var box2 = el('input');
        box2.type = 'checkbox';
        agree.append(box2, document.createTextNode(' I agree to send this photo transcription request to Gemini API'));
        previewWrap.append(agree);
        var row = el('div');
        var send = el('button', 'Agree and send photo request');
        send.type = 'button';
        send.className = 'primary';
        var back = el('button', 'Back without sending');
        back.type = 'button';
        row.append(send, back);
        previewWrap.append(row);
        back.addEventListener('click', function () { pending = null; previewWrap.replaceChildren(); status.textContent = 'Photo request discarded. Nothing sent.'; });
        send.addEventListener('click', async function () {
          try {
            if (!box2.checked) throw Error('Check consent before sending.');
            if (!navigator.onLine) throw Error('You are offline. Restore the network before sending.');
            if (!pending) throw Error('Inspect a photo first.');
            send.disabled = true;
            status.textContent = 'Sending to Gemini API…';
            var store = await import('./storage.js');
            var rows = await store.listRecords('usage');
            var usageId = crypto.randomUUID();
            var cfg2 = metaConfig();
            if (!cfg2.tabKey || !cfg2.tabKey.trim()) throw Error('Add your Gemini API key in Studio first. It stays in tab memory.');
            var call = pending;
            if (cfg2.model !== call.payload.model) throw Error('Model changed. Inspect the photo request again.');
            await store.putRecord('usage', { id: usageId, at: new Date().toISOString(), draftId: 'photo-extract-pending', purpose: call.payload.purpose, providerId: 'gemini', model: cfg2.model, status: null, usage: null, outcome: 'in-flight-or-unknown' });
            var result;
            try {
              result = await call.req.sendVisionRequest({ baseUrl: call.prov.GEMINI_PROVIDER.baseUrl, model: cfg2.model, key: cfg2.tabKey, request: call.payload }, {});
            } catch (e) {
              await store.putRecord('usage', { id: usageId, at: new Date().toISOString(), draftId: 'photo-extract-pending', purpose: call.payload.purpose, providerId: 'gemini', model: cfg2.model, outcome: 'failed' }).catch(function () {});
              throw e;
            }
            await store.putRecord('usage', { id: usageId, at: new Date().toISOString(), draftId: 'photo-extract-pending', purpose: call.payload.purpose, providerId: result.providerId, model: result.model, status: result.status, usage: result.usage, latencyMs: result.latencyMs, outcome: 'received' });
            var parsed = call.req.parseVisionResult(result.result);
            var article = document.querySelector('#source-article');
            if (article) {
              article.value = parsed.readingText;
              article.placeholder = '';
              article.focus();
            }
            pending = null;
            previewWrap.replaceChildren();
            status.textContent = 'Photo transcribed: ' + parsed.readingText.length + ' characters placed in the reading box above. Review the text, confirm rights, then create a draft. No draft created, nothing approved. Usage recorded in the ledger.';
          } catch (e) {
            status.textContent = e && e.message ? e.message : String(e);
          } finally {
            send.disabled = false;
          }
        });
        status.textContent = 'Request ready (' + scaled.width + 'x' + scaled.height + '). Review the exact payload, then consent to send — or go back.';
      } catch (e) {
        status.textContent = e && e.message ? e.message : String(e);
      }
    });
  }
  new MutationObserver(function () {
    if (document.querySelector('#app') && !booted) mount();
  }).observe(document.body, { childList: true, subtree: true });
  mount();
})();
