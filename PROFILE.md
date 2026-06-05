# The wonder profile (the contract)

This is the interface between slices. `/wonder` (slice A) **produces** it, the
scrubbing skills (slice B) **sanitize** it, and OhWow (slice C) **matches** on its
`keywords`. Treat changes here as breaking — agree them as a group.

## What it is

A small JSON object summarizing what one person is wondering about right now. It is
built locally from the user's Claude session, sanitized, shown to the user, and
sent to OhWow **only after explicit approval**.

## Schema (v0)

| Field             | Type       | Required | Notes |
|-------------------|------------|----------|-------|
| `schema_version`  | string     | yes      | `"0"` for now |
| `wondering_about` | string     | yes      | One line: the core question/problem |
| `field`           | string     | yes      | Domain, e.g. "structural biology" |
| `methods`         | string[]   | no       | Techniques, models, instruments in play |
| `looking_for`     | string     | no       | collaborators? data? a technique? feedback? |
| `can_offer`       | string     | no       | what this person brings |
| `orcid`           | string     | no       | the user's ORCID iD — **opt-in**, self-declared (not yet OAuth-verified), shown at the review gate. Managed by the `orcid` skill (`~/.wonder/orcid`). |
| `keywords`        | string[]   | yes      | **the match key.** Lowercase, deduped. OhWow matches and seeds the room on these |

### Example

```json
{
  "schema_version": "0",
  "wondering_about": "Reducing hallucinations when extracting structured data from lab notebooks",
  "field": "machine learning for chemistry",
  "methods": ["LLM tool use", "OCR", "schema-constrained decoding"],
  "looking_for": "others who've evaluated extraction accuracy on messy scientific PDFs",
  "can_offer": "a labeled benchmark of 200 annotated notebook pages",
  "orcid": "0000-0002-1825-0097",
  "keywords": ["information extraction", "llm hallucination", "lab notebooks", "chemistry", "structured output"]
}
```

## Boundaries

- **Outbound only after approval.** Nothing here reaches OhWow until the user
  approves the exact text. See the privacy model in the README.
- **`keywords` is the public surface.** Assume everything in `keywords` is visible
  to other matched people and posted as the room seed. Scrub accordingly.
- **Local-only inputs are NOT part of this object.** The user's "never leak this
  word / this IP" pre-declarations are inputs to the scrub skills, not fields sent
  to OhWow.

## Open (see README open questions)

- How much structured vs. freeform? (v0: structured, `keywords` as the match key)
- Identity: **`orcid` is opt-in** — self-declared in v1 (paste it in), OAuth-verified later (roadmap Stage 1b). Matching itself is still keywords-only.
