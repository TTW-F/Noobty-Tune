import argparse
import json
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LINK_PATTERN = re.compile(r"\]\(([^)]+)\)")


def normalize_path(path: Path) -> str:
    return str(path).replace("\\", "/")


def extract_links(text: str) -> list[str]:
    links: list[str] = []
    for raw in LINK_PATTERN.findall(text):
        link = raw.strip()
        if (
            not link
            or link.startswith("#")
            or link.startswith("http://")
            or link.startswith("https://")
            or link.startswith("mailto:")
        ):
            continue
        links.append(link)
    return links


def should_exclude(path: Path, exclude_parts: list[str]) -> bool:
    return any(part in path.parts for part in exclude_parts)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate markdown link index for docs."
    )
    parser.add_argument(
        "--docs-dir",
        default="docs",
        help="Directory to scan for markdown files, relative to repo root.",
    )
    parser.add_argument(
        "--output",
        default="docs/_meta/link-index.json",
        help="Output JSON file path, relative to repo root.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=["_backup"],
        help="Path part to exclude (can be provided multiple times).",
    )
    args = parser.parse_args()

    docs_dir = (ROOT / args.docs_dir).resolve()
    output_file = (ROOT / args.output).resolve()
    exclude_parts = args.exclude

    docs = sorted(
        [
            p
            for p in docs_dir.rglob("*.md")
            if not should_exclude(p, exclude_parts)
        ]
    )

    docs_rel = [normalize_path(p.relative_to(ROOT)) for p in docs]
    incoming_count = {d: 0 for d in docs_rel}

    records = []
    for doc in docs:
        content = doc.read_text(encoding="utf-8")
        links = extract_links(content)

        resolved_links: list[str] = []
        for link in links:
            target = (doc.parent / link.split("#")[0]).resolve()
            if target.exists():
                target_rel = normalize_path(target.relative_to(ROOT))
                resolved_links.append(link)
                if target_rel in incoming_count:
                    incoming_count[target_rel] += 1

        records.append(
            {
                "path": normalize_path(doc.relative_to(ROOT)),
                "status": "ok",
                "outgoing_links": resolved_links,
                "incoming_count": 0,
                "last_checked_at": str(date.today()),
            }
        )

    for r in records:
        r["incoming_count"] = incoming_count.get(r["path"], 0)

    payload = {
        "generated_at": str(date.today()),
        "scope": f"{args.docs_dir}/**/*.md (exclude parts: {exclude_parts})",
        "documents": records,
    }

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated: {output_file}")
    print(f"Documents indexed: {len(records)}")


if __name__ == "__main__":
    main()
