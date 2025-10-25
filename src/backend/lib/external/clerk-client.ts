import { serverEnv } from '@/constants/server-env';

export class ClerkClient {
  private baseUrl = 'https://api.clerk.com/v1';
  private secretKey: string;

  constructor() {
    this.secretKey = serverEnv.CLERK_SECRET_KEY;
  }

  private getAuthHeader(): { Authorization: string } {
    return {
      Authorization: `Bearer ${this.secretKey}`,
    };
  }

  async updateUserPublicMetadata(
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const url = `${this.baseUrl}/users/${userId}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: {
            ...this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            public_metadata: metadata,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - wait and retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw new Error(`Clerk API error: ${response.statusText}`);
        }

        return;
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async getUser(userId: string): Promise<{
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null> {
    const url = `${this.baseUrl}/users/${userId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Clerk API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ClerkClient] Failed to get user:', error);
      throw error;
    }
  }
}

export const clerkClient = new ClerkClient();
