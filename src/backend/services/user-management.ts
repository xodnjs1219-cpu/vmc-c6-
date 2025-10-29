import type { SupabaseClient } from '@supabase/supabase-js';
import { clerkClient } from '@/backend/lib/external/clerk-client';
import { ErrorCodes, AppError, type Result, success, failure } from '@/backend/errors';

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

/**
 * 사용자 관리 서비스
 * Clerk와 Supabase 간 사용자 정보 동기화 담당
 */
export class UserManagementService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * 사용자 존재 여부 확인 및 필요 시 생성
   * 1. DB에서 사용자 조회
   * 2. 없으면 Clerk에서 가져와 생성
   */
  async getOrCreateUser(userId: string): Promise<Result<User>> {
    // 1. DB에서 사용자 조회
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('id, email, first_name, last_name, image_url')
      .eq('id', userId)
      .single();

    if (userError) {
      // PGRST116: 레코드가 없음
      if (userError.code === 'PGRST116') {
        // 2. Clerk에서 사용자 정보 가져와 생성
        return this.syncUserFromClerk(userId);
      }

      // 기타 DB 에러
      return failure(
        new AppError(
          ErrorCodes.USER_QUERY_ERROR,
          '사용자 정보 조회에 실패했습니다.',
          500,
          { originalError: userError },
        ),
      );
    }

    return success(user as User);
  }

  /**
   * Clerk에서 사용자 정보를 가져와 DB에 동기화
   */
  async syncUserFromClerk(userId: string): Promise<Result<User>> {
    try {
      // 1. Clerk에서 사용자 정보 가져오기
      const clerkUser = await clerkClient.getUser(userId);

      if (!clerkUser) {
        return failure(
          new AppError(
            ErrorCodes.USER_NOT_FOUND,
            '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.',
            404,
          ),
        );
      }

      const primaryEmail = clerkUser.email_addresses[0]?.email_address;
      if (!primaryEmail) {
        return failure(
          new AppError(
            ErrorCodes.USER_CREATE_FAILED,
            '사용자 이메일 정보가 없습니다.',
            400,
          ),
        );
      }

      // 2. DB에 사용자 생성
      const { data: newUser, error: createError } = await this.supabase
        .from('users')
        .insert({
          id: clerkUser.id,
          email: primaryEmail,
          first_name: clerkUser.first_name || null,
          last_name: clerkUser.last_name || null,
          image_url: clerkUser.image_url || null,
        })
        .select('id, email, first_name, last_name, image_url')
        .single();

      if (createError) {
        return failure(
          new AppError(
            ErrorCodes.USER_CREATE_FAILED,
            '사용자 정보 생성에 실패했습니다.',
            500,
            { originalError: createError },
          ),
        );
      }

      return success(newUser as User);
    } catch (error) {
      return failure(
        new AppError(
          ErrorCodes.CLERK_API_ERROR,
          '사용자 정보 조회에 실패했습니다.',
          500,
          { originalError: error },
        ),
      );
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  async updateUser(
    userId: string,
    updates: Partial<Omit<User, 'id'>>,
  ): Promise<Result<User>> {
    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, first_name, last_name, image_url')
      .single();

    if (error) {
      return failure(
        new AppError(
          ErrorCodes.DATABASE_ERROR,
          '사용자 정보 업데이트에 실패했습니다.',
          500,
          { originalError: error },
        ),
      );
    }

    return success(data as User);
  }
}
