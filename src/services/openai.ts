import type { ZodIssue } from 'zod';
import { ToolCall, OpenAIMessage, BlackboxMessage } from '../types';
import {
  ChatCompletionChunk,
  CompletionChunk,
  ErrorResponse,
} from '../models';
import { genShortId } from '../utils/utils';
import logger from './logger';

export type ProxyToolKind =
  | 'function'
  | 'custom'
  | 'local_shell'
  | 'tool_search'
  | 'web_search'
  | 'image_generation';

export interface NormalizedToolDefinition {
  kind: ProxyToolKind;
  name: string;
  description: string;
  parameters?: any;
  format?: any;
  rawTool: any;
}

const TOOL_KIND_LABELS: Record<ProxyToolKind, string> = {
  function: 'Function',
  custom: 'Custom',
  local_shell: 'Local shell',
  tool_search: 'Tool search',
  web_search: 'Web search',
  image_generation: 'Image generation',
};

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

export const extractToolOutputText = (output: any): string => {
  if (typeof output === 'string') return output;

  if (Array.isArray(output)) {
    const parts = output
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        if (typeof item.text === 'string') return item.text;
        return '';
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join('\n');
  }

  if (output && typeof output === 'object') {
    if (typeof output.text === 'string') return output.text;
    if (typeof output.content === 'string') return output.content;
    if (Array.isArray(output.content_items)) {
      const text = extractToolOutputText(output.content_items);
      if (text) return text;
    }
    if (Array.isArray(output.content)) {
      const text = extractToolOutputText(output.content);
      if (text) return text;
    }
    if (typeof output.output === 'string') return output.output;
    if (typeof output.body === 'string') return output.body;
    if (output.body) {
      const text = extractToolOutputText(output.body);
      if (text) return text;
    }
  }

  try {
    return JSON.stringify(output ?? '');
  } catch {
    return '';
  }
};

const normalizeMessageRole = (role: string): string => {
  if (role === 'developer') return 'system';
  return role;
};

const serializePendingToolCall = (
  item: any,
  kind: 'function' | 'custom' | 'local_shell' | 'tool_search'
): string => {
  if (kind === 'function') {
    return `<function_call name="${item.name ?? 'unknown'}" call_id="${
      item.call_id ?? `call_${genShortId()}`
    }">\n${item.arguments ?? '{}'}\n</function_call>`;
  }

  if (kind === 'custom') {
    return `<custom_tool_call name="${item.name ?? 'unknown'}" call_id="${
      item.call_id ?? `call_${genShortId()}`
    }">\n${item.input ?? ''}\n</custom_tool_call>`;
  }

  if (kind === 'local_shell') {
    return `<local_shell_call call_id="${
      item.call_id ?? `call_${genShortId()}`
    }">\n${JSON.stringify(
      {
        status: item.status ?? null,
        action: item.action ?? null,
      },
      null,
      2
    )}\n</local_shell_call>`;
  }

  return `<tool_search_call call_id="${
    item.call_id ?? `call_${genShortId()}`
  }">\n${JSON.stringify(
    {
      execution: item.execution ?? 'client',
      arguments: item.arguments ?? {},
    },
    null,
    2
  )}\n</tool_search_call>`;
};

const serializeToolOutput = (
  kind: 'function' | 'custom' | 'tool_search',
  item: any
): string => {
  const callId = item.call_id ?? 'unknown';
  if (kind === 'tool_search') {
    return `<tool_search_output call_id="${callId}">\n${JSON.stringify(
      {
        status: item.status ?? 'completed',
        execution: item.execution ?? 'client',
        tools: item.tools ?? [],
      },
      null,
      2
    )}\n</tool_search_output>`;
  }

  const tag = kind === 'custom' ? 'custom_tool_output' : 'tool_output';
  const toolText = extractToolOutputText(item.output);
  return `<${tag} call_id="${callId}">\n${toolText}\n</${tag}>`;
};

const extractReasoningSummaryText = (item: any): string => {
  if (!Array.isArray(item?.summary)) return '';
  return item.summary
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
};

export const coerceResponsesInputToArray = (input: any): any[] => {
  if (typeof input === 'string' && input.trim()) {
    return [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: input }],
      },
    ];
  }

  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') return [input];
  return [];
};

