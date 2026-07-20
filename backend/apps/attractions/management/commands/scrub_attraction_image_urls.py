from urllib.parse import parse_qs, quote, urlparse

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.attractions.models import Attraction


def _proxy_url(photo_ref):
    return f"/api/attractions/items/photo-proxy/?ref={quote(str(photo_ref), safe='')}"


def scrub_url(value):
    """Return (safe_value, changed) without ever retaining a key-bearing URL."""
    if not isinstance(value, str) or not value:
        return value, False
    if value.startswith("/api/attractions/items/photo-proxy/"):
        return value, False

    parsed = urlparse(value)
    query = parse_qs(parsed.query)
    photo_refs = query.get("photoreference") or query.get("photo_reference")
    if photo_refs and photo_refs[0]:
        safe_value = _proxy_url(photo_refs[0])
        return safe_value, safe_value != value

    if "key=" in value.lower() or "key%3d" in value.lower():
        return None, True
    return value, False


class Command(BaseCommand):
    help = "Scrub stored Google-key attraction photo URLs; dry-run is the default."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report changes without saving (default).")
        parser.add_argument("--apply", action="store_true", help="Persist the reviewed scrub changes.")

    def handle(self, *args, **options):
        if options["dry_run"] and options["apply"]:
            raise CommandError("Choose either --dry-run or --apply, not both.")

        apply_changes = bool(options["apply"])
        scanned = changed_rows = primary_changed = secondary_changed = removed_urls = 0

        with transaction.atomic():
            for attraction in Attraction.objects.all().iterator(chunk_size=500):
                scanned += 1
                update_fields = []

                safe_primary, primary_was_changed = scrub_url(attraction.image_url)
                if primary_was_changed:
                    primary_changed += 1
                    removed_urls += int(safe_primary is None)
                    attraction.image_url = safe_primary
                    update_fields.append("image_url")

                safe_secondary = []
                secondary_was_changed = False
                for value in attraction.secondary_images or []:
                    safe_value, was_changed = scrub_url(value)
                    secondary_was_changed = secondary_was_changed or was_changed
                    if was_changed:
                        secondary_changed += 1
                        removed_urls += int(safe_value is None)
                    if safe_value:
                        safe_secondary.append(safe_value)
                if secondary_was_changed:
                    attraction.secondary_images = safe_secondary
                    update_fields.append("secondary_images")

                if update_fields:
                    changed_rows += 1
                    if apply_changes:
                        attraction.save(update_fields=update_fields)

            if not apply_changes:
                transaction.set_rollback(True)

        mode = "APPLY" if apply_changes else "DRY RUN"
        self.stdout.write(f"Mode: {mode}")
        self.stdout.write(f"Rows scanned: {scanned}")
        self.stdout.write(f"Rows requiring changes: {changed_rows}")
        self.stdout.write(f"Primary URLs changed: {primary_changed}")
        self.stdout.write(f"Secondary URLs changed: {secondary_changed}")
        self.stdout.write(f"Unsafe URLs removed without recoverable photo reference: {removed_urls}")
