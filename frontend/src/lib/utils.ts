/**
 * Utility functions
 */

import type { KeyboardEvent } from 'react';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Props to make a `<div>` keyboard-operable as a button, for cards that
 * wrap other real buttons (a real `<button>` can't nest interactive
 * children, so the div+role="button" pattern is the valid alternative).
 * Spread onto the element alongside its existing onClick.
 */
export function clickableDivProps(onClick?: () => void) {
  if (!onClick) return {};
  return {
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
  };
}

/** Focus-visible ring, consistent across every clickable card/div in the planner. */
export const FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Adds `days` to an ISO 'YYYY-MM-DD' date string, returning another ISO
 * date string. Returns null for anything that isn't a real ISO date (e.g.
 * the 'Day N' fallback label used when a trip has no dates yet) — callers
 * should fall back to whatever original value they had rather than show a
 * fabricated date.
 */
export function addDaysToISO(isoDate: string | undefined, days: number): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}
