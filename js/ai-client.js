// BYO-key tutor adapters. Keys stay in this browser profile and are sent only
// to the provider selected by the learner when they explicitly request AI.
import { GEMINI_DEFAULT_MODEL, GEMINI_LIGHT_MODEL, GEMINI_MODELS, isValidGeminiModelId, listGeminiModels, fetchGeminiWithFallback } from './gemini-policy.js';
export { listGeminiModels };

const KEY = 'dd-ai-settings-v2';
const USAGE_KEY = 'dd-ai-usage-v1';
export const PROVIDERS = {
  gemini: { label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: GEMINI_DEFAULT_MODEL, protocol: 'openai' },
};
function todayIso() { return new Date().toISOString().slice(0, 10); }
export function getAiUsageSummary() {
  const today = todayIso();
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { day: today, todayCalls: 0, todayTokens: 0, totalCalls: 0, totalTokens: 0 };
    const sameDay = raw.day === today;
    return {
      day: today,
      todayCalls: sameDay ? Number(raw.todayCalls) || 0 : 0,
      todayTokens: sameDay ? Number(raw.todayTokens) || 0 : 0,
      totalCalls: Number(raw.totalCalls) || 0,
      totalTokens: Number(raw.totalTokens) || 0,
    };
  } catch { return { day: today, todayCalls: 0, todayTokens: 0, totalCalls: 0, totalTokens: 0 }; }
}
export function resetAiUsage() {
  try { localStorage.removeItem(USAGE_KEY); } catch {}
}
function recordAiUsage(tokens) {
  try {
    const cur = getAiUsageSummary();
    const t = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0;
    localStorage.setItem(USAGE_KEY, JSON.stringify({
      day: cur.day,
      todayCalls: cur.todayCalls + 1,
      todayTokens: cur.todayTokens + t,
      totalCalls: cur.totalCalls + 1,
      totalTokens: cur.totalTokens + t,
    }));
  } catch {}
}
function pickGeminiModel(candidate, fallback = GEMINI_DEFAULT_MODEL) {
  const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
  if (trimmed && trimmed !== 'gemini-3.6-flash' && isValidGeminiModelId(trimmed)) return trimmed;
  return fallback;
}
export function getAiSettings() {
  const defaults = { provider: 'gemini', ...PROVIDERS.gemini, apiKey: '', rememberKey: false };
  try {
    const session = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    const saved = session || JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.provider !== 'gemini') return defaults;
    return {
      ...defaults,
      // Older builds wrote 3.6 as the default, with no explicit model choice.
      model: 'rememberKey' in saved ? pickGeminiModel(saved.model, defaults.model) : defaults.model,
      apiKey: String(saved.apiKey || ''),
      rememberKey: session ? false : Boolean(saved.apiKey),
    };
  } catch { return defaults; }
}
export function saveAiSettings(s) {
  const value = {
    provider: 'gemini', ...PROVIDERS.gemini,
    model: pickGeminiModel(s.model, GEMINI_DEFAULT_MODEL),
    apiKey: String(s.apiKey || '').trim(),
    rememberKey: Boolean(s.rememberKey && s.apiKey?.trim()),
  };
  if (value.rememberKey) {
    localStorage.setItem(KEY, JSON.stringify(value));
    sessionStorage.removeItem(KEY);
  } else {
    sessionStorage.setItem(KEY, JSON.stringify(value));
    localStorage.removeItem(KEY);
  }
  return { ...value };
}
export function clearAiSettings() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
export async function validateGeminiKey(settings = getAiSettings()) {
  if (!settings.apiKey) throw new Error('Enter a Gemini API key first.');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(settings.model);
  let response;
  try {
    response = await fetch(url, { headers: { 'x-goog-api-key': settings.apiKey }, signal: AbortSignal.timeout(12000) });
  } catch {
    throw new Error('Could not reach Google to check the key. Check your connection and retry.');
  }
  if ([400, 401, 403].includes(response.status)) throw new Error('Google rejected the API key or denied access to this model.');
  if (response.status === 404) throw new Error('This model is unavailable for the key. Select another Gemini model.');
  if (!response.ok) throw new Error(`Google could not check the model (${response.status}). Try again later.`);
  const info = await response.json();
  if (!info.supportedGenerationMethods?.includes('generateContent')) throw new Error('This key did not return a text generation model.');
  return settings.model;
}

async function request(url, headers, body, signal, timeoutMs, readStream, onModel) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const abort = () => controller.abort('cancelled');
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  try {
    const send = model => fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...body, model }), signal: controller.signal });
    const { response, model } = await fetchGeminiWithFallback(send, body.model, controller.signal);
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new Error('Gemini rejected the key or denied access to the model. In Settings → Learning, select Save key and test Gemini access.');
      if (response.status === 402) throw new Error('Provider billing or available quota is insufficient for this key. Check your provider account.');
      if (response.status === 429) throw new Error('Provider rate limit or quota reached. Check your provider account, then wait and retry.');
      if (response.status === 400) throw new Error('Provider rejected the request. Check the selected model and request compatibility in AI settings.');
      throw new Error(`Provider request failed (${response.status}). Check the endpoint, model, and provider CORS support.`);
    }
    onModel?.(model);
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
export async function askTutor({ instructions, input, signal, model, onModel, timeoutMs = 45000 }) {
  const settings = getAiSettings();
  if (!settings.apiKey) throw new Error('Add an API key in Settings → Learning.');
  if (!settings.baseUrl || !settings.model) throw new Error('Choose an API endpoint and model.');
  const body = {
    model: pickGeminiModel(model, settings.model),
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }],
  };
  const data = await request(`${settings.baseUrl}/chat/completions`, {
    Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json',
  }, body, signal, timeoutMs, undefined, onModel);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Provider returned an unexpected response.');
  const estTokens = data?.usage?.total_tokens ?? Math.ceil((String(instructions).length + String(input).length + content.length) / 4);
  recordAiUsage(estTokens);
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(cleaned); } catch { throw new Error('Tutor response was not valid JSON. Please retry.'); }
}

export async function streamTutor({ instructions, input, signal, model, onText, onModel }) {
  const settings = getAiSettings();
  if (!settings.apiKey) throw new Error('Hãy nhập Gemini API key trong Cài đặt → Học tập.');
  const chosenModel = pickGeminiModel(model, settings.model || GEMINI_LIGHT_MODEL);
  const out = await request(`${settings.baseUrl}/chat/completions`, {
    Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json',
  }, {
    model: chosenModel,
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
          if (!data) continue;
          if (data === '[DONE]') {
            if (!result.trim() || !finished) throw new Error('Gemini chưa trả lời đầy đủ.');
            return result;
          }
          let event;
          try { event = JSON.parse(data); } catch { continue; }
          if (event.error) throw new Error('Gemini báo lỗi khi đang trả lời.');
          const choice = event.choices?.[0];
          const delta = choice?.delta?.content;
          if (typeof delta === 'string') {
            result += delta;
            onText(result);
          }
          if (choice?.finish_reason === 'stop' || choice?.finish_reason === 'length') finished = true;
        }
        if (done) {
          if (result.trim() && finished) return result;
          throw new Error('Phản hồi bị ngắt. Bạn có thể thử lại.');
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }, onModel);
  recordAiUsage(Math.ceil((String(instructions).length + String(input).length + String(out || '').length) / 4));
  return out;
}
