---
name: scrub-local-env
description: Use within /wonder to strip local environment details from a draft wonder profile — absolute file paths, usernames, hostnames, internal URLs, IPs. Deterministic, pattern-based.
---

# scrub-local-env  (slice B)

> Scaffold — not implemented.

Remove machine / local-environment fingerprints.

## Targets
Absolute paths (`/Users/...`, `C:\...`), usernames, hostnames, internal/private
URLs and IPs, ports.

## Approach
Deterministic / pattern-based.

## TODO
- [ ] Path + host + IP patterns
- [ ] Allowlist clearly-public URLs (e.g. arxiv.org) so we don't over-scrub