export const normalizeResponsesInputToOpenAiMessages = (
  input: any,
  instructions?: string | null
): OpenAIMessage[] => {
  const msgs: OpenAIMessage[] = [];

  if (typeof instructions === 'string' && instructions.trim()) {
    msgs.push({ role: 'system', content: instructions });
  }

  const items = coerceResponsesInputToArray(input);
  if (items.length === 0) return msgs;

  const pendingToolCalls: string[] = [];
  const flushPendingToolCalls = () => {
    if (pendingToolCalls.length === 0) return;
    msgs.push({
      role: 'assistant',
      content: pendingToolCalls.join('\n\n'),
    });
    pendingToolCalls.length = 0;
  };

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    if (item.type === 'function_call') {
      pendingToolCalls.push(serializePendingToolCall(item, 'function'));
      continue;
    }

    if (item.type === 'custom_tool_call') {
      pendingToolCalls.push(serializePendingToolCall(item, 'custom'));
      continue;
    }

    if (item.type === 'local_shell_call') {
      pendingToolCalls.push(serializePendingToolCall(item, 'local_shell'));
      continue;
    }

    if (item.type === 'tool_search_call') {
      pendingToolCalls.push(serializePendingToolCall(item, 'tool_search'));
      continue;
    }

    flushPendingToolCalls();

    if (item.type === 'function_call_output') {
      msgs.push({
        role: 'user',
        content: serializeToolOutput('function', item),
      });
      continue;
    }

    if (item.type === 'custom_tool_call_output') {
      msgs.push({
        role: 'user',
        content: serializeToolOutput('custom', item),
      });
      continue;
    }

    if (item.type === 'tool_search_output') {
      msgs.push({
        role: 'user',
        content: serializeToolOutput('tool_search', item),
      });
      continue;
    }

    if (item.type === 'compaction') {
      if (
        typeof item.encrypted_content === 'string' &&
        item.encrypted_content
      ) {
        msgs.push({
          role: 'system',
          content: `<conversation_summary>\n${item.encrypted_content}\n</conversation_summary>`,
        });
      }
      continue;
    }

    if (item.type === 'reasoning') {
      const summary = extractReasoningSummaryText(item);
      if (summary) {
        msgs.push({
          role: 'system',
          content: `<reasoning_summary>\n${summary}\n</reasoning_summary>`,
        });
      }
      continue;
    }

    if (item.type === 'message' && typeof item.role === 'string') {
      const role = normalizeMessageRole(item.role);
      if (Array.isArray(item.content)) {
        msgs.push({ role, content: item.content });
      } else {
        const text = extractTextFromResponsesContent(item.content);
        if (text) msgs.push({ role, content: text });
      }
      continue;
    }

    if (typeof item.role === 'string') {
      const role = normalizeMessageRole(item.role);
      if (Array.isArray(item.content)) {
        msgs.push({ role, content: item.content });
      } else {
        const text = extractTextFromResponsesContent(item.content);
        if (text) msgs.push({ role, content: text });
      }
      continue;
    }

    if (typeof item.text === 'string') {
      msgs.push({ role: 'user', content: item.text });
    }
  }

  flushPendingToolCalls();
  return msgs;
};

export const normalizeResponsesBodyToOpenAiMessages = (
  body: any
): OpenAIMessage[] =>
  normalizeResponsesInputToOpenAiMessages(
    body?.input,
    typeof body?.instructions === 'string' ? body.instructions : null
  );

const manualToolParameters = (kind: ProxyToolKind): any => {
  if (kind === 'local_shell') {
    return {
      type: 'object',
      properties: {
        command: {
          type: 'array',
          items: { type: 'string' },
          description: 'Command and arguments as an array of strings.',
        },
        workdir: {
          type: 'string',
          description: 'Optional working directory.',
        },
        timeout_ms: {
          type: 'number',
          description: 'Optional timeout in milliseconds.',
        },
      },
      required: ['command'],
    };
  }

  if (kind === 'tool_search') {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to run.',
        },
        limit: {
          type: 'number',
          description: 'Optional maximum number of results.',
        },
      },
      required: ['query'],
    };
  }

  if (kind === 'web_search') {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to run.',
        },
      },
      required: ['query'],
    };
  }

  if (kind === 'image_generation') {
    return {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Prompt for the image generation request.',
        },
      },
      required: ['prompt'],
    };
  }

  return {};
};

