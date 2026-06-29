import { isValidElement } from 'react';

export const safe = (val: any): any => {
  if (val === null || val === undefined) return '';
  if (isValidElement(val)) return val;
  if (Array.isArray(val)) return val.map(safe);
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return '[Complex Object]';
    }
  }
  return String(val);
};
