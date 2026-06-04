---
name: scrub-pii
description: Use within /wonder to remove personal information about third parties from a draft wonder profile — names, emails, affiliations of people who have not consented to be shared.
---

# scrub-pii  (slice B)

> Scaffold — not implemented.

Remove PII about people who haven't opted in.

## Targets
Names, emails, affiliations of collaborators / third parties. (The user's *own*
identity is opt-in and handled separately — see the ORCID stretch goal in the README.)

## Approach
Model judgment + email/name patterns.

## TODO
- [ ] Distinguish the user's own (consented) identity from third parties
- [ ] Default behavior: drop names entirely vs. generalize ("a collaborator at a US university")
