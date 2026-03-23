import { getBlackboxNextScript } from '../api/blackbox/_next/script';
import { getBlackboxHomePage } from '../api/blackbox/index';
import {
  LOGIN_RETRY_COOLDOWN_MS,
  VALIDATION_TOKEN,
} from '../configs/env';
import logger from './logger';

type ValidationSource = 'env' | 'runtime' | 'none';

export interface BlackboxValidationContext {
  token: string;
  source: ValidationSource;
}

const UUID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const extractScriptPaths = (html: string): string[] =>
  Array.from(
    new Set(
      Array.from(html.matchAll(/src="([^"]+\.js)"/g))
        .map((match) => match[1])
        .filter((src) => src.startsWith('/_next/'))
    )
  );

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const extractValidationTokenFromScript = (
  scriptContent: string
): string | null => {
  const exportMatch = scriptContent.match(
    /tk:function\(\)\{return\s+([A-Za-z_$][\w$]*)\}/
  );

  if (!exportMatch) return null;

  const variableName = exportMatch[1];
  const assignmentMatch = scriptContent.match(
    new RegExp(
      `\\b${escapeRegExp(variableName)}\\s*=\\s*"(${UUID_PATTERN})"`,
      'i'
    )
  );

  return assignmentMatch?.[1] ?? null;
};

class BlackboxValidationService {
  private static instance: BlackboxValidationService | null = null;

  private runtimeToken = '';
  private pendingResolution: Promise<BlackboxValidationContext> | null = null;
  private lastFailureAt = 0;

  private constructor() {}

  static getInstance(): BlackboxValidationService {
    if (!BlackboxValidationService.instance) {
      BlackboxValidationService.instance = new BlackboxValidationService();
    }

    return BlackboxValidationService.instance;
  }

  private clearRuntimeToken() {
    this.runtimeToken = '';
  }

  private async discoverRuntimeToken(): Promise<string> {
    const homeResponse = await getBlackboxHomePage();
    const html = await homeResponse.text();
    const scriptPaths = extractScriptPaths(html);

    for (const scriptPath of scriptPaths) {
      const response = await getBlackboxNextScript({ scriptPath });
      const scriptContent = await response.text();
      const token = extractValidationTokenFromScript(scriptContent);
      if (token) return token;
    }

    throw new Error('Blackbox validation token could not be discovered');
  }

  private async getRuntimeContext(
    forceRefresh = false
  ): Promise<BlackboxValidationContext> {
    if (forceRefresh) {
      this.clearRuntimeToken();
    }

    if (this.runtimeToken) {
      return {
        token: this.runtimeToken,
        source: 'runtime',
      };
    }

    if (
      !forceRefresh &&
      this.lastFailureAt > 0 &&
      Date.now() - this.lastFailureAt < LOGIN_RETRY_COOLDOWN_MS
    ) {
      return {
        token: '',
        source: 'none',
      };
    }

    if (!this.pendingResolution) {
      this.pendingResolution = this.discoverRuntimeToken()
        .then((token) => {
          this.runtimeToken = token;
          this.lastFailureAt = 0;
          logger.info('[BlackboxValidation] Runtime validation token discovered');

          return {
            token,
            source: 'runtime' as const,
          };
        })
        .catch((error: any) => {
          this.lastFailureAt = Date.now();
          logger.warn(
            `[BlackboxValidation] ${error?.message ?? 'Validation token discovery failed'}`
          );
          this.clearRuntimeToken();

          return {
            token: '',
            source: 'none' as const,
          };
        })
        .finally(() => {
          this.pendingResolution = null;
        });
    }

    return this.pendingResolution;
  }

  async getValidationContext(
    forceRefresh = false
  ): Promise<BlackboxValidationContext> {
    const envToken = VALIDATION_TOKEN.trim();
    if (envToken) {
      return {
        token: envToken,
        source: 'env',
      };
    }

    return this.getRuntimeContext(forceRefresh);
  }

  invalidateRuntimeToken(reason?: string) {
    if (reason) {
      logger.warn(`[BlackboxValidation] Invalidating runtime token: ${reason}`);
    }

    this.clearRuntimeToken();
  }

  async warmUp() {
    if (VALIDATION_TOKEN.trim()) return;
    await this.getValidationContext();
  }
}

const blackboxValidationService = BlackboxValidationService.getInstance();

export default blackboxValidationService;

export const getBlackboxValidationContext = async (
  forceRefresh = false
): Promise<BlackboxValidationContext> =>
  blackboxValidationService.getValidationContext(forceRefresh);

export const invalidateRuntimeBlackboxValidation = (reason?: string) =>
  blackboxValidationService.invalidateRuntimeToken(reason);

export const warmBlackboxValidation = async () => {
  await blackboxValidationService.warmUp();
};
