"""
Episodic trip memory (M2 'compounding personal memory', Phase 4 —
docs/planner-north-star-audit-and-vision.md §4's own example: "last Goa
trip you loved the north beaches, skipped nightlife").

A deterministic, per-destination memory of what a traveler actually kept
vs. actually removed on their most recent trip there — built entirely from
real block titles already present in the AI's original proposal
(PlannerTripOriginal) and the traveler's edited plan, the same
original/current snapshot diff_engine already diffs for edit signals.
Never an LLM-authored narrative, never invented: only real titles that
existed in the plan are ever named. Stored as one TravelerProfile fact per
destination (most-recent-visit memory, not an unbounded log — a later trip
to the same place overwrites the prior episode).
"""

EPISODE_FACT_PREFIX = "episode."
_MAX_NAMES_PER_LIST = 5


def _destination_key(destination_text):
    return (destination_text or "").strip().lower()


def record_trip_episode(profile, destination_text, original_days, current_days, source_trip=None):
    """Best-effort; never raises — called alongside diff_engine/
    preference_learner from the same best-effort edit-learning call site."""
    try:
        dest_key = _destination_key(destination_text)
        if not dest_key:
            return
        current_refs = set()
        for day in current_days or []:
            for block in day.get("activities") or []:
                ref = (block.get("metadata") or {}).get("master_ref")
                if ref and ref.get("id") is not None:
                    current_refs.add((ref.get("table"), str(ref.get("id"))))

        kept, removed = [], []
        for day in original_days or []:
            for block in day.get("activities") or []:
                ref = (block.get("metadata") or {}).get("master_ref")
                title = block.get("title")
                if not ref or ref.get("id") is None or not title:
                    continue
                key = (ref.get("table"), str(ref.get("id")))
                (kept if key in current_refs else removed).append(title)

        if not kept and not removed:
            return

        profile.upsert_fact(
            f"{EPISODE_FACT_PREFIX}{dest_key}",
            {
                "destination": destination_text,
                "kept": kept[:_MAX_NAMES_PER_LIST],
                "removed": removed[:_MAX_NAMES_PER_LIST],
            },
            provenance="inferred",
            source_trip=source_trip,
        )
    except Exception:
        import logging

        logging.getLogger(__name__).warning("Episodic memory write failed (non-fatal)", exc_info=True)


def episode_summary_line(profile_facts, destination_text):
    """A grounded, real-names-only sentence for the compose prompt, or ''
    when there's no episode for this destination yet."""
    dest_key = _destination_key(destination_text)
    if not dest_key:
        return ""
    episode = (profile_facts or {}).get(f"{EPISODE_FACT_PREFIX}{dest_key}")
    if not isinstance(episode, dict):
        return ""
    kept, removed = episode.get("kept") or [], episode.get("removed") or []
    if not kept and not removed:
        return ""
    parts = [f"Traveler has been to {episode.get('destination') or destination_text} before."]
    if kept:
        parts.append(f"Loved/kept: {', '.join(kept)}.")
    if removed:
        parts.append(f"Skipped/removed: {', '.join(removed)}.")
    parts.append(
        "Weight new candidates similarly — favor what they kept, avoid repeating what they skipped, "
        "unless a fresh preference in this conversation contradicts it."
    )
    return " ".join(parts)
