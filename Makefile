# Dev tasks for the wonder plugin + OhWow service. See README "Development".
.PHONY: test test-py test-js install

# Run the whole suite (Python + JS).
test: test-py test-js

# Python: the scrub-skill scripts + orcid validator (pytest).
test-py:
	python3 -m pytest tests/ -q

# JS: the OhWow room-matching logic (node:test). Needs deps — run `make install`.
test-js:
	cd discord && npm test --silent

# Install JS deps (discord.js etc.). The Python tests need only the stdlib + pytest.
install:
	cd discord && npm install --no-audit --no-fund
