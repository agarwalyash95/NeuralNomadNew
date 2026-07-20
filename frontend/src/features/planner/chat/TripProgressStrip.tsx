import React from 'react';
import { CapabilityRenderer, type CapabilityData } from './capabilities/CapabilityCards';

/**
 * A single, persistent "Your trip so far" snapshot — rendered ONCE, left-
 * aligned, above the message list, and updated in place as the draft
 * progresses. Replaces the old behavior where the backend's trip_progress
 * capability re-rendered as a brand-new inline card on every cluster/slot
 * turn, making it look like it kept "coming back" throughout the chat.
 */
export function TripProgressStrip({ tripProgress }: { tripProgress: CapabilityData | null }) {
  if (!tripProgress) return null;
  return (
    <div className="mb-1 flex w-full max-w-3xl justify-start px-1">
      <div className="w-full max-w-sm">
        <CapabilityRenderer capabilities={[tripProgress]} />
      </div>
    </div>
  );
}