export const normalizeToolDefinitions = (
  tools: any[]
): NormalizedToolDefinition[] => {
  if (!Array.isArray(tools)) return [];

  return tools
    .map((tool) => {
      if (!tool || typeof tool !== 'object') return null;

      const type =
        typeof tool.type === 'string'
          ? tool.type
          : tool.function
            ? 'function'
            : typeof tool.name === 'string'
              ? 'function'
              : null;

      if (type === 'function') {
        const fn = tool.function ?? tool;
        const name = fn.name ?? tool.name ?? '';
        if (!name) return null;
        return {
          kind: 'function' as const,
          name,
          description: fn.description ?? tool.description ?? '',
          parameters: fn.parameters ?? tool.parameters ?? {},
          rawTool: tool,
        };
      }

      if (type === 'custom') {
        const name = tool.name ?? '';
        if (!name) return null;
        return {
          kind: 'custom' as const,
          name,
          description: tool.description ?? '',
          format: tool.format ?? null,
          rawTool: tool,
        };
      }

      if (
        type === 'local_shell' ||
        type === 'tool_search' ||
        type === 'web_search' ||
        type === 'image_generation'
      ) {
        return {
          kind: type,
          name: type,
          description: tool.description ?? '',
          parameters: tool.parameters ?? manualToolParameters(type),
          rawTool: tool,
        };
      }

      return null;
    })
    .filter((tool): tool is NormalizedToolDefinition => Boolean(tool));
};

const describeParameters = (parameters: any): string => {
  if (
    !parameters ||
    typeof parameters !== 'object' ||
    !parameters.properties ||
    typeof parameters.properties !== 'object'
  ) {
    return '';
  }

  const required = new Set(
    Array.isArray(parameters.required) ? parameters.required : []
  );

  const lines = Object.entries(parameters.properties)
    .map(([key, value]: [string, any]) => {
      const requiredTag = required.has(key) ? 'required' : 'optional';
      const typeTag = value?.type ? ` [${value.type}]` : '';
      const desc = value?.description ? `: ${value.description}` : '';
      return `  - ${key} (${requiredTag})${typeTag}${desc}`;
    })
    .join('\n');

  return lines ? `\nParameters:\n${lines}` : '';
};

const describeCustomFormat = (format: any): string => {
  if (!format || typeof format !== 'object') return '';

  const lines: string[] = [];
  if (typeof format.type === 'string') {
    lines.push(`Format type: ${format.type}`);
  }
  if (typeof format.syntax === 'string') {
    lines.push(`Syntax: ${format.syntax}`);
  }
  if (typeof format.definition === 'string' && format.definition.trim()) {
    const definition = format.definition.trim();
    const shortened =
      definition.length > 1600
        ? `${definition.slice(0, 1600)}\n...`
        : definition;
    lines.push(`Definition:\n${shortened}`);
  }

  return lines.length > 0 ? `\n${lines.join('\n')}` : '';
};

const buildToolChoiceInstruction = (
  toolChoice: any,
  tools: NormalizedToolDefinition[]
): string => {
  if (toolChoice === 'none') {
    return 'Tool choice policy: do not call any tools.';
  }

  if (toolChoice === 'required') {
    return 'Tool choice policy: you must call at least one tool before giving a final answer.';
  }

  if (typeof toolChoice === 'string' && toolChoice && toolChoice !== 'auto') {
    const match = tools.find((tool) => tool.name === toolChoice);
    if (match) {
      return `Tool choice policy: if you call a tool, only call \`${match.name}\`.`;
    }
  }

  if (
    toolChoice &&
    typeof toolChoice === 'object' &&
    typeof toolChoice.name === 'string'
  ) {
    return `Tool choice policy: only call \`${toolChoice.name}\`.`;
  }

  if (
    toolChoice &&
    typeof toolChoice === 'object' &&
    typeof toolChoice.function?.name === 'string'
  ) {
    return `Tool choice policy: only call \`${toolChoice.function.name}\`.`;
  }

  return 'Tool choice policy: choose tools automatically only when they are genuinely useful.';
};

