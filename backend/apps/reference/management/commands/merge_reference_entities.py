"""Phase 3 human-gated duplicate-city merge (master plan §7.3/§12.2 mechanism).

Never invoked automatically. Takes two explicit City primary keys; without
``--confirm`` it only previews what would be re-pointed. With ``--confirm``
it re-points every FK across every installed app that references the losing
row (via Django's own reverse-relation introspection — no per-app FK list to
maintain by hand), aliases the losing name onto the keeper, records a
resolved ``DataQualityIssue``, and deletes the losing row. The **older**
(lower-PK) row should normally be ``--keep``, per the master plan's "preserve
the older PK" rule — this command does not choose that for the operator; it
trusts the explicit ``--keep``/``--merge`` arguments.
"""

import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.reference.models import City, CityAlias
from apps.reference.services.reconciliation import flag_data_quality_issue
from apps.reference.utils import normalize_search_name


def _reverse_fk_fields(instance):
    return [
        rel for rel in instance._meta.related_objects
        if rel.one_to_many or rel.many_to_many
    ]


def _related_counts(instance):
    counts = {}
    for rel in _reverse_fk_fields(instance):
        accessor = rel.get_accessor_name()
        manager = getattr(instance, accessor, None)
        if manager is None:
            continue
        try:
            count = manager.count()
        except Exception:
            continue
        if count:
            counts[f"{rel.related_model._meta.label}.{rel.field.name}"] = count
    return counts


def _repoint(losing, keeper):
    counts = {}
    for rel in _reverse_fk_fields(losing):
        accessor = rel.get_accessor_name()
        manager = getattr(losing, accessor, None)
        if manager is None:
            continue
        field_name = rel.field.name
        updated = manager.update(**{field_name: keeper})
        if updated:
            counts[f"{rel.related_model._meta.label}.{field_name}"] = updated
    return counts


class Command(BaseCommand):
    help = "Human-gated merge of two duplicate City rows. Preview by default; --confirm to apply."

    def add_arguments(self, parser):
        parser.add_argument("--keep-pk", type=int, required=True)
        parser.add_argument("--merge-pk", type=int, required=True)
        parser.add_argument("--confirm", action="store_true")
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        keep_pk, merge_pk = options["keep_pk"], options["merge_pk"]
        if keep_pk == merge_pk:
            raise CommandError("--keep-pk and --merge-pk must be different.")
        try:
            keeper = City.objects.get(pk=keep_pk)
            losing = City.objects.get(pk=merge_pk)
        except City.DoesNotExist as exc:
            raise CommandError(str(exc))

        if not options["confirm"]:
            preview = {
                "mode": "preview",
                "keep": {"pk": keeper.pk, "name": keeper.name},
                "merge": {"pk": losing.pk, "name": losing.name},
                "would_repoint": _related_counts(losing),
                "note": "Re-run with --confirm to apply. Nothing was changed.",
            }
            self._emit(preview, options["json"])
            return

        with transaction.atomic():
            repointed = _repoint(losing, keeper)
            if not CityAlias.objects.filter(
                city=keeper, normalized_alias=normalize_search_name(losing.name)
            ).exists():
                CityAlias.objects.create(
                    city=keeper, alias_name=losing.name, alias_type="old",
                    source="merge_reference_entities", verification_status="verified",
                    verified_at=timezone.now(),
                )
            flag_data_quality_issue(
                keeper, "duplicate_candidate",
                details={"merged_from_pk": losing.pk, "merged_from_name": losing.name, "repointed": repointed},
            )
            from apps.reference.models import DataQualityIssue
            DataQualityIssue.objects.filter(
                content_type__model="city", object_id=str(keeper.pk),
                issue_type="duplicate_candidate", status="open",
            ).update(status="resolved", resolved_at=timezone.now())
            losing.delete()

        self._emit({"mode": "applied", "kept": keeper.pk, "merged_deleted": merge_pk, "repointed": repointed}, options["json"])

    def _emit(self, payload, as_json):
        text = json.dumps(payload, indent=2, sort_keys=True)
        if as_json:
            self.stdout.write(text)
        else:
            self.stdout.write(self.style.SUCCESS(text))
