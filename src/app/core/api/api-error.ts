import { translate } from '../i18n/i18n.service';

/** Failure shapes the mock transport can produce, mirroring real HTTP semantics. */
export type ApiErrorKind = 'network' | 'unauthorized' | 'forbidden' | 'conflict' | 'not-found' | 'validation';

const STATUS: Record<ApiErrorKind, number> = {
  network: 0,
  unauthorized: 401,
  forbidden: 403,
  conflict: 409,
  'not-found': 404,
  validation: 422,
};

/** Catalog keys, resolved at throw time so the message follows the active language. */
const MESSAGE_KEY: Record<ApiErrorKind, string> = {
  network: 'error.network',
  unauthorized: 'error.unauthorized',
  forbidden: 'error.forbidden',
  conflict: 'error.conflict',
  'not-found': 'error.notFound',
  validation: 'error.validation',
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly kind: ApiErrorKind,
    message?: string,
    /** Server-side version that won the race, for conflict handling. */
    readonly currentVersion?: number,
  ) {
    super(message ?? translate(MESSAGE_KEY[kind]));
    this.name = 'ApiError';
    this.status = STATUS[kind];
  }

  /** True when retrying the same request could plausibly succeed. */
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'conflict';
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function describeError(value: unknown): string {
  return isApiError(value) ? value.message : translate('error.unexpected');
}
