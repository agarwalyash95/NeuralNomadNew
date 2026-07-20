"""Application-neutral provenance vocabulary shared across backend layers."""

from datetime import datetime, timezone

TIER_VERIFIED = "verified"
TIER_ESTIMATED = "estimated"
TIER_SUGGESTED = "suggested"


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def make_provenance(tier, source="", basis="", verified_at=None):
    provenance = {"tier": tier, "source": source, "basis": basis}
    if tier == TIER_VERIFIED:
        provenance["verified_at"] = verified_at or _now_iso()
    return provenance
