import '@testing-library/jest-dom';

// Mock server environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.CLERK_SECRET_KEY = 'test-clerk-secret';
process.env.CLERK_WEBHOOK_SIGNING_SECRET = 'test-webhook-secret';
process.env.TOSS_SECRET_KEY = 'test-toss-secret';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';
