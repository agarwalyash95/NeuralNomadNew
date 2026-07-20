import React from 'react';
import { Pin } from 'lucide-react';
import { CapabilityRenderer, capabilityKey, type CapabilityData } from './CapabilityCards';

/**
 * A persistent, horizontally-scrollable strip of pinned capability cards —
 * the "stays visible across turns" half of pinning (docs/conversation-
 * capability-layer.md §2.5). Renders nothing when there's nothing pinned.
 */
export function PinnedRail({
  pinned,
  onTogglePin,
}: {
  pinned: CapabilityData[];
  onTogglePin: (capability: CapabilityData) => void;
}) {
  if (pinned.length === 0) return null;
  const pinnedKeys = new Set(pinned.map(capabilityKey));

  return (
    <div className="no-scrollbar flex w-full max-w-3xl items-start gap-2 overflow-x-auto px-1 pb-1">
      <div className="mt-2 flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
        <Pin size={11} />
        Pinned
      </div>
      <div className="flex flex-1 flex-wrap gap-2">
        {pinned.map((capability, idx) => (
          <div key={`${capabilityKey(capability)}-${idx}`} className="min-w-[220px] max-w-xs flex-1">
            <CapabilityRenderer capabilities={[capability]} pinnedKeys={pinnedKeys} onTogglePin={onTogglePin} />
          </div>
        ))}
      </div>
    </div>
  );
}
