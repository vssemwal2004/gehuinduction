# GEU Induction Connect 2026

QR-based student verification and coordinator communication platform.

## Repositories

- `backend` — Express API, MongoDB models and authentication
- `frontend` — React/Vite/Tailwind application

Secrets are never committed. Copy `.env.example` to `.env` and use rotated local credentials.

Student OTP login sends SMS through MSG91 when these backend environment variables are set:

- `MSG91_AUTHKEY`
- `MSG91_SMS_TEMPLATE_ID` for an SMS/Flow/DLT template, or `MSG91_OTP_TEMPLATE_ID` as a fallback
- `MSG91_OTP_VALIDITY_MINUTES` defaults to `5`
- `MSG91_DEFAULT_COUNTRY_CODE` defaults to `91`
- `STUDENT_OTP_PHONE_HOLD_MINUTES` defaults to `5`
- `STUDENT_OTP_VERIFY_LIMIT` defaults to `5`
- `STUDENT_OTP_IP_LIMIT` defaults to `300`
- `STUDENT_OTP_IP_WINDOW_MINUTES` defaults to `15`
