#!/usr/bin/env python3
"""Validate the structure and conservative publication status of the Yaoundé duty dataset."""
import csv
import sys
from datetime import datetime
from pathlib import Path

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/yaounde-garde/2026-10-10_2026-10-12.csv")
expected_status = "source_secondaire_non_confirmee"
required = {
    "capture_date", "city", "pharmacy_name", "zone", "location",
    "phone_primary", "phone_alternates", "duty_start_local", "duty_end_local",
    "primary_source", "identity_contact_crosscheck", "duty_crosscheck",
    "publication_status",
}
with path.open(encoding="utf-8-sig", newline="") as handle:
    reader = csv.DictReader(handle)
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise SystemExit(f"FAIL missing columns: {sorted(missing)}")
    rows = list(reader)

if len(rows) != 19:
    raise SystemExit(f"FAIL expected 19 rows, got {len(rows)}")

seen = set()
for number, row in enumerate(rows, start=2):
    key = " ".join(row["pharmacy_name"].casefold().split())
    if key in seen:
        raise SystemExit(f"FAIL duplicate pharmacy name at CSV line {number}: {row['pharmacy_name']}")
    seen.add(key)
    if not row["phone_primary"].strip():
        raise SystemExit(f"FAIL missing primary phone at CSV line {number}")
    if not row["primary_source"].startswith("https://"):
        raise SystemExit(f"FAIL invalid primary source at CSV line {number}")
    start = datetime.fromisoformat(row["duty_start_local"])
    end = datetime.fromisoformat(row["duty_end_local"])
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise SystemExit(f"FAIL invalid duty period at CSV line {number}")
    if row["publication_status"] != expected_status:
        raise SystemExit(f"FAIL unsafe publication status at CSV line {number}")
    if not row["duty_crosscheck"].startswith("Non:"):
        raise SystemExit(f"FAIL row must remain unconfirmed at CSV line {number}")

print(f"PASS: {len(rows)} rows; unique names; required fields; timezone-aware coherent dates; all rows explicitly unconfirmed.")
