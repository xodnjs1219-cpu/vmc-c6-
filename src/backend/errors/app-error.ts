import type { ErrorCode } from './error-codes';

/**
 * 애플리케이션 커스텀 에러 클래스
 * 에러 코드, 메시지, HTTP 상태 코드, 추가 상세 정보를 포함
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';

    // 프로토타입 체인 복구 (TypeScript에서 Error 상속 시 필요)
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

/**
 * AppError 인스턴스인지 확인하는 타입 가드
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
