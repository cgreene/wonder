---
name: scrub-unpublished
description: Use within /wonder to remove pre-publication and proprietary scientific content from a draft wonder profile — unpublished results, raw data values, sequences, compound structures, grant numbers, anything under embargo, IP, or NDA.
---

# scrub-unpublished  (slice B)

> Scaffold — not implemented. The hard, science-specific case.

Remove anything that would burn priority or breach IP/NDA if shared.

## Targets
Unpublished results and conclusions, raw data values, genetic sequences, compound
structures, specific grant/award numbers, embargoed findings.

## Approach
**Model judgment**, not regex — this is about scientific sensitivity, not patterns.
Bias toward generalizing ("a kinase inhibitor", not the structure) and toward asking
the user when uncertain. Better to under-share than to scoop someone.

## TODO
- [ ] Guidance/examples for "specific result" vs. "general topic"
- [ ] How aggressive by default (README open Q6)
