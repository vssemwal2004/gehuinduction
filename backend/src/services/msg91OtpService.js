import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const BASE_URL = 'https://control.msg91.com/api/v5/otp';

export function isMsg91OtpConfigured() {
  return Boolean(env.MSG91_AUTHKEY && env.MSG91_OTP_TEMPLATE_ID);
}

export function toMsg91Mobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `${env.MSG91_DEFAULT_COUNTRY_CODE}${digits}`;
  return digits;
}

function isSuccessResponse(data) {
  return data?.type === 'success' || /success|sent|verified/i.test(String(data?.message || ''));
}

export async function sendMsg91Otp(phone) {
  if (!isMsg91OtpConfigured()) throw new HttpError(500, 'MSG91 OTP is not configured');
  const mobile = toMsg91Mobile(phone);
  const url = new URL(BASE_URL);
  url.searchParams.set('template_id', env.MSG91_OTP_TEMPLATE_ID);
  url.searchParams.set('mobile', mobile);
  url.searchParams.set('authkey', env.MSG91_AUTHKEY);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !isSuccessResponse(data)) {
    throw new HttpError(response.ok ? 502 : response.status, data?.message || 'MSG91 failed to send OTP');
  }
  return data;
}

export async function verifyMsg91Otp(phone, otp) {
  if (!isMsg91OtpConfigured()) throw new HttpError(500, 'MSG91 OTP is not configured');
  const mobile = toMsg91Mobile(phone);
  const url = new URL(`${BASE_URL}/verify`);
  url.searchParams.set('otp', otp);
  url.searchParams.set('mobile', mobile);

  const response = await fetch(url, { headers: { authkey: env.MSG91_AUTHKEY } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !isSuccessResponse(data)) {
    throw new HttpError(response.ok ? 401 : response.status, data?.message || 'Incorrect OTP');
  }
  return data;
}
