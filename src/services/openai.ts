import { ToolCall, OpenAIMessage, BlackboxMessage } from '../types';
import { ChatCompletionChunk, ErrorResponse } from '../models';
import { genShortId } from '../utils/utils';
import logger from './logger';

export const extractTextFromResponsesContent = (content: any): string => {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== 'object') return '';
        if (typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
  }

  return '';
};

export const normalizeResponsesBodyToOpenAiMessages = (
  body: any
): OpenAIMessage[] => {
  const msgs: OpenAIMessage[] = [];

  if (typeof body.instructions === 'string' && body.instructions.trim()) {
    msgs.push({ role: 'system', content: body.instructions });
  }

  const input = body.input;

  if (typeof input === 'string' && input.trim()) {
    msgs.push({ role: 'user', content: input });
    return msgs;
  }

  if (!Array.isArray(input)) return msgs;

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;

    if (item.type === 'function_call') {
      const name = item.name ?? 'unknown';
      const args = item.arguments ?? '{}';
      const callId = item.call_id ?? `call_${genShortId()}`;
      msgs.push({
        role: 'assistant',
        content: JSON.stringify({
          tool_calls: [
            {
              id: callId,
              type: 'function',
              function: {
                name,
                arguments: args,
              },
            },
          ],
        }),
      });
      continue;
    }

    if (item.type === 'function_call_output') {
      const callId = item.call_id ?? 'unknown';
      const output =
        typeof item.output === 'string'
          ? item.output
          : JSON.stringify(item.output ?? '');
      msgs.push({
        role: 'user',
        content: JSON.stringify({
          role: 'tool',
          tool_call_id: callId,
          content: output,
        }),
      });
      continue;
    }

    if (item.type === 'message' && typeof item.role === 'string') {
      if (Array.isArray(item.content)) {
        msgs.push({ role: item.role, content: item.content });
      } else {
        const text = extractTextFromResponsesContent(item.content);
        if (text) msgs.push({ role: item.role, content: text });
      }
      continue;
    }

    if (typeof item.role === 'string') {
      if (Array.isArray(item.content)) {
        msgs.push({ role: item.role, content: item.content });
      } else {
        const text = extractTextFromResponsesContent(item.content);
        if (text) msgs.push({ role: item.role, content: text });
      }
      continue;
    }

    if (typeof item.text === 'string') {
      msgs.push({ role: 'user', content: item.text });
      continue;
    }
  }

  return msgs;
};

export const buildToolSystemPrompt = (tools: any[]): string | null => {
  if (!Array.isArray(tools) || tools.length === 0) return null;

  const toolDescriptions = tools
    .map((tool) => {
      const fn = tool.function ?? tool;
      const name = fn.name ?? tool.name ?? '';
      if (!name) return null;
      const description = fn.description ?? tool.description ?? '';
      const params = fn.parameters ?? tool.parameters ?? {};

      let paramDesc = '';
      if (
        params &&
        params.properties &&
        typeof params.properties === 'object'
      ) {
        const required = new Set(
          Array.isArray(params.required) ? params.required : []
        );
        const props = Object.entries(params.properties)
          .map(([k, v]: [string, any]) => {
            const req = required.has(k) ? ' (required)' : ' (optional)';
            const typeStr = v && v.type ? ` [${v.type}]` : '';
            const desc = v && v.description ? `: ${v.description}` : '';
            return `  - ${k}${req}${typeStr}${desc}`;
          })
          .join('\n');
        paramDesc = `\nParameters:\n${props}`;
      }

      return `### ${name}\n${description}${paramDesc}`;
    })
    .filter(Boolean)
    .join('\n\n');

  if (!toolDescriptions) return null;

  return `You have access to the following tools. When you need to use a tool, you MUST respond with ONLY a single raw JSON object and absolutely nothing else.

Use this exact format:
{"tool": "<tool_name>", "parameters": {<parameters_as_json_object>}}

CRITICAL RULES — you MUST follow all of these:
1. Output ONLY the JSON object. No text before it, no text after it.
2. Do NOT explain what you are doing. Do NOT add any commentary.
3. Do NOT output the expected result or simulate the tool output.
4. Do NOT call multiple tools at once. One tool call per response.
5. After outputting the JSON, STOP. Wait for the actual tool result.
6. All string values in the JSON MUST use proper JSON escaping.
   - Double quotes inside strings MUST be escaped as \\"
   - Example: {"tool":"shell","parameters":{"command":"grep -n \\"pattern\\" file.txt"}}
7. If you need to run multiple commands, call one tool, wait for the result, then call the next.

Available tools:
${toolDescriptions}`;
};

