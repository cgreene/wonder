"""Tests for scrub-pii's deterministic identifier scrubber."""

import subprocess
import sys

from conftest import script_path


def found(pii, text):
    """Set of (placeholder, matched-text) pairs find_all() returns."""
    return {(ph, matched) for _s, _e, ph, matched in pii.find_all(text)}


class TestEmail:
    def test_plain_and_plus_addressed(self, pii):
        f = found(pii, "mail lena.hoffmann@esrf.fr or lena_h+lab@gmail.com")
        assert ("[EMAIL]", "lena.hoffmann@esrf.fr") in f
        assert ("[EMAIL]", "lena_h+lab@gmail.com") in f

    def test_email_at_not_double_counted_as_handle(self, pii):
        f = found(pii, "mail x.y@lab.edu please")
        assert f == {("[EMAIL]", "x.y@lab.edu")}


class TestOrcid:
    def test_bare_and_url_forms(self, pii):
        f = found(
            pii,
            "ORCID 0000-0002-1825-0097 or https://orcid.org/0000-0001-5109-356X",
        )
        assert ("[ORCID]", "0000-0002-1825-0097") in f
        assert ("[ORCID]", "https://orcid.org/0000-0001-5109-356X") in f

    def test_year_range_is_not_orcid(self, pii):
        assert found(pii, "funded 2024-2026 under the program") == set()


class TestPhone:
    def test_common_shapes(self, pii):
        text = "call +44 20 7946 0958 or (415) 555-2671 or 415-555-2671"
        f = found(pii, text)
        assert ("[PHONE]", "+44 20 7946 0958") in f
        assert ("[PHONE]", "(415) 555-2671") in f
        assert ("[PHONE]", "415-555-2671") in f

    def test_scientific_numbers_not_phones(self, pii):
        clean = "p=0.0001, version 2.10.3, doi 10.5281/zenodo.123456, n=10000"
        assert found(pii, clean) == set()


class TestHandle:
    def test_handles_matched(self, pii):
        f = found(pii, "ping @octocat or @lena_h on Discord")
        assert ("[HANDLE]", "@octocat") in f
        assert ("[HANDLE]", "@lena_h") in f

    def test_sentence_final_handle_matched(self, pii):
        # Regression: a sentence-ending period is not an attribute access.
        assert ("[HANDLE]", "@octocat") in found(pii, "thanks @octocat.")

    def test_decorators_and_calls_not_handles(self, pii):
        clean = (
            "@dataclass on the class, @app.route('/x'), "
            "@pytest.fixture, @staticmethod, obj@attr"
        )
        assert found(pii, clean) == set()

    def test_attribute_access_not_a_handle(self, pii):
        assert found(pii, "@mymodel.predict(x)") == set()


class TestApply:
    def test_placeholders_inserted(self, pii, capsys):
        pii.cmd_apply("mail x@lab.edu or ping @octocat\n")
        assert capsys.readouterr().out == "mail [EMAIL] or ping [HANDLE]\n"

    def test_clean_text_unchanged(self, pii, capsys):
        text = "p=0.0001 in version 2.10.3 per @dataclass\n"
        pii.cmd_apply(text)
        assert capsys.readouterr().out == text


class TestCli:
    def run(self, args, stdin):
        return subprocess.run(
            [sys.executable, script_path("pii"), *args],
            input=stdin,
            capture_output=True,
            text=True,
        )

    def test_exit_codes(self):
        assert self.run(["check", "-"], "mail x@lab.edu").returncode == 1
        assert self.run(["check", "-"], "nothing personal").returncode == 0
        assert self.run(["bogus"], "").returncode == 2

    def test_check_reports_line_numbers(self):
        r = self.run(["check", "-"], "clean\nmail x@lab.edu\n")
        assert "line 2" in r.stdout
