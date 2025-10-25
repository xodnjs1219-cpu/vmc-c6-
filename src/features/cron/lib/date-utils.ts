import { addMonths, isValid } from 'date-fns';

const KST_OFFSET = 9; // UTC+9

export function addOneMonth(date: Date | string): Date {
  const targetDate = typeof date === 'string' ? new Date(date) : date;

  if (!isValid(targetDate)) {
    throw new Error(`Invalid date: ${date}`);
  }

  const nextMonth = addMonths(targetDate, 1);
  return nextMonth;
}

export function getKSTToday(): Date {
  const now = new Date();

  // Convert to KST by adjusting UTC time
  const kstTime = new Date(now.getTime() + (KST_OFFSET - now.getTimezoneOffset() / 60) * 60 * 60 * 1000);

  // Set to start of day (in KST)
  kstTime.setHours(0, 0, 0, 0);
  return kstTime;
}

export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateOrderId(userId: string, nextPaymentDate: Date | string): string {
  const dateStr = typeof nextPaymentDate === 'string' ? nextPaymentDate : formatDateToYYYYMMDD(nextPaymentDate);
  return `subscription_${userId}_${dateStr}`;
}