const fixJsonQuotes = (str: string): string => {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === '\\') {
      result += ch;
      if (inString) escape = true;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
        continue;
      }

      let j = i + 1;
      while (
        j < str.length &&
        (str[j] === ' ' ||
          str[j] === '\t' ||
          str[j] === '\n' ||
          str[j] === '\r')
      )
        j++;
      const nextCh = j < str.length ? str[j] : '';

      if (
        nextCh === ',' ||
        nextCh === ':' ||
        nextCh === '}' ||
        nextCh === ']' ||
        nextCh === ''
      ) {
        inString = false;
        result += ch;
      } else {
        result += '\\"';
      }
      continue;
    }

    result += ch;
  }

  return result;
};

const extractAllJsonObjects = (text: string): string[] => {
  const results: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
      } else {
        let j = i + 1;
        while (
          j < text.length &&
          (text[j] === ' ' ||
            text[j] === '\t' ||
            text[j] === '\n' ||
            text[j] === '\r')
        )
          j++;
        const nextCh = j < text.length ? text[j] : '';
        if (
          nextCh === ',' ||
          nextCh === ':' ||
          nextCh === '}' ||
          nextCh === ']' ||
          nextCh === ''
        ) {
          inString = false;
        }
      }
      continue;
    }

    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1);
        try {
          JSON.parse(candidate);
          results.push(candidate);
        } catch {
          const fixed = fixJsonQuotes(candidate);
          try {
            JSON.parse(fixed);
            results.push(fixed);
          } catch {
            // Invalid JSON, ignore
          }
        }
        start = -1;
        depth = 0;
        inString = false;
      }
    }
  }

  return results;
};

export const detectToolCalls = (
  text: string,
  tools: any[]
): ToolCall[] | null => {
  if (!text || !Array.isArray(tools) || tools.length === 0) return null;

  const toolMap = new Map();
  for (const tool of tools) {
    const fn = tool.function ?? tool;
    const name = fn.name ?? tool.name;
    if (name) toolMap.set(name, fn);
  }
  if (toolMap.size === 0) return null;

  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const toolCalls: ToolCall[] = [];

  // 1. [Tool call: name(args)] 形式のフォールバック検出 (複数対応)
  const toolCallRegex = /\[Tool call:\s*([a-zA-Z0-9_-]+)\((.*?)\)\]/g;
  let match;
  while ((match = toolCallRegex.exec(cleaned)) !== null) {
    const name = match[1];
    const args = match[2];
    if (toolMap.has(name)) {
      toolCalls.push({ name, arguments: args });
    }
  }

  if (toolCalls.length > 0) return toolCalls;

  // 2. Markdown コードブロック内の JSON 検出、または生の JSON
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const targetText = codeBlockMatch ? codeBlockMatch[1] : cleaned;

  const jsonStrs = extractAllJsonObjects(targetText);

  for (const jsonStr of jsonStrs) {
    let json;
    try {
      json = JSON.parse(jsonStr);
    } catch {
      continue;
    }

    // {"tool": "name", "parameters": {...}}
    if (json.tool && typeof json.tool === 'string' && toolMap.has(json.tool)) {
      const params = json.parameters ?? {};
      toolCalls.push({
        name: json.tool,
        arguments: typeof params === 'string' ? params : JSON.stringify(params),
      });
      continue;
    }

    // {"name": "name", "arguments": {...}}
    if (json.name && typeof json.name === 'string' && toolMap.has(json.name)) {
      const args = json.arguments ?? json.parameters ?? {};
      toolCalls.push({
        name: json.name,
        arguments: typeof args === 'string' ? args : JSON.stringify(args),
      });
      continue;
    }

    // {"type": "function", "function": {"name": "name", "arguments": {...}}}
    if (
      json.type === 'function' &&
      json.function &&
      typeof json.function.name === 'string' &&
      toolMap.has(json.function.name)
    ) {
      const args = json.function.arguments ?? {};
      toolCalls.push({
        name: json.function.name,
        arguments: typeof args === 'string' ? args : JSON.stringify(args),
      });
      continue;
    }
  }

  return toolCalls.length > 0 ? toolCalls : null;
};

