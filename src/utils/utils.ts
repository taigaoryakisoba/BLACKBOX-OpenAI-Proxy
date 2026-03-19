import crypto from 'crypto';

export const isAbortError = (err: any): boolean => {
  return (
    err?.name === 'AbortError' || err?.code === 20 || err?.code === 'ABORT_ERR'
  );
};

export const writeSseEvent = (res: any, eventName: string, dataObj: any) => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
};

export const genId = (): string => crypto.randomBytes(12).toString('hex');

export const genShortId = (): string =>
  crypto.randomBytes(4).toString('base64url');

export const safeJson = (obj: any, maxChars: number): string => {
  let s;
  try {
    s = JSON.stringify(obj);
  } catch {
    return '[unstringifiable]';
  }
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}... (truncated, ${s.length} chars)`;
};

export const redactHeaders = (
  headers: Record<string, string>
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    const key = k.toLowerCase();
    if (key === 'cookie' || key === 'authorization' || key === 'x-api-key') {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
};

export const logDebug = (DEBUG_LOG: boolean, ...args: any[]) => {
  if (!DEBUG_LOG) return;
  console.debug(...args);
};

export const resolveModel = (
  MODEL_CONFIG: Record<string, any>,
  model: string
): any | null => {
  if (!model || typeof model !== 'string') return null;
  return MODEL_CONFIG[model] ?? null;
};

export const extractAIResponse = (
  data: any,
  DEBUG_MAX_CHARS: number
): string => {
  let raw = '';
  if (!data) return 'No response data received';
  if (typeof data === 'string') raw = data;
  else if (data.response) raw = String(data.response);
  else if (data.generations?.[0]?.text) raw = String(data.generations[0].text);
  else if (data.choices?.[0]?.message?.content)
    return String(data.choices[0].message.content);
  else if (data.text) raw = String(data.text);
  else return 'Response received but in an unexpected format';

  console.log(
    `[extractAIResponse] raw before processing: ${safeJson(raw, DEBUG_MAX_CHARS)}`
  );

  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const jsonObj = JSON.parse(jsonMatch[0]);
      const keys = Object.keys(jsonObj);
      if (keys.length === 1 && (keys[0] === 'title' || keys[0] === 'tags')) {
        const value = jsonObj[keys[0]];
        const result =
          typeof value === 'string' ? value : JSON.stringify(value);
        console.log(
          `[extractAIResponse] extracted single-key value: ${result}`
        );
        return result;
      }
      console.log(`[extractAIResponse] extracted JSON: ${jsonMatch[0]}`);
      return jsonMatch[0];
    } catch (e: any) {
      console.log(`[extractAIResponse] JSON parse error: ${e.message}`);
    }
  }

  console.log(
    `[extractAIResponse] final raw: ${safeJson(raw, DEBUG_MAX_CHARS)}`
  );
  return raw;
};

export const tryConsumeUpstreamSseEvents = (
  buffer: string
): { events: string[]; rest: string } => {
  const events: string[] = [];
  let rest = buffer;

  while (true) {
    const idx = rest.indexOf('\n\n');
    if (idx === -1) break;

    const rawEvent = rest.slice(0, idx);
    rest = rest.slice(idx + 2);

    const dataLines = rawEvent
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.replace(/^data:\s?/, ''));

    if (dataLines.length === 0) continue;
    events.push(dataLines.join('\n'));
  }

  return { events, rest };
};

/**
 * Upstream レスポンスのボディを読み取り、テキストデルタを順に yield する async generator。
 * SSE形式（data: ...）と生テキストの両方に対応。
 * @param {ReadableStreamDefaultReader} reader
 * @yields {string} テキストデルタ
 */
export async function* readUpstreamDeltas(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string, void, unknown> {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;

    buffer += chunk;
    const { events, rest } = tryConsumeUpstreamSseEvents(buffer);
    buffer = rest;

    const deltas = events.length > 0 ? events : [chunk];
    for (const d of deltas) {
      if (!d || d.trim() === '[DONE]') continue;
      yield d;
    }
  }

  // ループ終了後に残ったバッファを flush
  if (buffer && buffer.trim() !== '[DONE]') {
    yield buffer;
  }
}

export const setSseHeaders = (res: any) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
};

export const writeSseData = (res: any, data: any) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

export const writeSseDone = (res: any) => {
  res.write('data: [DONE]\n\n');
};

export const nowUnix = (): number => Math.floor(Date.now() / 1000);

export const fetchImageAsBase64 = async (
  url: string
): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `Failed to fetch image from ${url}: ${response.status} ${response.statusText}`
      );
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`Error fetching image from ${url}:`, error);
    return null;
  }
};
