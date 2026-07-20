"""Phase 9 (§14 P9) — cross-job aggregation of PlanGenerationJob.usage.

The `usage` field already exists (Phase 0h) and already tracks real per-job
`ai_calls`/`provider_calls`/`tokens`/wall-time via `UsageBudget.to_dict()`
under the "ceilings" key; nothing here adds new instrumentation, it reads
what already gets written and was never aggregated across jobs before this
command. Planner-owned (not reference-owned) since `PlanGenerationJob` is a
planner model — `apps.reference`'s dashboard command calls this via
`call_command`, never importing `apps.planner` directly (D-004).
"""

import json

from django.core.management.base import BaseCommand

from apps.planner.models import PlanGenerationJob


class Command(BaseCommand):
    help = "Aggregate PlanGenerationJob.usage across recent jobs (external calls/plan, tokens, wall-time)."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")
        parser.add_argument("--sample-size", type=int, default=50)

    def handle(self, *args, **options):
        sample_size = options["sample_size"]
        jobs = list(
            PlanGenerationJob.objects.exclude(usage={})
            .order_by("-id")
            .values_list("usage", flat=True)[:sample_size]
        )
        ai_calls, provider_calls, total_tokens, wall_times = [], [], [], []
        jobs_with_ceilings = 0
        for usage in jobs:
            ceilings = (usage or {}).get("ceilings")
            if not ceilings:
                continue
            jobs_with_ceilings += 1
            if isinstance(ceilings.get("ai_calls"), (int, float)):
                ai_calls.append(ceilings["ai_calls"])
            if isinstance(ceilings.get("provider_calls"), (int, float)):
                provider_calls.append(ceilings["provider_calls"])
            tokens = ceilings.get("tokens")
            if isinstance(tokens, (int, float)):
                total_tokens.append(tokens)
            limits = ceilings.get("limits") or {}
            wall = limits.get("wall_time_seconds")
            if isinstance(wall, (int, float)):
                wall_times.append(wall)

        def _avg(values):
            return round(sum(values) / len(values), 2) if values else None

        result = {
            "jobs_sampled": len(jobs),
            "jobs_with_usage_ceilings": jobs_with_ceilings,
            "avg_ai_calls_per_plan": _avg(ai_calls),
            "avg_provider_calls_per_plan": _avg(provider_calls),
            "avg_tokens_per_plan": _avg(total_tokens),
            "avg_wall_time_seconds": _avg(wall_times),
            "note": (
                "jobs_with_usage_ceilings may be well below jobs_sampled — the "
                "'ceilings' sub-key was added after some earlier jobs ran "
                "(same gap phase-00's baseline.json already recorded); this is "
                "an honest count, not every historical job carries it."
            ),
        }

        if options["json"]:
            self.stdout.write(json.dumps(result, indent=2, sort_keys=True))
        else:
            self.stdout.write(json.dumps(result, indent=2))
