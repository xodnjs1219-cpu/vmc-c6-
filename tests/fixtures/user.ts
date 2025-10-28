// tests/fixtures/user.ts
export const mockFreeUser = {
  userId: 'user_free_123',
  planType: 'Free' as const,
  remainingTries: 3,
  billingKey: null,
  nextPaymentDate: null,
};

export const mockProUser = {
  userId: 'user_pro_456',
  planType: 'Pro' as const,
  remainingTries: 10,
  billingKey: 'encrypted_key_789',
  nextPaymentDate: '2025-11-25',
};

export const mockUserFromClerk = {
  id: 'user_clerk_789',
  email_addresses: [{ email_address: 'test@example.com' }],
  first_name: '홍',
  last_name: '길동',
  image_url: 'https://example.com/avatar.jpg',
};