export const normalizeMessagesToBlackboxShape = async (
  messages: any[],
  modelLabel: string
): Promise<BlackboxMessage[]> => {
  if (!Array.isArray(messages)) return [];
  const allowed = new Set(['system', 'user', 'assistant']);
  const nowIso = new Date().toISOString();

  const { fetchImageAsBase64 } = await import('../utils/utils');

  const normalizedMessages = await Promise.all(
    messages
      .filter((m) => m && typeof m === 'object')
      .map(async (m) => {
        const role = String(m.role ?? '');
        let content = '';
        let data: any = undefined;

        if (typeof m.content === 'string') {
          content = m.content;
        } else if (Array.isArray(m.content)) {
          const textParts = [];
          const imagesData = [];

          for (const part of m.content) {
            if (
              (part.type === 'text' || part.type === 'input_text') &&
              typeof part.text === 'string'
            ) {
              textParts.push(part.text);
            } else if (part.type === 'image_url' && part.image_url?.url) {
              let url = part.image_url.url;
              if (url.startsWith('http://') || url.startsWith('https://')) {
                const base64 = await fetchImageAsBase64(url);
                if (base64) url = base64;
              }
              imagesData.push({
                filePath: `MultipleFiles/image_${imagesData.length}.png`,
                contents: url,
              });
            } else if (
              part.type === 'input_image' &&
              typeof part.image_url === 'string'
            ) {
              let url = part.image_url;
              if (url.startsWith('http://') || url.startsWith('https://')) {
                const base64 = await fetchImageAsBase64(url);
                if (base64) url = base64;
              }
              imagesData.push({
                filePath: `MultipleFiles/image_${imagesData.length}.png`,
                contents: url,
              });
            }
          }

          content = textParts.join('\n');
          if (imagesData.length > 0) {
            logger.debug(
              `[Vision] Extracted ${imagesData.length} image(s) from message`
            );
            data = {
              imagesData,
              fileText: '',
              title: '',
            };
          }
        } else {
          content = String(m.content ?? '');
        }

        const id = typeof m.id === 'string' && m.id ? m.id : genShortId();
        const createdAt =
          typeof m.createdAt === 'string' && m.createdAt ? m.createdAt : nowIso;

        const finalModelLabel =
          typeof m.modelLabel === 'string' && m.modelLabel
            ? m.modelLabel
            : role === 'assistant'
              ? modelLabel
              : undefined;

        const result: BlackboxMessage = {
          id,
          createdAt,
          content,
          role,
          modelLabel: finalModelLabel,
        };
        if (data) {
          result.data = data;
        }
        return result;
      })
  );

  return normalizedMessages.filter(
    (m) =>
      allowed.has(m.role) &&
      (m.content.length > 0 || m.data?.imagesData?.length)
  );
};

export const makeChatCompletionChunk = ({
  id,
  model,
  created,
  contentDelta,
  finishReason = null,
}: {
  id: string;
  model: string;
  created: number;
  contentDelta: string;
  finishReason?: string | null;
}): ChatCompletionChunk => {
  const delta: any = {};
  if (typeof contentDelta === 'string' && contentDelta.length > 0) {
    delta.content = contentDelta;
  }
  return {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: finishReason,
      },
    ],
  };
};

export const sendOpenAIError = (
  res: any,
  status: number,
  message: string,
  code: string | null
) => {
  const errorResponse: ErrorResponse = {
    error: { message, type: 'invalid_request_error', code: code ?? null },
  };
  return res.status(status).json(errorResponse);
};
