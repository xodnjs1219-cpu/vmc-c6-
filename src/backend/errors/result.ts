import type { AppError } from './app-error';

/**
 * Result 타입: 성공 또는 실패를 나타내는 유니온 타입
 * 함수의 반환 타입으로 사용하여 타입 안전한 에러 처리 구현
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * 성공 결과를 생성하는 헬퍼 함수
 */
export function success<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * 실패 결과를 생성하는 헬퍼 함수
 */
export function failure<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Result 타입에서 값을 안전하게 추출
 * @throws 실패한 경우 에러를 throw
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw (result as { ok: false; error: E }).error;
}

/**
 * Result 타입에서 값을 안전하게 추출 (기본값 제공)
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Result 타입 가드: 성공 여부 확인
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Result 타입 가드: 실패 여부 확인
 */
export function isError<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}
