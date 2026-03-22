import { coerceResponsesInputToArray } from './openai';

export interface StoredResponseRecord {
  id: string;
  object: 'response';
  created_at: number;
  completed_at: number | null;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  model: string;
  instructions: string | null;
  previous_response_id: string | null;
  full_input: any[];
  output: any[];
  error: any;
  store: boolean;
}

const cloneItems = (items: any[]): any[] => JSON.parse(JSON.stringify(items ?? []));

class ResponsesStore {
  private readonly records = new Map<string, StoredResponseRecord>();
  private readonly abortControllers = new Map<string, AbortController>();

  resolveRequestState(body: any): {
    instructions: string | null;
    fullInput: any[];
    previous: StoredResponseRecord | null;
  } {
    const previousResponseId =
      typeof body?.previous_response_id === 'string' && body.previous_response_id
        ? body.previous_response_id
        : null;
    const previous = previousResponseId
      ? this.records.get(previousResponseId) ?? null
      : null;

    if (previousResponseId && !previous) {
      const error: any = new Error(`previous_response_id not found: ${previousResponseId}`);
      error.status = 404;
      error.code = 'previous_response_not_found';
      throw error;
    }

    const deltaInput = coerceResponsesInputToArray(body?.input);
    const fullInput = previous
      ? [...cloneItems(previous.full_input), ...cloneItems(previous.output), ...cloneItems(deltaInput)]
      : cloneItems(deltaInput);

    const instructions =
      typeof body?.instructions === 'string'
        ? body.instructions
        : previous?.instructions ?? null;

    return { instructions, fullInput, previous };
  }

  createPendingRecord(params: {
    id: string;
    model: string;
    createdAt: number;
    instructions: string | null;
    previousResponseId: string | null;
    fullInput: any[];
    store: boolean;
  }): StoredResponseRecord {
    const record: StoredResponseRecord = {
      id: params.id,
      object: 'response',
      created_at: params.createdAt,
      completed_at: null,
      status: 'in_progress',
      model: params.model,
      instructions: params.instructions,
      previous_response_id: params.previousResponseId,
      full_input: cloneItems(params.fullInput),
      output: [],
      error: null,
      store: params.store,
    };

    this.records.set(record.id, record);
    return record;
  }

  completeRecord(id: string, output: any[], completedAt: number) {
    const record = this.records.get(id);
    if (!record) return;

    record.output = cloneItems(output);
    record.completed_at = completedAt;
    record.status = 'completed';
    record.error = null;
    this.abortControllers.delete(id);
  }

  failRecord(id: string, error: any, status: StoredResponseRecord['status'] = 'failed') {
    const record = this.records.get(id);
    if (!record) return;

    record.status = status;
    record.completed_at = Math.floor(Date.now() / 1000);
    record.error = error ?? null;
    this.abortControllers.delete(id);
  }

  getRecord(id: string): StoredResponseRecord | null {
    return this.records.get(id) ?? null;
  }

  attachAbortController(id: string, controller: AbortController) {
    this.abortControllers.set(id, controller);
  }

  cancel(id: string): StoredResponseRecord | null {
    const record = this.records.get(id) ?? null;
    if (!record) return null;

    const controller = this.abortControllers.get(id);
    controller?.abort();
    this.abortControllers.delete(id);
    record.status = 'cancelled';
    record.completed_at = Math.floor(Date.now() / 1000);
    record.error = {
      message: 'Response was cancelled',
      type: 'cancelled',
      code: 'response_cancelled',
    };
    return record;
  }
}

const responsesStore = new ResponsesStore();

export default responsesStore;
