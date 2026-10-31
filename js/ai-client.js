// BYO-key tutor adapters. Keys stay in this browser profile and are sent only
// to the provider selected by the learner when they explicitly request AI.
const KEY = 'dd-ai-settings-v2';
export const PROVIDERS = {
  meta: { label: 'Meta Model API', baseUrl: 'https://api.meta.ai/v1', model: 'muse-spark-1.3', protocol: 'openai' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', protocol: 'openai' },
  anthropic: { label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-haiku-latest', protocol: 'anthropic' },
  compatible: { label: 'OpenAI-compatible endpoint', baseUrl: '', model: '', protocol: 'openai' },
};
export function getAiSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    const provider = PROVIDERS[s.provider] ? s.provider : 'meta';
    return { provider, apiKey: String(s.apiKey || ''), baseUrl: s.baseUrl || PROVIDERS[provider].baseUrl, model: s.model || PROVIDERS[provider].model };
  } catch { return { provider: 'meta', apiKey: '', ...PROVIDERS.meta }; }
}
export function saveAiSettings(s) {
  const provider = PROVIDERS[s.provider] ? s.provider : 'meta';
  const value = { provider, apiKey: String(s.apiKey || '').trim(), baseUrl: String(s.baseUrl || PROVIDERS[provider].baseUrl).trim().replace(/\/+$/, ''), model: String(s.model || PROVIDERS[provider].model).trim() };
  if (!value.model) throw new Error('Enter a model ID.');
  if (!value.baseUrl) throw new Error('Enter an API base URL.');
  let url;
  try { url = new URL(value.baseUrl); } catch { throw new Error('Enter a valid API base URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS for the API endpoint.');
  localStorage.setItem(KEY, JSON.stringify(value));
  return value;
}
export function clearAiSettings() { localStorage.removeItem(KEY); }
async function request(url, headers, body, signal, timeoutMs) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const abort = () => controller.abort('cancelled');
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new Error('Provider rejected the key or model access. Open AI settings to check the key/model, then use Save & test connection in Advanced → Learning.');
      if (response.status === 402) throw new Error('Provider billing or available quota is insufficient for this key. Check your provider account.');
      if (response.status === 429) throw new Error('Provider rate limit or quota reached. Check your provider account, then wait and retry.');
      if (response.status === 400) throw new Error('Provider rejected the request. Check the selected model and request compatibility in AI settings.');
      throw new Error(`Provider request failed (${response.status}). Check the endpoint, model, and provider CORS support.`);
    }
    try { return await response.json(); } catch { throw new Error('Provider returned a non-JSON response. Check the endpoint and model.'); }
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) {
      if (controller.signal.reason === 'cancelled') throw new Error('Request cancelled.');
      throw new Error('Request timed out. Check your connection and retry.');
    }
    if (error instanceof TypeError) throw new Error('Could not reach this provider from the browser. Check the URL, connection, and CORS support.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export async function askTutor({ instructions, input, signal, timeoutMs = 45000 }) {
  const settings = getAiSettings();
  if (!settings.apiKey) throw new Error('Add an API key in Advanced → Learning.');
  if (!settings.baseUrl || !settings.model) throw new Error('Choose an API endpoint and model.');
  let content;
  if (settings.provider === 'anthropic') {
    const data = await request(`${settings.baseUrl}/messages`, { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, { model: settings.model, max_tokens: 900, temperature: 0.2, system: instructions, messages: [{ role: 'user', content: input }] }, signal, timeoutMs);
    content = data?.content?.filter((part) => part.type === 'text').map((part) => part.text).join('');
  } else {
    const body = { model: settings.model, temperature: 0.2, messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }] };
    if (settings.provider === 'meta') {
      body.max_tokens = 32768;
      if (settings.model.startsWith('muse-spark-')) body.reasoning_effort = 'medium';
    }
    const data = await request(`${settings.baseUrl}/chat/completions`, { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' }, body, signal, timeoutMs);
    content = data?.choices?.[0]?.message?.content;
  }
  if (typeof content !== 'string') throw new Error('Provider returned an unexpected response.');
  try { return JSON.parse(content); } catch { throw new Error('Tutor response was not valid JSON. Please retry.'); }
}
