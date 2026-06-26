import { useCallback } from 'react';

export function useExample() {
  return useCallback(() => {
    return true;
  }, []);
}
