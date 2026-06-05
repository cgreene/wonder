"""Tests for scrub-local-env's deterministic environment scrubber."""

import subprocess
import sys

import pytest

from conftest import script_path


def cats(localenv, text):
    """Set of (category, matched-text) pairs scan() finds."""
    lines = text.splitlines()
    return {
        (cat, lines[lineno - 1][start:end])
        for lineno, start, end, cat, _ in localenv.scan(text)
    }


class TestPaths:
    def test_unix_user_paths(self, localenv):
        found = cats(localenv, "see /Users/betsy/proj/run.py and /home/carol/x")
        assert ("PATH", "/Users/betsy/proj/run.py") in found
        assert ("PATH", "/home/carol/x") in found

    def test_windows_and_home_relative(self, localenv):
        found = cats(localenv, r"in C:\Users\betsy\data and ~/notes/lab.md")
        assert any(c == "PATH" and m.startswith("C:\\Users") for c, m in found)
        assert ("PATH", "~/notes/lab.md") in found

    def test_machine_paths(self, localenv):
        found = cats(localenv, "logs in /tmp/run4 and /scratch/gpfs/proj")
        assert ("PATH", "/tmp/run4") in found
        assert ("PATH", "/scratch/gpfs/proj") in found

    def test_trailing_punctuation_not_swallowed(self, localenv):
        found = cats(localenv, "stored in /Users/betsy/out.csv.")
        assert ("PATH", "/Users/betsy/out.csv") in found


class TestUsernames:
    def test_username_from_path_flagged_elsewhere(self, localenv):
        text = "code at /Users/betsy/proj\nBetsy reran the fit\n"
        found = cats(localenv, text)
        assert ("USER", "Betsy") in found  # case-insensitive second pass

    def test_no_username_pass_without_a_path(self, localenv):
        # A bare name with no path anchor is scrub-pii's job, not ours.
        assert cats(localenv, "Betsy reran the fit") == set()


class TestNetwork:
    def test_ipv4_flagged(self, localenv):
        found = cats(localenv, "host at 192.168.1.10 and 10.0.0.5")
        assert ("IP", "192.168.1.10") in found
        assert ("IP", "10.0.0.5") in found

    def test_version_strings_not_ips(self, localenv):
        assert cats(localenv, "upgraded to version 1.2.3.4 yesterday") == set()
        assert cats(localenv, "python 3.10.4 and torch 2.1.0") == set()

    def test_bare_ambiguous_quad_left_to_model(self, localenv):
        # A 4-part quad with no version prefix and no network context could be a
        # version string, so the deterministic pass leaves it for the model.
        assert cats(localenv, "a bug where 1.2.3.4 was parsed as a date") == set()
        assert cats(localenv, "we hit 9.4.10.2 throughput on the run") == set()

    def test_public_quad_with_network_context_flagged(self, localenv):
        assert ("IP", "203.0.113.5") in cats(localenv, "ssh to 203.0.113.5 to deploy")
        assert ("IP", "198.51.100.7") in cats(localenv, "db at 198.51.100.7:5432")

    def test_internal_hosts_and_ssh(self, localenv):
        found = cats(localenv, "on gpu-box.internal:8443 via betsy@cluster.edu")
        assert any(c == "HOST" for c, _ in found)
        assert ("HOST", "betsy@cluster.edu") in found

    def test_localhost_and_port(self, localenv):
        found = cats(localenv, "serving on localhost:8080")
        assert any(c == "HOST" and "localhost" in m for c, m in found)

    def test_public_urls_untouched(self, localenv):
        clean = (
            "see https://doi.org/10.1234/abc and "
            "https://github.com/x/y and https://arxiv.org/abs/2401.1"
        )
        assert cats(localenv, clean) == set()

    def test_internal_url_flagged(self, localenv):
        found = cats(localenv, "dashboard at https://metrics.lab-internal.net/x")
        assert any(c == "URL" for c, _ in found)


class TestApply:
    def test_placeholders_by_category(self, localenv, capsys):
        localenv.cmd_apply("data in /Users/betsy/x on 10.0.0.5\n")
        out = capsys.readouterr().out
        assert "[PATH]" in out and "[IP]" in out
        assert "betsy" not in out

    def test_clean_text_passes_through(self, localenv, capsys):
        text = "AlphaFold runs at https://github.com/x/y v2.10.3\n"
        localenv.cmd_apply(text)
        assert capsys.readouterr().out == text


class TestCli:
    def run(self, args, stdin):
        return subprocess.run(
            [sys.executable, script_path("localenv"), *args],
            input=stdin,
            capture_output=True,
            text=True,
        )

    def test_exit_codes(self):
        assert self.run(["check", "-"], "in /Users/betsy/x").returncode == 1
        assert self.run(["check", "-"], "all public here").returncode == 0
        assert self.run(["bogus"], "").returncode == 2


@pytest.mark.xfail(
    reason="known FP: word:digits prose like 'Re:2024' matches HOST_PORT", strict=False
)
def test_prose_colon_number_not_flagged(localenv):
    assert cats(localenv, "see Re:2024 review thread") == set()
