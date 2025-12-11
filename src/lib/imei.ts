const MIN_IMEI_LENGTH = 14;
const MAX_IMEI_LENGTH = 17;

export const sanitizeImei = (value: string): string =>
  value.replace(/\D/g, "");

export const passesLuhn = (imei: string): boolean => {
  if (!/^\d+$/.test(imei)) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = imei.length - 1; i >= 0; i -= 1) {
    let digit = Number(imei[i]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

export const isValidImei = (imei: string): boolean => {
  if (!imei) return false;
  if (imei.length < MIN_IMEI_LENGTH || imei.length > MAX_IMEI_LENGTH) {
    return false;
  }

  return /^\d+$/.test(imei) && passesLuhn(imei);
};

