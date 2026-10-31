// Village Kit overlay for the Offline Lesson Studio.
// Loads AFTER app.js (deferred): adds search + per-pack Meta provenance to
// the reviewed library, a village banner, and a low-memory mode — without
// touching the Studio core files (app.js stays byte-identical).
(function () {
  'use strict';
  var provCache = null;
  function provMap() {
    if (provCache) return Promise.resolve(provCache);
    return fetch('./library/provenance.json')
      .then(function (r) { if (!r.ok) throw new Error('no provenance'); return r.json(); })
      .then(function (doc) {
        var m = {};
        (doc.packs || []).forEach(function (p) { m[p.packId + '@' + p.version] = p; });
        provCache = m;
        return m;
      })
      .catch(function () { provCache = {}; return provCache; });
  }
  function decorateCatalogue() {
    var host = document.querySelector('#app');
    if (!host || host.dataset.villageDecorated) return;
    var h2s = host.querySelectorAll('h2');
    var found = false;
    h2s.forEach(function (h) { if (h.textContent.indexOf('Reviewed lesson library') !== -1) found = true; });
    if (!found) return;
    host.dataset.villageDecorated = '1';
    // 1) offline search box (client-side filter, no network)
    var label = document.createElement('label');
    label.textContent = 'Search lessons (offline filter)';
    label.htmlFor = 'village-search';
    var input = document.createElement('input');
    input.id = 'village-search';
    input.type = 'search';
    input.placeholder = 'e.g. library, handover, B2…';
    input.autocomplete = 'off';
    host.insertBefore(input, host.children[2] || null);
    host.insertBefore(label, input);
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      host.querySelectorAll(':scope > section').forEach(function (s) {
        var t = (s.textContent || '').toLowerCase();
        s.style.display = (!q || t.indexOf(q) !== -1) ? '' : 'none';
      });
    });
    // 2) per-pack Meta provenance line (one small JSON fetch, cached)
    provMap().then(function (m) {
      host.querySelectorAll(':scope > section').forEach(function (s) {
        var btn = s.querySelector('button');
        var title = (s.querySelector('h3') || {}).textContent || '';
        var key = Object.keys(m).find(function (k) { return m[k].title === title; });
        if (!key || s.querySelector('.village-prov')) return;
        var p = m[key];
        var line = document.createElement('p');
        line.className = 'meta village-prov';
        line.textContent = 'Made with ' + p.provider + ' · ' + p.model +
          ' · reviewed by ' + p.reviewerType + ' · sha ' + String(p.sha256).slice(0, 12) + '…';
        s.insertBefore(line, btn || null);
      });
    });
  }
  // 3) low-memory mode: honour prefers-reduced-motion + save-data, kill smooth scroll costs
  function lowMemory() {
    try {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var saveData = navigator.connection && navigator.connection.saveData;
      if (reduce || saveData) document.documentElement.classList.add('village-lite');
    } catch (e) { /* best effort */ }
  }
  // 4) village banner under the hero (only on the studio page)
  function banner() {
    if (document.querySelector('.village')) return;
    var main = document.querySelector('main');
    var status = document.querySelector('#offline-status');
    if (!main || !status) return;
    var p = document.createElement('p');
    p.className = 'notice village';
    p.textContent = 'Village Kit: install packs once (school USB or one online visit), then airplane-mode learning works — read, practise, save meanings, review. No account, no key, no tracking on the learner device.';
    main.insertBefore(p, status);
  }
  lowMemory();
  banner();
  new MutationObserver(decorateCatalogue).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  decorateCatalogue();
})();
