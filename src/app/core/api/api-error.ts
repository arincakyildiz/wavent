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

const MESSAGE: Record<ApiErrorKind, string> = {
  network: 'Servise ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.',
  unauthorized: 'Oturumunuz doğrulanamadı. Yeniden giriş yapmanız gerekiyor.',
  forbidden: 'Bu işlem için yetkiniz bulunmuyor.',
  conflict: 'Kayıt siz görüntülerken değişti. Sayfayı yenileyip tekrar deneyin.',
  'not-found': 'Kayıt bulunamadı.',
  validation: 'Gönderilen veri doğrulanamadı.',
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly kind: ApiErrorKind,
    message?: string,
    /** Server-side version that won the race, for conflict handling. */
    readonly currentVersion?: number,
  ) {
    super(message ?? MESSAGE[kind]);
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
  return isApiError(value) ? value.message : 'Beklenmeyen bir hata oluştu.';
}
