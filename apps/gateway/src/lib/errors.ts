/**
 * 错误码定义
 */
export const ERROR_CODES = {
  // 通用错误
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Agent 相关
  HANDLE_TAKEN: 'HANDLE_TAKEN',
  INVALID_HANDLE: 'INVALID_HANDLE',
  AGENT_NOT_CLAIMED: 'AGENT_NOT_CLAIMED',
  AGENT_FROZEN: 'AGENT_FROZEN',

  // Claim 相关
  INVALID_URL: 'INVALID_URL',
  CLAIM_EXPIRED: 'CLAIM_EXPIRED',
  CLAIM_NOT_PENDING: 'CLAIM_NOT_PENDING',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',

  // DM 相关
  DM_SELF_REQUEST: 'DM_SELF_REQUEST',
  DM_REQUEST_NOT_PENDING: 'DM_REQUEST_NOT_PENDING',
  DM_REQUEST_EXPIRED: 'DM_REQUEST_EXPIRED',
  DM_SESSION_CLOSED: 'DM_SESSION_CLOSED',
  DM_MESSAGE_LIMIT: 'DM_MESSAGE_LIMIT',
  DM_INVALID_FIRST_MESSAGE: 'DM_INVALID_FIRST_MESSAGE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * 应用错误类
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly hint?: string
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        hint: this.hint,
      },
    };
  }
}

/**
 * 创建 501 Not Implemented 错误
 */
export function notImplemented(feature: string = 'This feature'): AppError {
  return new AppError(
    ERROR_CODES.NOT_IMPLEMENTED,
    `${feature} is not yet implemented`,
    501,
    'Check back later or refer to docs for implementation timeline'
  );
}

/**
 * 创建 404 Not Found 错误
 */
export function notFound(resource: string = 'Resource'): AppError {
  return new AppError(
    ERROR_CODES.NOT_FOUND,
    `${resource} not found`,
    404
  );
}

/**
 * 标准成功响应格式
 */
export function successResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}
