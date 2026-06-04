---
name: scrub-secrets
description: Use within /wonder to remove credentials from a draft wonder profile — API keys, tokens, passwords, connection strings, private keys. Deterministic, pattern-based.
---

# scrub-secrets  (slice B)

> Scaffold — not implemented.

Remove secrets from the draft before it can be shown or sent.

## Targets
API keys, OAuth/bearer tokens, passwords, DB connection strings, private keys,
`.env`-style `KEY=value` secrets.

## Approach
Deterministic / pattern-based (regex + known key formats). When unsure, redact and
flag for the user rather than leak.

## TODO
- [ ] Pattern set for common providers
- [ ] Redaction format (mask vs. remove) — keep it visible to the user in review
