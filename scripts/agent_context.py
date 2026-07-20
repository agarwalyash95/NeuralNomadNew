"""Print a read-only startup summary for any coding agent.

This changes no repository or Git configuration. ``safe.directory`` is passed
only to individual Git commands so it also works for sandboxed agent users.
"""

from __future__ import annotations

import subprocess
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATE_FILES = (
    ROOT / "docs" / "agent" / "CURRENT_STATE.md",
    ROOT / "docs" / "agent" / "HANDOFF.md",
)


def run_git(*args: str) -> tuple[int, str]:
    result = subprocess.run(
        ["git", "-c", f"safe.directory={ROOT.as_posix()}", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    output = result.stdout.strip()
    if result.stderr.strip() and not output:
        output = result.stderr.strip()
    return result.returncode, output


def print_git_summary() -> None:
    branch_code, branch = run_git("branch", "--show-current")
    commit_code, commit = run_git("log", "-1", "--date=short", "--pretty=%h %ad %s")
    status_code, status = run_git("status", "--short", "--untracked-files=all")

    print(f"Repository: {ROOT}")
    print(f"Branch: {branch if branch_code == 0 else 'unavailable'}")
    print(f"Commit: {commit if commit_code == 0 else 'unavailable'}")

    if status_code != 0:
        print(f"Working tree: unavailable ({status})")
        return

    lines = [line for line in status.splitlines() if line]
    if not lines:
        print("Working tree: clean")
        return

    states = Counter(line[:2] for line in lines)
    summary = ", ".join(f"{state!r}: {count}" for state, count in sorted(states.items()))
    print(f"Working tree: DIRTY — {len(lines)} entries ({summary})")
    print("First changed paths:")
    for line in lines[:20]:
        print(f"  {line}")
    if len(lines) > 20:
        print(f"  ... {len(lines) - 20} more; run `git status --short` for the full list")


def print_context_files() -> None:
    print("\nMandatory read order:")
    print("  1. AGENTS.md")
    print("  2. docs/agent/CURRENT_STATE.md")
    print("  3. docs/agent/HANDOFF.md")
    print("  4. Relevant records in docs/agent/DECISIONS.md")
    print("  5. Relevant code and its current diff")

    for path in STATE_FILES:
        print(f"\n{'=' * 78}\n{path.relative_to(ROOT)}\n{'=' * 78}")
        try:
            print(path.read_text(encoding="utf-8").rstrip())
        except OSError as exc:
            print(f"Unable to read: {exc}")


def main() -> None:
    print_git_summary()
    print_context_files()


if __name__ == "__main__":
    main()
