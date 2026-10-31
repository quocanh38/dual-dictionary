// Experimental photo-to-reading pane for the Studio author view.
// Loads AFTER app.js (deferred) like village.js. Read-only overlay: it never
// edits drafts by itself — the transcribed text lands in the source textarea
// only after the author reviews it and the normal rights checkbox is set.
(function () {
  'use strict';
  var booted = false;
  function el(tag, text) {
    var e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  async function downscale(file) {
    var mod = await import('./photo-downscale.js');
    return mod.downscalePhoto(file);
  }
  async function build(file, metaKey, model) {
    var req = await import('./photo-request.js');
    var scaled = await downscale(file);
    return { photo: req, payload: req.buildVisionRequest({ dataUrl: scaled.dataUrl, model: model }), scaled: scaled };
  }
  function mount() {
    if (booted) return;
    var app = document.querySelector('#app');
    if (!app) return;
    booted = true;
    var box = el('section');
    box.id = 'photo-author';
    box.append(el('h2', 'Experimental: photograph a printed notice'));
    var note = el('p', 'For notices you have the right to use. Meta vision transcribes visible English into a reading draft (100+ legible characters or rejected). The text fills the source form below for your review — nothing is sent, saved or approved automatically.');
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
    var send = el('button', 'Inspect vision request');
    send.type = 'button';
    box.append(send);
    app.append(box);
    send.addEventListener('click', async function () {
      status.textContent = '';
      try {
        var f = file.files && file.files[0];
        if (!f) throw Error('Choose a photo first.');
        var keyInput = document.querySelector('#studio-meta-key');
        var modelSel = document.querySelector('#studio-meta-model');
        var key = keyInput ? keyInput.value : '';
        var model = modelSel && modelSel.value ? modelSel.value : 'muse-spark-1.3';
        var built = await build(f, key, model);
        var preview = built.photo.previewVisionRequest(built.payload, 120);
        status.textContent = 'Request ready for your inspection (' + built.scaled.width + 'x' + built.scaled.height + '). Consent and send from the dialog that follows the normal review form.';
        alert('Vision request preview:\n' + JSON.stringify({ instructions: preview.instructions, model: preview.model, image: preview.input.imageDataUrl }, null, 2).slice(0, 1200));
        var article = document.querySelector('#source-article');
        if (article && !article.value) {
          article.value = '';
          article.placeholder = 'Vision output will appear here after you consent and send — review it before creating a draft.';
        }
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
