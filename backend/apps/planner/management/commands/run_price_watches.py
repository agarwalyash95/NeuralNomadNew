"""
The first standing agent task: re-check watched block prices and file
findings as PlanProposals. The watch NEVER mutates the plan — the user
accepts or rejects, same grammar as every other agent-initiated change.

Run daily (cron / scheduled task):  python manage.py run_price_watches
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.planner.models import PlanProposal, PriceWatch
from apps.planner.services.block_schema import find_block


class Command(BaseCommand):
    help = "Re-quote watched block prices; file drop findings as proposals."

    def handle(self, *args, **options):
        from apps.reference.services.live_price import lookup_live_price

        checked = 0
        filed = 0

        for watch in PriceWatch.objects.filter(active=True, is_deleted=False).select_related("workspace"):
            workspace = watch.workspace
            trip = getattr(workspace, "trip", None)
            if trip is None:
                continue

            block, day = find_block(trip, watch.block_id)
            if block is None:
                watch.active = False
                watch.save(update_fields=["active", "updated_at"])
                continue

            service_type = (block.get("category") or "").lower()
            if service_type == "taxi":
                service_type = "cab"
            date_str = (day or {}).get("date") or timezone.now().date().isoformat()

            result = lookup_live_price(
                service_type=service_type,
                date_str=date_str,
                provider=block.get("title", ""),
                origin="",
                destination=block.get("location_name", ""),
            )

            watch.last_checked_at = timezone.now()
            checked += 1

            if result is None:
                watch.save(update_fields=["last_checked_at", "updated_at"])
                continue

            new_price = result["exact_price"]
            current = (block.get("cost") or {}).get("amount")
            watch.last_price = new_price
            watch.save(update_fields=["last_checked_at", "last_price", "updated_at"])

            threshold = float(watch.threshold_amount) if watch.threshold_amount is not None else None
            dropped = current is not None and new_price < float(current)
            under_threshold = threshold is not None and new_price <= threshold

            if not (dropped or under_threshold):
                continue

            # Don't stack duplicate findings for the same block
            already_open = PlanProposal.objects.filter(
                workspace=workspace,
                kind=PlanProposal.KIND_PRICE_WATCH,
                status=PlanProposal.STATUS_OPEN,
                diff__deltas__block_id=str(watch.block_id),
            ).exists()
            if already_open:
                continue

            saved = float(current) - new_price if current is not None else 0.0
            PlanProposal.objects.create(
                workspace=workspace,
                kind=PlanProposal.KIND_PRICE_WATCH,
                title=f"Price drop: {block.get('title', 'watched item')}",
                rationale=(
                    f"You asked me to watch this price. It's now "
                    f"{result['price']} ({result['provenance']['tier']}, {result['provenance']['basis']})."
                ),
                diff={
                    "deltas": {"cost_delta": -saved if saved > 0 else 0, "block_id": str(watch.block_id)},
                    "price_result": result,
                },
                created_by="agent",
                base_trip_updated_at=trip.updated_at,
            )
            filed += 1

        self.stdout.write(self.style.SUCCESS(f"Checked {checked} watches, filed {filed} proposals."))
