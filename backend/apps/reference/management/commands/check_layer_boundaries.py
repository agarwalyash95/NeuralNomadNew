"""Validate backend import direction without importing application modules."""

from __future__ import annotations

import ast
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


PLANNER_PREFIXES = ("apps.planner", "planner")
KNOWLEDGE_PREFIXES = ("apps.knowledge", "knowledge")

# Transitional debt approved by the Phase 1 plan. Both sites delegate to the
# single sanctioned writer documented in planner.services.geocoding.
PLANNER_ALLOWLIST = {
    "apps/reference/services/places_explore.py": {"apps.planner.services.geocoding"},
    "apps/reference/management/commands/backfill_city_coordinates.py": {
        "apps.planner.services.geocoding"
    },
}


def _imports(path):
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name, node.lineno
        elif isinstance(node, ast.ImportFrom) and node.module:
            yield node.module, node.lineno


def _matches(module, prefixes):
    return any(module == prefix or module.startswith(f"{prefix}.") for prefix in prefixes)


class Command(BaseCommand):
    help = "Check planner -> reference -> common dependency direction."

    def add_arguments(self, parser):
        parser.add_argument(
            "--strict-knowledge",
            action="store_true",
            help="Also reject apps.knowledge imports outside migration history (Phase 7+).",
        )
        parser.add_argument("--json", action="store_true", help="Emit machine-readable output.")

    def handle(self, *args, **options):
        backend_root = Path(settings.BASE_DIR)
        findings = []
        allowed = []

        for app_name in ("reference", "knowledge"):
            app_root = backend_root / "apps" / app_name
            for path in app_root.rglob("*.py"):
                relative = path.relative_to(backend_root).as_posix()
                if "migrations" in path.parts:
                    continue
                for module, line in _imports(path):
                    if not _matches(module, PLANNER_PREFIXES):
                        continue
                    record = {"path": relative, "line": line, "module": module}
                    if module in PLANNER_ALLOWLIST.get(relative, set()):
                        allowed.append(record)
                    else:
                        findings.append({**record, "rule": "reference_or_knowledge_imports_planner"})

        if options["strict_knowledge"]:
            for path in (backend_root / "apps").rglob("*.py"):
                relative = path.relative_to(backend_root).as_posix()
                if "migrations" in path.parts or relative.startswith("apps/knowledge/"):
                    continue
                for module, line in _imports(path):
                    if _matches(module, KNOWLEDGE_PREFIXES):
                        findings.append({
                            "path": relative,
                            "line": line,
                            "module": module,
                            "rule": "knowledge_import_after_phase_7",
                        })

        payload = {
            "status": "pass" if not findings else "fail",
            "violations": findings,
            "allowlisted": allowed,
            "strict_knowledge": bool(options["strict_knowledge"]),
        }
        if options["json"]:
            self.stdout.write(json.dumps(payload, indent=2))
        else:
            for record in allowed:
                self.stdout.write(
                    self.style.WARNING(
                        f"ALLOWLISTED {record['path']}:{record['line']} -> {record['module']}"
                    )
                )
            if findings:
                for record in findings:
                    self.stdout.write(
                        self.style.ERROR(
                            f"VIOLATION {record['path']}:{record['line']} -> "
                            f"{record['module']} ({record['rule']})"
                        )
                    )
            else:
                self.stdout.write(self.style.SUCCESS("Layer boundary check passed."))

        if findings:
            raise CommandError(f"Layer boundary check failed with {len(findings)} violation(s).")
