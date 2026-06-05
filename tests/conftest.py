"""Shared fixtures: load each skill script as an importable module.

The scrub scripts are standalone CLI files (no package), so we import them
by path. Matching logic is tested through the module functions; the CLI
contract (exit codes, stdin) is tested via subprocess in each test file.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
SCRIPTS = {
    "filterlist": REPO / "skills/scrub-unpublished/scripts/filterlist.py",
    "localenv": REPO / "skills/scrub-local-env/scripts/localenv.py",
    "pii": REPO / "skills/scrub-pii/scripts/pii.py",
    "orcid": REPO / "skills/orcid/scripts/orcid.py",
}


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS[name])
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="session")
def filterlist():
    return load_script("filterlist")


@pytest.fixture(scope="session")
def localenv():
    return load_script("localenv")


@pytest.fixture(scope="session")
def pii():
    return load_script("pii")


@pytest.fixture(scope="session")
def orcid():
    return load_script("orcid")


def script_path(name: str) -> str:
    return str(SCRIPTS[name])
