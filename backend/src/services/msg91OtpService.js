import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const FLOW_URL = 'https://control.msg91.com/api/v5/flow';

export function isMsg91OtpConfigured() {
  return Boolean(env.MSG91_AUTHKEY && env.MSG91_SMS_TEMPLATE_ID);
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

export async function sendMsg91Otp(phone, otp) {
  if (!isMsg91OtpConfigured()) throw new HttpError(500, 'MSG91 SMS is not configured');
  const mobile = toMsg91Mobile(phone);
  const templateId = env.MSG91_SMS_TEMPLATE_ID;
  const validity = String(env.MSG91_OTP_VALIDITY_MINUTES);

  if (env.NODE_ENV !== 'production') {
    console.log('MSG91 SMS request', { templateId, mobile, validity });
  }

  const response = await fetch(FLOW_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authkey: env.MSG91_AUTHKEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      short_url: '0',
      recipients: [{ mobiles: mobile, OTP: otp, Validity: validity }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !isSuccessResponse(data)) {
    console.error('MSG91 SMS failed', {
      status: response.status,
      templateId,
      mobile,
      response: data,
    });
    throw new HttpError(response.ok ? 502 : response.status, data?.message || 'MSG91 failed to send SMS');
  }
  return data;
}

export async function verifyMsg91Otp(phone, otp) {
  if (!isMsg91OtpConfigured()) throw new HttpError(500, 'MSG91 OTP is not configured');
  const mobile = toMsg91Mobile(phone);
  const url = new URL('https://control.msg91.com/api/v5/otp/verify');
  url.searchParams.set('otp', otp);
  url.searchParams.set('mobile', mobile);

  const response = await fetch(url, { headers: { authkey: env.MSG91_AUTHKEY } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !isSuccessResponse(data)) {
    throw new HttpError(response.ok ? 401 : response.status, data?.message || 'Incorrect OTP');
  }
  return data;
}
