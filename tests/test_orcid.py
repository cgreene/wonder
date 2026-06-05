"""Tests for the orcid skill's iD validation + local config."""

import subprocess
import sys

from conftest import script_path


class TestValidate:
    def test_accepts_a_valid_orcid(self, orcid):
        assert orcid.is_valid("0000-0002-1825-0097")

    def test_accepts_an_x_check_digit(self, orcid):
        assert orcid.is_valid("0000-0002-1694-233X")

    def test_rejects_a_bad_checksum(self, orcid):
        assert not orcid.is_valid("0000-0002-1825-0098")

    def test_rejects_a_wrong_shape(self, orcid):
        assert not orcid.is_valid("0000-0002-1825-009")
        assert not orcid.is_valid("not-an-orcid")

    def test_accepts_a_full_url(self, orcid):
        assert orcid.is_valid("https://orcid.org/0000-0002-1825-0097")

    def test_ignores_whitespace_and_lowercase_x(self, orcid):
        assert orcid.is_valid("  0000-0002-1694-233x  ")


class TestConfig:
    def test_set_get_clear_roundtrip(self, orcid, tmp_path, monkeypatch):
        monkeypatch.setenv("WONDER_ORCID", str(tmp_path / "orcid"))
        assert orcid.set_id("https://orcid.org/0000-0002-1825-0097") == 0
        assert orcid.get_id() == "0000-0002-1825-0097"  # normalized off the URL
        assert orcid.clear_id() == 0
        assert orcid.get_id() == ""

    def test_set_rejects_invalid_and_saves_nothing(self, orcid, tmp_path, monkeypatch):
        monkeypatch.setenv("WONDER_ORCID", str(tmp_path / "orcid"))
        assert orcid.set_id("0000-0002-1825-0098") != 0
        assert orcid.get_id() == ""


class TestCli:
    def run(self, *args):
        return subprocess.run(
            [sys.executable, script_path("orcid"), *args],
            capture_output=True,
            text=True,
        )

    def test_validate_exit_codes(self):
        assert self.run("validate", "0000-0002-1825-0097").returncode == 0
        assert self.run("validate", "0000-0002-1825-0098").returncode == 1
        assert self.run("bogus").returncode == 2
