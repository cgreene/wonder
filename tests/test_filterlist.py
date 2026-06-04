"""Tests for scrub-unpublished's never-share filter list."""

import subprocess
import sys

from conftest import script_path


def pattern_for(filterlist, entries):
    return filterlist.compile_pattern(entries)


class TestMatching:
    def test_case_insensitive(self, filterlist):
        pat = pattern_for(filterlist, ["AX-201"])
        assert pat.search("we tested ax-201 today")
        assert pat.search("WE TESTED AX-201 TODAY")

    def test_whole_word_only(self, filterlist):
        pat = pattern_for(filterlist, ["AX-201"])
        # Embedded in a larger token -> no match.
        assert not pat.search("Relax-201x is unrelated")
        assert not pat.search("preAX-201suffix")
        # Adjacent punctuation is fine.
        assert pat.search("(AX-201)")
        assert pat.search("AX-201.")

    def test_phrase_entries(self, filterlist):
        pat = pattern_for(filterlist, ["Dr. Reyes"])
        assert pat.search("met with dr. reyes yesterday")
        assert not pat.search("dr reyes")  # literal match, not fuzzy

    def test_longest_entry_wins(self, filterlist):
        pat = pattern_for(filterlist, ["AX", "AX-201 series"])
        m = pat.search("the AX-201 series compounds")
        assert m.group(0) == "AX-201 series"

    def test_non_word_edges_match_without_boundary(self, filterlist):
        # An entry ending in a symbol can't use \b on that side.
        pat = pattern_for(filterlist, ["10.99.0.0/16"])
        assert pat.search("scanning 10.99.0.0/16 now")

    def test_empty_list_gives_no_pattern(self, filterlist):
        assert filterlist.compile_pattern([]) is None


class TestListFile:
    def test_comments_and_blanks_ignored(self, filterlist, tmp_path):
        f = tmp_path / "never-share.txt"
        f.write_text("# comment\n\nAX-201\n  \n# another\nLarkspur\n")
        assert filterlist.load_entries(f) == ["AX-201", "Larkspur"]

    def test_missing_file_is_empty(self, filterlist, tmp_path):
        assert filterlist.load_entries(tmp_path / "absent.txt") == []

    def test_add_dedupes_case_insensitively(self, filterlist, tmp_path, capsys):
        f = tmp_path / "never-share.txt"
        filterlist.cmd_add(f, ["AX-201", "Larkspur"])
        filterlist.cmd_add(f, ["ax-201", "  ", "Larkspur", "NEW-1"])
        assert filterlist.load_entries(f) == ["AX-201", "Larkspur", "NEW-1"]

    def test_add_creates_parent_dirs(self, filterlist, tmp_path):
        f = tmp_path / "deep" / "dir" / "list.txt"
        filterlist.cmd_add(f, ["AX-201"])
        assert filterlist.load_entries(f) == ["AX-201"]


class TestRedaction:
    def test_apply_redacts_all_occurrences(self, filterlist, capsys):
        pat = pattern_for(filterlist, ["AX-201"])
        filterlist.cmd_apply("AX-201 and ax-201 again", pat)
        assert capsys.readouterr().out == "[REDACTED] and [REDACTED] again"

    def test_check_reports_line_numbers(self, filterlist, capsys):
        pat = pattern_for(filterlist, ["Larkspur"])
        rc = filterlist.cmd_check("clean\nproject larkspur\n", pat)
        out = capsys.readouterr().out
        assert rc == 1
        assert "line 2" in out


class TestCli:
    """The contract /wonder relies on: stdin, env-var list path, exit codes."""

    def run(self, args, stdin, env_extra):
        import os

        env = dict(os.environ, **env_extra)
        return subprocess.run(
            [sys.executable, script_path("filterlist"), *args],
            input=stdin,
            capture_output=True,
            text=True,
            env=env,
        )

    def test_check_exit_codes_and_stdin(self, tmp_path):
        listfile = tmp_path / "list.txt"
        listfile.write_text("AX-201\n")
        env = {"WONDER_FILTER_LIST": str(listfile)}
        assert self.run(["check", "-"], "uses ax-201", env).returncode == 1
        assert self.run(["check", "-"], "all clean", env).returncode == 0

    def test_apply_via_stdin(self, tmp_path):
        listfile = tmp_path / "list.txt"
        listfile.write_text("AX-201\n")
        r = self.run(
            ["apply", "-"], "re AX-201 ok", {"WONDER_FILTER_LIST": str(listfile)}
        )
        assert r.stdout == "re [REDACTED] ok"

    def test_unknown_command_exits_2(self, tmp_path):
        r = self.run(
            ["frobnicate"], "", {"WONDER_FILTER_LIST": str(tmp_path / "l.txt")}
        )
        assert r.returncode == 2
