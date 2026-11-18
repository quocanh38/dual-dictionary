const normalize = value => String(value).normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
let loading;

export function loadLookupSupplement() {
  if (!loading) loading = fetch('./data/lookup-supplement.json').then(response => {
    if (!response.ok) throw new Error('Lookup supplement unavailable');
    return response.json();
  }).catch(() => { loading = null; return null; });
  return loading;
}

export function supplementEntry(data, query) {
  return data?.entries?.[normalize(query)] || null;
}

export function lookupPage(data, query) {
  const route = data?.pages?.[normalize(query)];
  return typeof route === 'string' && /^\/vi\/tu\/[^/?#]+\/$/.test(route) ? route : null;
}

export function renderSupplement(entry, escape) {
  const senses = entry.senses.map(sense => `<section><p><strong>${escape(sense.m)}</strong></p>` +
    (sense.pat ? `<p>${escape(sense.pat)}</p>` : '') +
    (sense.ex || []).map(([en, vi]) => `<p>${escape(en)}<br>${escape(vi)}</p>`).join('') + '</section>').join('');
  const source = lookupPage({ pages: { [normalize(entry.phrase)]: entry.source } }, entry.phrase);
  return `<article><h1>${escape(entry.phrase)}</h1><p>Nghĩa và ví dụ do HọcTA biên soạn</p>${senses}` +
    (entry.note ? `<p>${escape(entry.note)}</p>` : '') +
    (source ? `<p><a href="${escape(source)}" target="_blank" rel="noopener">Xem nguồn trên site</a></p>` : '') + '</article>';
}
