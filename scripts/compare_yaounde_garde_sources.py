#!/usr/bin/env python3
"""Compare Facebook and Mfasha pharmacy-duty snapshots conservatively.

Each input is a UTF-8 CSV with the fields used by
 docs/yaounde-garde/2026-10-10_2026-10-12.csv. The two files must describe
 exactly the same duty interval. The script never marks a duty as confirmed:
 it emits review statuses and preserves both source records.
"""
import argparse
import csv
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

REQUIRED = {
    "city", "pharmacy_name", "location", "phone_primary",
    "phone_alternates", "duty_start_local", "duty_end_local",
    "primary_source",
}
OUTPUT_FIELDS = [
    "duty_start_local", "duty_end_local", "pharmacy_name",
    "facebook_name", "mfasha_name", "facebook_location", "mfasha_location",
    "facebook_phones", "mfasha_phones", "selected_location", "selected_phones",
    "facebook_source_url", "mfasha_source_url", "comparison_status",
    "publication_status", "notes",
]


def normalize(value):
    value = unicodedata.normalize("NFKD", (value or "").casefold())
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def phones(row):
    values = [row.get("phone_primary", ""), row.get("phone_alternates", "")]
    result = set()
    for value in values:
        for candidate in re.split(r"[;,/|]+", value or ""):
            digits = re.sub(r"\D", "", candidate)
            if digits:
                result.add(digits)
    return result


def parse_period(row, path, line):
    try:
        start = datetime.fromisoformat(row["duty_start_local"])
        end = datetime.fromisoformat(row["duty_end_local"])
    except (KeyError, ValueError) as exc:
        raise ValueError(f"{path}:{line}: invalid duty timestamp: {exc}") from exc
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ValueError(f"{path}:{line}: period must be timezone-aware and end after start")
    return start, end


def read_snapshot(path):
    path = Path(path)
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = REQUIRED - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path}: missing columns: {', '.join(sorted(missing))}")
        rows = []
        periods = set()
        for line, row in enumerate(reader, start=2):
            start, end = parse_period(row, path, line)
            periods.add((start.isoformat(), end.isoformat()))
            if not normalize(row.get("pharmacy_name")):
                raise ValueError(f"{path}:{line}: pharmacy_name is empty")
            if not (row.get("primary_source") or "").startswith("https://"):
                raise ValueError(f"{path}:{line}: primary_source must be an https URL")
            row["_start"] = start
            row["_end"] = end
            row["_key"] = normalize(row.get("pharmacy_name"))
            row["_phones"] = phones(row)
            rows.append(row)
    if not rows:
        raise ValueError(f"{path}: no pharmacy rows")
    if len(periods) != 1:
        raise ValueError(f"{path}: contains multiple duty periods; split snapshots by exact period")
    keys = [row["_key"] for row in rows]
    if len(keys) != len(set(keys)):
        raise ValueError(f"{path}: duplicate normalized pharmacy names")
    return rows, next(iter(periods))


def source_url(row):
    return row.get("primary_source", "").strip()


def compare(facebook_rows, mfasha_rows):
    facebook = {row["_key"]: row for row in facebook_rows}
    mfasha = {row["_key"]: row for row in mfasha_rows}
    results = []
    for key in sorted(set(facebook) | set(mfasha)):
        fb = facebook.get(key)
        mf = mfasha.get(key)
        reference = fb or mf
        fb_phones = fb["_phones"] if fb else set()
        mf_phones = mf["_phones"] if mf else set()
        shared_phones = fb_phones & mf_phones
        fb_location = (fb.get("location") or "").strip() if fb else ""
        mf_location = (mf.get("location") or "").strip() if mf else ""
        location_conflict = bool(
            fb_location and mf_location and normalize(fb_location) != normalize(mf_location)
        )
        phone_conflict = bool(fb_phones and mf_phones and not shared_phones)
        if not fb or not mf:
            status = "single_source_only"
            publication = "source_secondaire_non_confirmee"
            notes = "Pharmacie présente dans une seule source pour cette période."
        elif phone_conflict or location_conflict:
            status = "identity_conflict"
            publication = "a_verifier_ne_pas_publier"
            conflicts = []
            if phone_conflict:
                conflicts.append("téléphones différents sans numéro commun")
            if location_conflict:
                conflicts.append("localisations différentes")
            notes = "; ".join(conflicts)
        elif shared_phones:
            status = "cross_match_name_and_phone"
            publication = "corroboration_partielle_a_verifier"
            notes = "Nom et au moins un téléphone concordent; confirmer la garde avant publication."
        else:
            status = "name_only_match"
            publication = "a_verifier_ne_pas_publier"
            notes = "Nom concordant, mais aucun téléphone commun pour corroborer l'identité."
        selected_location = ""
        selected_phones = set()
        if fb and mf:
            # Prefer the fuller location only when normalized locations do not conflict.
            if not location_conflict:
                selected_location = max([fb_location, mf_location], key=len)
            if not phone_conflict:
                selected_phones = fb_phones | mf_phones
        else:
            selected_location = fb_location or mf_location
            selected_phones = fb_phones or mf_phones
        results.append({
            "duty_start_local": reference["_start"].isoformat(),
            "duty_end_local": reference["_end"].isoformat(),
            "pharmacy_name": (mf or fb).get("pharmacy_name", ""),
            "facebook_name": fb.get("pharmacy_name", "") if fb else "",
            "mfasha_name": mf.get("pharmacy_name", "") if mf else "",
            "facebook_location": fb_location,
            "mfasha_location": mf_location,
            "facebook_phones": "; ".join(sorted(fb_phones)),
            "mfasha_phones": "; ".join(sorted(mf_phones)),
            "selected_location": selected_location,
            "selected_phones": "; ".join(sorted(selected_phones)),
            "facebook_source_url": source_url(fb) if fb else "",
            "mfasha_source_url": source_url(mf) if mf else "",
            "comparison_status": status,
            "publication_status": publication,
            "notes": notes,
        })
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--facebook", required=True, help="CSV snapshot from Facebook")
    parser.add_argument("--mfasha", required=True, help="CSV snapshot from Mfasha")
    parser.add_argument("--output", required=True, help="Output comparison CSV path")
    args = parser.parse_args()
    try:
        facebook_rows, facebook_period = read_snapshot(args.facebook)
        mfasha_rows, mfasha_period = read_snapshot(args.mfasha)
        if facebook_period != mfasha_period:
            raise ValueError(
                "source periods differ; refusing to merge: "
                f"Facebook={facebook_period}, Mfasha={mfasha_period}"
            )
        results = compare(facebook_rows, mfasha_rows)
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
            writer.writeheader()
            writer.writerows(results)
        counts = {}
        for row in results:
            counts[row["publication_status"]] = counts.get(row["publication_status"], 0) + 1
        print(json.dumps({
            "result": "PASS",
            "period_start": facebook_period[0],
            "period_end": facebook_period[1],
            "facebook_rows": len(facebook_rows),
            "mfasha_rows": len(mfasha_rows),
            "comparison_rows": len(results),
            "publication_status_counts": counts,
            "output": str(output),
            "note": "No row is automatically marked confirmed.",
        }, ensure_ascii=False, indent=2))
    except (OSError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
