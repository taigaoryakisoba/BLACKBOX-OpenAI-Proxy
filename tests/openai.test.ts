import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectToolCalls,
  normalizeToolDefinitions,
  buildToolSystemPrompt,
} from '../src/services/openai';

test('normalizeToolDefinitions keeps function, custom, local shell, and tool search specs', () => {
  const tools = [
    {
      type: 'function',
      name: 'read_file',
      description: 'Read a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
    },
    {
      type: 'custom',
      name: 'apply_patch',
      description: 'Apply a patch',
      format: {
        type: 'grammar',
        syntax: 'lark',
        definition: 'start: begin_patch end_patch',
      },
    },
    {
      type: 'local_shell',
    },
    {
      type: 'tool_search',
      execution: 'client',
      description: 'Search tools',
    },
  ];

  const normalized = normalizeToolDefinitions(tools);
  assert.deepEqual(
    normalized.map((tool) => [tool.kind, tool.name]),
    [
      ['function', 'read_file'],
      ['custom', 'apply_patch'],
      ['local_shell', 'local_shell'],
      ['tool_search', 'tool_search'],
    ]
  );
});

test('detectToolCalls parses mixed parallel tool call envelopes', () => {
  const tools = [
    {
      type: 'function',
      name: 'read_file',
      description: 'Read a file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    },
    {
      type: 'tool_search',
      execution: 'client',
      description: 'Search tools',
    },
  ];

  const text = JSON.stringify({
    tool_calls: [
      {
        type: 'function',
        name: 'read_file',
        arguments: { path: 'src/app.ts' },
      },
      {
        type: 'tool_search',
        arguments: { query: 'shell command', limit: 3 },
      },
    ],
  });

  const toolCalls = detectToolCalls(text, tools);
  assert.ok(toolCalls);
  assert.equal(toolCalls?.length, 2);
  assert.equal(toolCalls?.[0].kind, 'function');
  assert.equal(toolCalls?.[0].name, 'read_file');
  assert.equal(toolCalls?.[0].arguments, JSON.stringify({ path: 'src/app.ts' }));
  assert.equal(toolCalls?.[1].kind, 'tool_search');
  assert.equal(
    toolCalls?.[1].arguments,
    JSON.stringify({ query: 'shell command', limit: 3 })
  );
});

test('detectToolCalls preserves raw apply_patch payload for custom tools', () => {
  const patch = `*** Begin Patch
*** Add File: hello.txt
+hello
*** End Patch`;

  const toolCalls = detectToolCalls(patch, [
    {
      type: 'custom',
      name: 'apply_patch',
      description: 'Apply a patch',
      format: { type: 'grammar', syntax: 'lark', definition: 'patch grammar' },
    },
  ]);

  assert.ok(toolCalls);
  assert.equal(toolCalls?.length, 1);
  assert.equal(toolCalls?.[0].kind, 'custom');
  assert.equal(toolCalls?.[0].name, 'apply_patch');
  assert.equal(toolCalls?.[0].arguments, patch);
});

test('buildToolSystemPrompt mentions parallel policy and custom tool rules', () => {
  const prompt = buildToolSystemPrompt(
    [
      {
        type: 'custom',
        name: 'apply_patch',
        description: 'Apply a patch',
        format: { type: 'grammar', syntax: 'lark', definition: 'patch grammar' },
      },
      {
        type: 'function',
        name: 'read_file',
        description: 'Read a file',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
      },
    ],
    {
      parallelToolCalls: true,
      toolChoice: 'auto',
    }
  );

  assert.ok(prompt);
  assert.match(prompt ?? '', /Parallel tool calls are allowed/);
  assert.match(prompt ?? '', /apply_patch/);
  assert.match(prompt ?? '', /raw patch text/);
});
