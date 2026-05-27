"""Regenerate the stored HTML + PDF exports for sent issues.

The archive serves the files written at mark_sent time. After a template or
renderer change, run this to re-render those artifacts in place so the archive
matches the current design. Pass an issue id or slug (e.g. ``issue-001``) to
target one issue, or no argument to regenerate all sent issues.

    python scripts/regenerate_issue_exports.py            # all issues
    python scripts/regenerate_issue_exports.py issue-001  # one issue (by slug or id)
"""

from __future__ import annotations

import asyncio
import sys

from app.services.newsletter.composer import composer_service


async def _regenerate(target: str | None) -> None:
    issues = await composer_service.list_issues()
    if target:
        issues = [i for i in issues if target in (i.slug, i.id)]
        if not issues:
            print(f"No sent issue matching '{target}'.")
            return
    for issue in issues:
        pdf_rel, html_rel = await composer_service._generate_exports(issue)
        print(f"regenerated {issue.slug}: {html_rel} · {pdf_rel}")
    print(f"\nDone — {len(issues)} issue(s).")


def main() -> None:
    target = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(_regenerate(target))


if __name__ == "__main__":
    main()
