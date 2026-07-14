/**
 * Canonical token accessor for non-hook contexts (fetch interceptors, SSE
 * readers). Reads from the same Zustand persisted store useAuthStore reads,
 * so there is exactly one source of truth instead of a separate
 * localStorage.getItem('accessToken') key that can drift from the real
 * session state.
 *
 * The Zustand `persist` middleware (name: 'neuralnomad-auth') serialises the
 * entire store state under that key with a `{state, version}` wrapper.
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('neuralnomad-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { tokens?: { access?: string } } };
    return parsed?.state?.tokens?.access ?? null;
  } catch {
    return null;
  }
}
