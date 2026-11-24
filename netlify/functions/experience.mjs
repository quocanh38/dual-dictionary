export const config = {
  path: '/.netlify/functions/experience',
  rateLimit: { windowSize: 60, windowLimit: 120, aggregateBy: ['ip', 'domain'] },
};

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export default async function handler(request) {
  const backendUrl = process.env.EXPERIENCE_BACKEND_URL;
  const proxySecret = process.env.EXPERIENCE_PROXY_SECRET;
  const url = new URL(request.url);
  const isOperations = url.searchParams.has('operations');
  const isCatalog = url.searchParams.has('catalog');

  // Allow ONLY public app routes; never expose admin endpoints through this proxy.
  const allowed =
    (request.method === 'GET' && (isOperations || isCatalog)) ||
    (request.method === 'POST' && !isCatalog);
  if (!allowed) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  if (request.method === 'POST' && request.headers.get('origin') !== url.origin) {
    return json({ error: 'Origin' }, 403);
  }

  if (!backendUrl || !proxySecret) {
    if (request.method === 'GET' && isOperations) return json({ enabled: false });
    if (request.method === 'GET' && isCatalog) return json({ hidden: [] });
    return json({ error: 'Disabled' }, 503);
  }

  const target = new URL(backendUrl);
  if (isOperations) target.search = '?operations';
  else if (isCatalog) target.search = '?catalog';

  const headers = { 'X-Hocta-Proxy-Secret': proxySecret };
  let body;
  if (request.method === 'POST') {
    body = await request.text();
    if (body.length > 16000) return json({ error: 'Too large' }, 413);
    headers['Content-Type'] = 'application/json';
  }

  try {
    const upstream = await fetch(target.href, { method: request.method, headers, body });
    if (upstream.status === 204) {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return json({ error: 'Upstream unavailable' }, 503);
  }
}
