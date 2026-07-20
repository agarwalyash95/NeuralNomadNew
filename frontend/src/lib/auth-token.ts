/**
 * Single source of truth for reading the stored access token client-side.
 *
 * SEC-01 (docs/planner-complete-current-audit-and-repair-plan.md §19 R12):
 * the real login UI (components/auth/auth-modal.tsx) writes tokens only via
 * useAuthStore.getState().setTokens(...), which Zustand's persist middleware
 * stores under the 'neuralnomad-auth' localStorage key — never the legacy
 * 'accessToken' key. services/api.ts already reads 'neuralnomad-auth' first
 * (falling back to the legacy key) and works correctly; providers/auth-
 * provider.tsx's startup check read ONLY the legacy key, so a session
 * persisted solely under 'neuralnomad-auth' — the actual real-world case —
 * silently skipped the profile reload on page refresh. Extracted here so
 * both call sites resolve the token identically instead of drifting again.
 */
export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('neuralnomad-auth');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { tokens?: { access?: string } } };
      const token = parsed?.state?.tokens?.access;
      if (token) return token;
    }
  } catch {
    // fall through to the legacy key
  }
  return localStorage.getItem('accessToken');
}
