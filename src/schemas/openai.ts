import z from 'zod';

const NonEmptyStringSchema = z.string().trim().min(1);

const OptionalBooleanSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.boolean().optional()
);

const optionalPositiveIntegerSchema = () =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }

    return value;
  }, z.number().int().positive().optional());

const ResponsesInputObjectSchema = z
  .object({
    type: z.unknown().optional(),
    role: z.unknown().optional(),
    text: z.unknown().optional(),
    content: z.unknown().optional(),
  })
  .passthrough()
  .refine(
    (value) =>
      value.type !== undefined ||
      value.role !== undefined ||
      value.text !== undefined ||
      value.content !== undefined,
    {
      message: 'input objects must include at least one of type, role, text, or content',
    }
  );

const ResponsesInputSchema = z.union([
  NonEmptyStringSchema,
  z.array(ResponsesInputObjectSchema).min(1),
  ResponsesInputObjectSchema,
]);

const ChatMessageSchema = z
  .object({
    role: NonEmptyStringSchema,
  })
  .passthrough();

const ReasoningSchema = z
  .object({
    effort: z.string().optional(),
    summary: z.string().optional(),
  })
  .passthrough();

export const ChatCompletionsBodySchema = z
  .object({
    model: NonEmptyStringSchema,
    messages: z.array(ChatMessageSchema).min(1),
    max_tokens: optionalPositiveIntegerSchema(),
    stream: OptionalBooleanSchema,
    tools: z.array(z.unknown()).nullish(),
    parallel_tool_calls: OptionalBooleanSchema,
    tool_choice: z.unknown().optional(),
  })
  .passthrough();

export const CompletionsBodySchema = z
  .object({
    model: NonEmptyStringSchema,
    prompt: z.union([z.string(), z.array(z.unknown())]),
    max_tokens: optionalPositiveIntegerSchema(),
    stream: OptionalBooleanSchema,
    echo: OptionalBooleanSchema,
    stop: z.unknown().optional(),
    n: z.unknown().optional(),
    best_of: z.unknown().optional(),
    suffix: z.unknown().optional(),
    logprobs: z.unknown().optional(),
  })
  .passthrough();

export const ResponseParamsSchema = z.object({
  responseId: NonEmptyStringSchema,
});

export const ResponsesCompactBodySchema = z
  .object({
    model: NonEmptyStringSchema,
    input: ResponsesInputSchema,
    max_output_tokens: optionalPositiveIntegerSchema(),
    tools: z.array(z.unknown()).nullish(),
    include: z.array(z.string()).nullish(),
    reasoning: ReasoningSchema.nullish(),
    reasoning_effort: z.string().nullish(),
  })
  .passthrough();

export const ResponsesBodySchema = z
  .object({
    model: NonEmptyStringSchema,
    input: ResponsesInputSchema.optional(),
    instructions: z.string().nullish(),
    previous_response_id: NonEmptyStringSchema.nullish(),
    stream: OptionalBooleanSchema,
    background: OptionalBooleanSchema,
    store: OptionalBooleanSchema,
    max_output_tokens: optionalPositiveIntegerSchema(),
    tools: z.array(z.unknown()).nullish(),
    include: z.array(z.string()).nullish(),
    reasoning: ReasoningSchema.nullish(),
    reasoning_effort: z.string().nullish(),
    parallel_tool_calls: OptionalBooleanSchema,
    tool_choice: z.unknown().optional(),
    text: z.unknown().optional(),
    temperature: z.unknown().optional(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    if (body.input === undefined && !body.previous_response_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['input'],
        message: 'input is required when previous_response_id is not provided',
      });
    }
  });