export const buildToolSystemPrompt = (
  tools: any[],
  options: {
    parallelToolCalls?: boolean;
    toolChoice?: any;
  } = {}
): string | null => {
  const normalizedTools = normalizeToolDefinitions(tools);
  if (normalizedTools.length === 0) return null;

  const parallelToolCalls = options.parallelToolCalls !== false;
  const customTools = normalizedTools.filter((tool) => tool.kind === 'custom');
  const genericCustomTools = customTools.filter(
    (tool) =>
      !['apply_patch', 'js_repl', 'artifacts', 'exec'].includes(tool.name)
  );

  const toolDescriptions = normalizedTools
    .map((tool) => {
      const heading = `### ${tool.name} [${TOOL_KIND_LABELS[tool.kind]}]`;
      const description = tool.description || 'No description provided.';

      if (tool.kind === 'custom') {
        return `${heading}\n${description}${describeCustomFormat(tool.format)}`;
      }

      return `${heading}\n${description}${describeParameters(tool.parameters)}`;
    })
    .join('\n\n');

  const customFormatLines: string[] = [];
  if (customTools.some((tool) => tool.name === 'apply_patch')) {
    customFormatLines.push(
      '- For `apply_patch`, output ONLY the raw patch text. Do not wrap it in JSON, markdown fences, or commentary.'
    );
  }
  if (customTools.some((tool) => tool.name === 'js_repl')) {
    customFormatLines.push(
      '- For `js_repl`, output ONLY raw JavaScript source, optionally starting with `// codex-js-repl:`.'
    );
  }
  if (customTools.some((tool) => tool.name === 'artifacts')) {
    customFormatLines.push(
      '- For `artifacts`, output ONLY raw JavaScript source, optionally starting with `// codex-artifact-tool:`.'
    );
  }
  if (customTools.some((tool) => tool.name === 'exec')) {
    customFormatLines.push(
      '- For `exec`, output ONLY raw code, optionally starting with `// @exec:`.'
    );
  }
  if (genericCustomTools.length > 0) {
    customFormatLines.push(
      '- For any other custom tool, use JSON: `{"tool_calls":[{"type":"custom","name":"tool_name","input":"raw input string"}]}`.'
    );
  }

  return `You have access to tools, but the upstream model does not support native tool calling. You MUST follow this proxy protocol exactly.

When you decide to call tools, output ONLY one of these payload formats:
1. Function tools:
{"tool_calls":[{"type":"function","name":"tool_name","arguments":{"key":"value"}}]}
2. Local shell:
{"tool_calls":[{"type":"local_shell","command":["bash","-lc","pwd"],"workdir":"/repo","timeout_ms":10000}]}
3. Tool search:
{"tool_calls":[{"type":"tool_search","arguments":{"query":"search phrase","limit":5}}]}
4. Custom/freeform tools:
${customFormatLines.length > 0 ? customFormatLines.join('\n') : '- If you use a custom tool, output ONLY the tool payload required by that tool.'}

Critical rules:
- Output ONLY the tool-call payload. No prose before it, no prose after it.
- If no tool is needed, answer normally instead of outputting a tool payload.
- Function-tool arguments must be valid JSON.
- Do not invent tools or tool names.
- Do not simulate tool results.
- Wait for the real tool output before continuing.
- Do not wrap raw custom-tool payloads in markdown fences.
- ${
    parallelToolCalls
      ? 'Parallel tool calls are allowed for independent non-custom tools. If you emit multiple calls, use a single `tool_calls` array.'
      : 'Parallel tool calls are NOT allowed. Emit at most one tool call.'
  }
- ${buildToolChoiceInstruction(options.toolChoice, normalizedTools)}

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
      ) {
        j++;
      }
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
      inString = !inString;
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
            // ignore invalid json candidate
          }
        }
        start = -1;
        depth = 0;
        inString = false;
      }
    }
  }

  if (depth > 0 && start !== -1) {
    let candidate = text.slice(start);
    if (inString) candidate += '"';
    candidate += '}'.repeat(depth);

    try {
      JSON.parse(candidate);
      results.push(candidate);
    } catch {
      const fixed = fixJsonQuotes(candidate);
      try {
        JSON.parse(fixed);
        results.push(fixed);
      } catch {
        // ignore invalid json candidate
      }
    }
  }

  return results;
};

const parseSingleJsonCandidate = (text: string): any[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const candidates = [trimmed, fixJsonQuotes(trimmed)];
  for (const candidate of candidates) {
    try {
      return [JSON.parse(candidate)];
    } catch {
      // try next candidate
    }
  }

  return [];
};

const normalizeCallArgumentsText = (args: any): string => {
  if (typeof args === 'string') return args;
  try {
    return JSON.stringify(args ?? {});
  } catch {
    return '{}';
  }
};

const buildDetectedCall = (
  tool: NormalizedToolDefinition,
  value: any,
  explicitKind?: ProxyToolKind
): ToolCall => {
  const kind = explicitKind ?? tool.kind;

  if (kind === 'custom') {
    const input =
      typeof value === 'string'
        ? value
        : typeof value?.input === 'string'
          ? value.input
          : normalizeCallArgumentsText(value);
    return {
      kind,
      name: tool.name,
      arguments: input,
      payload: typeof value === 'object' ? value : undefined,
    };
  }

  if (kind === 'local_shell') {
    const payload =
      value && typeof value === 'object'
        ? {
            command: Array.isArray(value.command)
              ? value.command
              : Array.isArray(value.parameters?.command)
                ? value.parameters.command
                : [],
            workdir:
              value.workdir ??
              value.working_directory ??
              value.parameters?.workdir ??
              value.parameters?.working_directory ??
              null,
            timeout_ms:
              value.timeout_ms ?? value.parameters?.timeout_ms ?? null,
          }
        : { command: [] };

    return {
      kind,
      name: tool.name,
      arguments: normalizeCallArgumentsText(payload),
      payload,
    };
  }

  if (
    kind === 'tool_search' ||
    kind === 'web_search' ||
    kind === 'image_generation'
  ) {
    const payload =
      value && typeof value === 'object'
        ? (value.arguments ?? value.parameters ?? value)
        : {};
    return {
      kind,
      name: tool.name,
      arguments: normalizeCallArgumentsText(payload),
      payload,
    };
  }

  const args =
    value && typeof value === 'object'
      ? (value.arguments ?? value.parameters ?? value)
      : value;
  return {
    kind,
    name: tool.name,
    arguments: normalizeCallArgumentsText(args),
    payload: typeof args === 'object' ? args : undefined,
  };
};

const collectToolCallsFromJson = (
  json: any,
  toolMap: Map<string, NormalizedToolDefinition>,
  toolCalls: ToolCall[]
) => {
  if (!json || typeof json !== 'object') return;

  if (Array.isArray(json.tool_calls)) {
    for (const item of json.tool_calls) {
      collectToolCallsFromJson(item, toolMap, toolCalls);
    }
    return;
  }

  if (Array.isArray(json.calls)) {
    for (const item of json.calls) {
      collectToolCallsFromJson(item, toolMap, toolCalls);
    }
    return;
  }

  if (
    json.type === 'function' &&
    json.function &&
    typeof json.function.name === 'string'
  ) {
    const tool = toolMap.get(json.function.name);
    if (tool) {
      toolCalls.push(
        buildDetectedCall(tool, json.function.arguments ?? {}, 'function')
      );
    }
    return;
  }

  if (json.type === 'custom' && typeof json.name === 'string') {
    const tool = toolMap.get(json.name);
    if (tool) {
      toolCalls.push(buildDetectedCall(tool, json.input ?? '', 'custom'));
    }
    return;
  }

  if (json.type === 'local_shell') {
    const tool = toolMap.get('local_shell');
    if (tool) toolCalls.push(buildDetectedCall(tool, json, 'local_shell'));
    return;
  }

  if (json.type === 'tool_search') {
    const tool = toolMap.get('tool_search');
    if (tool) toolCalls.push(buildDetectedCall(tool, json, 'tool_search'));
    return;
  }

  if (json.type === 'web_search') {
    const tool = toolMap.get('web_search');
    if (tool) toolCalls.push(buildDetectedCall(tool, json, 'web_search'));
    return;
  }

  if (json.type === 'image_generation') {
    const tool = toolMap.get('image_generation');
    if (tool) toolCalls.push(buildDetectedCall(tool, json, 'image_generation'));
    return;
  }

  if (typeof json.tool === 'string') {
    const tool = toolMap.get(json.tool);
    if (tool) {
      toolCalls.push(
        buildDetectedCall(
          tool,
          json.parameters ?? json.arguments ?? json.input ?? {},
          tool.kind
        )
      );
    }
    return;
  }

  if (typeof json.name === 'string') {
    const tool = toolMap.get(json.name);
    if (tool) {
      toolCalls.push(
        buildDetectedCall(
          tool,
          json.arguments ?? json.parameters ?? json.input ?? {},
          tool.kind
        )
      );
    }
  }
};

export const extractThinkingSections = (
  text: string
): { visibleText: string; reasoningText: string } => {
  const reasoningBlocks = Array.from(
    text.matchAll(/<think>([\s\S]*?)<\/think>/gi)
  )
    .map((match) => match[1].trim())
    .filter(Boolean);

  return {
    visibleText: text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(),
    reasoningText: reasoningBlocks.join('\n\n').trim(),
  };
};

export const findFirstToolCallIndex = (text: string, tools: any[]): number => {
  if (!text || !Array.isArray(tools) || tools.length === 0) return -1;

  const normalizedTools = normalizeToolDefinitions(tools);
  const indices: number[] = [];
  const pushIndex = (index: number) => {
    if (index >= 0) indices.push(index);
  };

  const structuredPatterns = [
    /\{\s*"tool_calls"\s*:/,
    /\{\s*"tool"\s*:/,
    /\{\s*"type"\s*:\s*"(?:function|custom|local_shell|tool_search|web_search|image_generation)"/,
    /\[Tool call:/,
  ];

  for (const pattern of structuredPatterns) {
    pushIndex(text.search(pattern));
  }

  if (normalizedTools.some((tool) => tool.name === 'apply_patch')) {
    pushIndex(text.indexOf('*** Begin Patch'));
  }
  if (normalizedTools.some((tool) => tool.name === 'js_repl')) {
    pushIndex(text.indexOf('// codex-js-repl:'));
  }
  if (normalizedTools.some((tool) => tool.name === 'artifacts')) {
    pushIndex(text.indexOf('// codex-artifact-tool:'));
  }
  if (normalizedTools.some((tool) => tool.name === 'exec')) {
    pushIndex(text.indexOf('// @exec:'));
  }

  return indices.length > 0 ? Math.min(...indices) : -1;
};

export const detectToolCalls = (
  text: string,
  tools: any[]
): ToolCall[] | null => {
  if (!text || !Array.isArray(tools) || tools.length === 0) return null;

  const toolDefinitions = normalizeToolDefinitions(tools);
  const toolMap = new Map(toolDefinitions.map((tool) => [tool.name, tool]));
  if (toolMap.size === 0) return null;

  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const toolCalls: ToolCall[] = [];

  const applyPatchTool = toolMap.get('apply_patch');
  if (applyPatchTool) {
    const patchRegex = /\*\*\* Begin Patch[\s\S]*?(?:\*\*\* End Patch|$)/g;
    let match: RegExpExecArray | null;
    while ((match = patchRegex.exec(cleaned)) !== null) {
      toolCalls.push(
        buildDetectedCall(applyPatchTool, match[0], applyPatchTool.kind)
      );
    }
    if (toolCalls.length > 0) return toolCalls;
  }

  const jsReplTool = toolMap.get('js_repl');
  if (jsReplTool && cleaned.includes('// codex-js-repl:')) {
    const jsReplRegex =
      /(?:\/\/\s*codex-js-repl:[^\r\n]*\r?\n)(?:\s*)(?:[^\s{"`]|`[^`]|``[^`])[\s\S]*/g;
    let match: RegExpExecArray | null;
    while ((match = jsReplRegex.exec(cleaned)) !== null) {
      const input = match[0].trim();
      if (input) {
        toolCalls.push(buildDetectedCall(jsReplTool, input, jsReplTool.kind));
      }
    }
    if (toolCalls.length > 0) return toolCalls;
  }

  const artifactsTool = toolMap.get('artifacts');
  if (artifactsTool && cleaned.includes('// codex-artifact-tool:')) {
    const artifactsRegex =
      /(?:\/\/\s*codex-artifact-tool:[^\r\n]*\r?\n)(?:\s*)(?:[^\s{"`]|`[^`]|``[^`])[\s\S]*/g;
    let match: RegExpExecArray | null;
    while ((match = artifactsRegex.exec(cleaned)) !== null) {
      const input = match[0].trim();
      if (input) {
        toolCalls.push(
          buildDetectedCall(artifactsTool, input, artifactsTool.kind)
        );
      }
    }
    if (toolCalls.length > 0) return toolCalls;
  }

  const execTool = toolMap.get('exec');
  if (execTool && cleaned.includes('// @exec:')) {
    const execRegex = /(?:\/\/\s*@exec:[^\r\n]*\r?\n)[\s\S]+/g;
    let match: RegExpExecArray | null;
    while ((match = execRegex.exec(cleaned)) !== null) {
      const input = match[0].trim();
      if (input) {
        toolCalls.push(buildDetectedCall(execTool, input, execTool.kind));
      }
    }
    if (toolCalls.length > 0) return toolCalls;
  }

  const toolCallRegex = /\[Tool call:\s*([a-zA-Z0-9_.-]+)\((.*?)\)\]/g;
  let callMatch: RegExpExecArray | null;
  while ((callMatch = toolCallRegex.exec(cleaned)) !== null) {
    const name = callMatch[1];
    const args = callMatch[2];
    const tool = toolMap.get(name);
    if (tool) {
      toolCalls.push(buildDetectedCall(tool, args, tool.kind));
    }
  }
  if (toolCalls.length > 0) return toolCalls;

  const jsonCandidates = [
    ...parseSingleJsonCandidate(cleaned),
    ...extractAllJsonObjects(cleaned).flatMap((candidate) =>
      parseSingleJsonCandidate(candidate)
    ),
  ];

  for (const candidate of jsonCandidates) {
    collectToolCallsFromJson(candidate, toolMap, toolCalls);
  }

  if (toolCalls.length === 0) return null;

  const deduped = toolCalls.filter((toolCall, index, calls) => {
    const signature = `${toolCall.kind ?? 'function'}:${toolCall.name}:${toolCall.arguments}`;
    return (
      calls.findIndex(
        (candidate) =>
          `${candidate.kind ?? 'function'}:${candidate.name}:${candidate.arguments}` ===
          signature
      ) === index
    );
  });

  return deduped.length > 0 ? deduped : null;
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
        const role = normalizeMessageRole(String(m.role ?? ''));
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
    (message) =>
      allowed.has(message.role) &&
      (message.content.length > 0 || message.data?.imagesData?.length)
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

export const makeCompletionChunk = ({
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
}): CompletionChunk => ({
  id,
  object: 'text_completion',
  created,
  model,
  choices: [
    {
      text: contentDelta,
      index: 0,
      logprobs: null,
      finish_reason: finishReason,
    },
  ],
});

export const sendOpenAIError = (
  res: any,
  status: number,
  message: string,
  code: string | null,
  details?: unknown
) => {
  const errorResponse: ErrorResponse = {
    error: {
      message,
      type: 'invalid_request_error',
      code: code ?? null,
      ...(typeof details !== 'undefined' ? { details } : {}),
    },
  };
  return res.status(status).json(errorResponse);
};

const formatValidationIssuePath = (path: PropertyKey[]): string =>
  path
    .map((segment) =>
      typeof segment === 'number' ? `[${segment}]` : String(segment)
    )
    .join('.')
    .replace(/\.\[/g, '[');

const buildValidationMessage = (issues: ZodIssue[]): string =>
  issues
    .map((issue) => {
      const issuePath = formatValidationIssuePath(issue.path);
      return issuePath ? `${issuePath}: ${issue.message}` : issue.message;
    })
    .join('; ');

export const sendValidationError = (res: any, issues: ZodIssue[]) =>
  sendOpenAIError(
    res,
    400,
    buildValidationMessage(issues) || 'Validation Error',
    'validation_error',
    issues
  );

export const sendKnownRequestError = (res: any, error: any) => {
  if (
    typeof error?.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return sendOpenAIError(
      res,
      error.status,
      error?.message ?? 'Invalid request',
      typeof error?.code === 'string' ? error.code : 'invalid_request',
      error?.details
    );
  }

  return null;
};
