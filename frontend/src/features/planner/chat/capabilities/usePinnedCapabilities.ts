import { useCallback, useMemo, useState } from 'react';
import { capabilityKey, type CapabilityData } from './CapabilityCards';

/**
 * Session-scoped pin state for Conversation Capabilities (docs/conversation-
 * capability-layer.md §2.5). Deliberately client-only for this first pass —
 * a monitored price / weather check / trip-so-far card stays visible for the
 * rest of this browsing session without needing a backend field. The pattern
 * generalizes to server-persisted pins later if that turns out to matter.
 */
export function usePinnedCapabilities() {
  const [pinned, setPinned] = useState<CapabilityData[]>([]);

  const pinnedKeys = useMemo(() => new Set(pinned.map(capabilityKey)), [pinned]);

  const togglePin = useCallback((capability: CapabilityData) => {
    const key = capabilityKey(capability);
    setPinned(prev => {
      if (prev.some(c => capabilityKey(c) === key)) {
        return prev.filter(c => capabilityKey(c) !== key);
      }
      return [...prev, capability];
    });
  }, []);

  const unpin = useCallback((capability: CapabilityData) => {
    const key = capabilityKey(capability);
    setPinned(prev => prev.filter(c => capabilityKey(c) !== key));
  }, []);

  return { pinned, pinnedKeys, togglePin, unpin };
}
