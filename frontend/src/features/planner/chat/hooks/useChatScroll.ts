import { useEffect, useRef } from 'react';

export function useChatScroll(dependencies: any[]) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, dependencies);

  return bottomRef;
}
