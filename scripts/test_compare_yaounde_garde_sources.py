import csv
import tempfile
import unittest
from pathlib import Path

from scripts.compare_yaounde_garde_sources import compare, read_snapshot


FIELDS = [
    "capture_date", "city", "pharmacy_name", "zone", "location",
    "phone_primary", "phone_alternates", "duty_start_local", "duty_end_local",
    "primary_source", "secondary_source", "identity_contact_crosscheck",
    "duty_crosscheck", "discrepancy", "publication_status",
]
START = "2026-10-10T08:00:00+01:00"
END = "2026-10-12T08:00:00+01:00"


def row(name, phone, location="MARCHÉ CENTRAL", source="https://example.org/source"):
    return {
        "capture_date": "2026-10-11",
        "city": "Yaoundé",
        "pharmacy_name": name,
        "zone": "1",
        "location": location,
        "phone_primary": phone,
        "phone_alternates": "",
        "duty_start_local": START,
        "duty_end_local": END,
        "primary_source": source,
        "secondary_source": "",
        "identity_contact_crosscheck": "",
        "duty_crosscheck": "Non: test fixture",
        "discrepancy": "",
        "publication_status": "source_secondaire_non_confirmee",
    }


class CompareYaoundeGardeTests(unittest.TestCase):
    def write_csv(self, directory, filename, rows):
        path = Path(directory) / filename
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        return path

    def test_matching_name_and_phone_is_only_partially_corroborated(self):
        with tempfile.TemporaryDirectory() as directory:
            fb = self.write_csv(directory, "facebook.csv", [row("Pharmacie Étoile", "699 11 22 33", source="https://facebook.com/post")])
            mf = self.write_csv(directory, "mfasha.csv", [row("Etoile", "699 11 22 33", source="https://mfasha.com/")])
            fb_rows, fb_period = read_snapshot(fb)
            mf_rows, mf_period = read_snapshot(mf)
            self.assertEqual(fb_period, mf_period)
            result = compare(fb_rows, mf_rows)[0]
            self.assertEqual(result["comparison_status"], "cross_match_name_and_phone")
            self.assertEqual(result["publication_status"], "corroboration_partielle_a_verifier")

    def test_unique_shared_phone_matches_name_variant(self):
        with tempfile.TemporaryDirectory() as directory:
            fb = self.write_csv(directory, "facebook.csv", [row("Pharmacie Etoile", "699 11 22 33", source="https://facebook.com/post")])
            mf = self.write_csv(directory, "mfasha.csv", [row("Etoile", "699 11 22 33", source="https://mfasha.com/")])
            fb_rows, _ = read_snapshot(fb)
            mf_rows, _ = read_snapshot(mf)
            result = compare(fb_rows, mf_rows)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]["comparison_status"], "cross_match_name_and_phone")

    def test_conflicting_phones_are_not_silently_merged(self):
        with tempfile.TemporaryDirectory() as directory:
            fb = self.write_csv(directory, "facebook.csv", [row("Pharmacie Étoile", "699 11 22 33", source="https://facebook.com/post")])
            mf = self.write_csv(directory, "mfasha.csv", [row("Pharmacie Étoile", "677 44 55 66", source="https://mfasha.com/")])
            fb_rows, _ = read_snapshot(fb)
            mf_rows, _ = read_snapshot(mf)
            result = compare(fb_rows, mf_rows)[0]
            self.assertEqual(result["comparison_status"], "identity_conflict")
            self.assertEqual(result["selected_phones"], "")

    def test_single_source_record_is_not_publishable_as_confirmed(self):
        with tempfile.TemporaryDirectory() as directory:
            fb = self.write_csv(directory, "facebook.csv", [row("Pharmacie Étoile", "699 11 22 33")])
            fb_rows, _ = read_snapshot(fb)
            result = compare(fb_rows, [])[0]
            self.assertEqual(result["comparison_status"], "single_source_only")
            self.assertEqual(result["publication_status"], "source_secondaire_non_confirmee")

    def test_periods_must_be_timezone_aware_and_coherent(self):
        with tempfile.TemporaryDirectory() as directory:
            bad = row("Pharmacie Étoile", "699 11 22 33")
            bad["duty_start_local"] = "2026-10-10T08:00:00"
            path = self.write_csv(directory, "bad.csv", [bad])
            with self.assertRaisesRegex(ValueError, "timezone-aware"):
                read_snapshot(path)


if __name__ == "__main__":
    unittest.main()
