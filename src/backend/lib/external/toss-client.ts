import { serverEnv } from '@/constants/server-env';

export class TossPaymentsClient {
  private baseUrl = 'https://api.tosspayments.com/v1';
  private secretKey: string;
  private isTestMode: boolean;

  constructor() {
    this.secretKey = serverEnv.TOSS_SECRET_KEY;
    // 테스트 모드: NODE_ENV === 'test' 또는 SKIP_WEBHOOK_VALIDATION === 'true'
    this.isTestMode = process.env.NODE_ENV === 'test' || process.env.SKIP_WEBHOOK_VALIDATION === 'true';
  }

  private getAuthHeader(): { Authorization: string } {
    const encodedSecretKey = Buffer.from(`${this.secretKey}:`).toString('base64');
    return {
      Authorization: `Basic ${encodedSecretKey}`,
    };
  }

  async chargeBilling(billingKey: string, params: { customerKey: string; amount: number; orderId: string }): Promise<unknown> {
    // 테스트 모드: 빌링 키로 성공/실패 판단
    if (this.isTestMode) {
      if (billingKey.includes('failed') || billingKey.includes('fail')) {
        throw new Error('Test payment failure');
      }
      return {
        status: 'DONE',
        billingKey,
        orderId: params.orderId,
        amount: params.amount,
      };
    }

    const url = `${this.baseUrl}/billing/${billingKey}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - wait and retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          const errorData = await response.json();
          throw new Error(`Toss Payments API error: ${JSON.stringify(errorData)}`);
        }

        return response.json();
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async issueBillingKey(authKey: string): Promise<unknown> {
    // 테스트 모드: authKey 기반 모킹
    if (this.isTestMode) {
      if (authKey.includes('failed') || authKey.includes('fail')) {
        throw new Error('Test billing key issuance failure');
      }
      return {
        billingKey: `test_billing_${authKey}`,
        customerKey: `test_customer_${authKey}`,
        method: 'card',
      };
    }

    const url = `${this.baseUrl}/billing/authorizations/${authKey}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - wait and retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          const errorData = await response.json();
          throw new Error(`Toss Payments API error: ${JSON.stringify(errorData)}`);
        }

        return response.json();
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async getPaymentDetails(paymentKey: string): Promise<unknown> {
    const url = `${this.baseUrl}/payments/${paymentKey}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            ...this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - wait and retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          const errorData = await response.json();
          throw new Error(`Toss Payments API error: ${JSON.stringify(errorData)}`);
        }

        return response.json();
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async deleteBillingAuthorization(billingKey: string, customerKey: string): Promise<void> {
    const url = `${this.baseUrl}/billing/authorizations/${billingKey}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            ...this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customerKey }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - wait and retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw new Error(`Toss Payments API error: ${response.statusText}`);
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
}

export const tossClient = new TossPaymentsClient();
