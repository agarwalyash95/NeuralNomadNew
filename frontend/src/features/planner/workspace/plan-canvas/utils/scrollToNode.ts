/**
 * scrollToNode — the shared "show me where that is" primitive used by the
 * Trip Status Spine's attention/to-book rollups and the Day Brief panel.
 * Scrolls the timeline to the day containing the item (always present) and,
 * if the item itself is rendered (NodeWrapper stamps `id="node-<itemId>"`),
 * scrolls tighter to it and gives it a brief highlight pulse so the user
 * never has to re-locate it themselves.
 */
export function scrollToNode(itemId: string | undefined, dayNumber?: number | null) {
  const nodeEl = itemId ? document.getElementById(`node-${itemId}`) : null;
  const target = nodeEl ?? (dayNumber != null ? document.getElementById(`day-${dayNumber}`) : null);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (nodeEl) {
    nodeEl.classList.add('highlight-pulse');
    setTimeout(() => nodeEl.classList.remove('highlight-pulse'), 1600);
  }
}
