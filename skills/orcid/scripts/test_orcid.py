import os
import tempfile
import unittest
from pathlib import Path

import orcid  # module under test (same dir)


class TestValidate(unittest.TestCase):
    def test_accepts_a_valid_orcid(self):
        self.assertTrue(orcid.is_valid("0000-0002-1825-0097"))

    def test_accepts_an_x_check_digit(self):
        self.assertTrue(orcid.is_valid("0000-0002-1694-233X"))

    def test_rejects_a_bad_checksum(self):
        self.assertFalse(orcid.is_valid("0000-0002-1825-0098"))

    def test_rejects_a_wrong_shape(self):
        self.assertFalse(orcid.is_valid("0000-0002-1825-009"))
        self.assertFalse(orcid.is_valid("not-an-orcid"))

    def test_accepts_a_full_orcid_url(self):
        self.assertTrue(orcid.is_valid("https://orcid.org/0000-0002-1825-0097"))

    def test_ignores_surrounding_whitespace(self):
        self.assertTrue(orcid.is_valid("  0000-0002-1825-0097  "))

    def test_normalizes_lowercase_x(self):
        self.assertTrue(orcid.is_valid("0000-0002-1694-233x"))


class TestConfigRoundTrip(unittest.TestCase):
    def _isolate(self, d):
        os.environ["WONDER_ORCID"] = str(Path(d) / "orcid")

    def test_set_then_get_roundtrips_the_normalized_id(self):
        with tempfile.TemporaryDirectory() as d:
            self._isolate(d)
            try:
                self.assertEqual(orcid.set_id("https://orcid.org/0000-0002-1825-0097"), 0)
                self.assertEqual(orcid.get_id(), "0000-0002-1825-0097")
                self.assertEqual(orcid.clear_id(), 0)
                self.assertEqual(orcid.get_id(), "")
            finally:
                os.environ.pop("WONDER_ORCID", None)

    def test_set_rejects_an_invalid_id_and_saves_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            self._isolate(d)
            try:
                self.assertNotEqual(orcid.set_id("0000-0002-1825-0098"), 0)
                self.assertEqual(orcid.get_id(), "")
            finally:
                os.environ.pop("WONDER_ORCID", None)


if __name__ == "__main__":
    unittest.main()
