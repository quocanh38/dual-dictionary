// BYO-key tutor adapters. Keys stay in this browser profile and are sent only
// to the provider selected by the learner when they explicitly request AI.
const KEY = 'dd-ai-settings-v2';
export const PROVIDERS = {
  gemini: { label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.6-flash', protocol: 'openai' },
};
export function getAiSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { provider: 'gemini', ...PROVIDERS.gemini, apiKey: s.provider === 'gemini' ? String(s.apiKey || '') : '' };
  } catch { return { provider: 'gemini', ...PROVIDERS.gemini, apiKey: '' }; }
}
export function saveAiSettings(s) {
  const value = { provider: 'gemini', ...PROVIDERS.gemini, apiKey: String(s.apiKey || '').trim() };
  localStorage.setItem(KEY, JSON.stringify(value));
  return value;
}
export function clearAiSettings() { localStorage.removeItem(KEY); }
async function request(url, headers, body, signal, timeoutMs, readStream) {
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
    if (readStream) return await readStream(response);
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
export async function askTutor({ instructions, input, signal, model, timeoutMs = 45000 }) {
  const settings = getAiSettings();
  if (!settings.apiKey) throw new Error('Add an API key in Advanced → Learning.');
  if (!settings.baseUrl || !settings.model) throw new Error('Choose an API endpoint and model.');
  const body = {
    model: model === "gemini-3.8-flash" ? model : settings.model,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }],
  };
  const data = await request(`${settings.baseUrl}/chat/completions`, {
    Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json',
  }, body, signal, timeoutMs);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Provider returned an unexpected response.');
  try { return JSON.parse(content); } catch { throw new Error('Tutor response was not valid JSON. Please retry.'); }
}

export async function streamTutor({ instructions, input, signal, onText }) {
  const settings = getAiSettings();
  if (!settings.apiKey) throw new Error('Hãy nhập Gemini API key trong Cài đặt nâng cao → Học tập.');
  return request(`${settings.baseUrl}/chat/completions`, {
    Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json',
  }, {
    model: settings.model,
    stream: true,
    messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }],
  }, signal, 45000, async (response) => {
    if (!response.body) throw new Error('Gemini không trả về luồng dữ liệu.');
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '', result = '', finished = false;
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += value || '';
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        if (done && buffer) lines.push(buffer);
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            if (!result.trim() || !finished) throw new Error('Gemini chưa trả lời đầy đủ.');
            return result;
          }
          const event = JSON.parse(data);
          if (event.error) throw new Error('Gemini báo lỗi khi đang trả lời.');
          const choice = event.choices?.[0];
          const delta = choice?.delta?.content;
          if (typeof delta === 'string') {
            result += delta;
            onText(result);
          }
          if (choice?.finish_reason === 'stop') finished = true;
        }
        if (done) throw new Error('Phản hồi bị ngắt. Bạn có thể thử lại.');
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  });
}
