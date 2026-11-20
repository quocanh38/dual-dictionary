export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
export const GEMINI_LIGHT_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_MODELS = [GEMINI_DEFAULT_MODEL, GEMINI_LIGHT_MODEL];

export function isValidGeminiModelId(model) {
  return typeof model === 'string' && /^gemini-[a-z0-9._-]{2,60}$/i.test(model.trim());
}

export async function listGeminiModels(apiKey, signal) {
  const key = String(apiKey || '').trim();
  if (!key) return [];
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': key },
    signal: signal || AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return (data?.models || [])
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((id) => isValidGeminiModelId(id));
}

function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function retryDelay(response) {
  const value = response.headers.get('Retry-After');
  if (!value) return 1100;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.max(1100, ms) : 1100;
}

export async function fetchGeminiWithFallback(send, requestedModel, signal, allowFallback = true) {
  let model = requestedModel;
  let response = await send(model);
  if (allowFallback && model !== GEMINI_LIGHT_MODEL && [429, 503].includes(response.status)) {
    const error = await response.clone().json().catch(() => null);
    const details = JSON.stringify(error?.error || error || '');
    const quotaExhausted = response.status === 429 &&
      /per[\s_-]*day|daily|requestsperday|billing|quotaValue["\s:]*0(?:["\s,}]|$)|limit\s*:\s*0\b/i.test(details);
    const wait = retryDelay(response);
    if (!quotaExhausted && wait <= 5000) {
      await response.body?.cancel().catch(() => {});
      await waitForRetry(wait, signal);
      signal?.throwIfAborted();
      model = GEMINI_LIGHT_MODEL;
      response = await send(model);
    }
  }
  return { response, model };
}
