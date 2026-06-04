# wonder

A project from the **AI for Science Power Users** gathering.

`wonder` helps the people at the gathering find each other. You've been working
in a Claude session on some piece of science. You run `/wonder`. It reads what
you've been doing, writes a short, shareable summary of what you're *wondering
about* — plus a few keywords — scrubbed of anything sensitive. Once **you**
approve it, it hands those keywords to **OhWow**, a service that matches you
against everyone else and drops you into a Discord room with the people working
on the same thing.

> **Status: early design sketch, pre-build.** Nothing here is implemented yet.
> This document is a starting point for the group to react to and refine — the
> open questions and assumptions below are the parts that most need your input.

## The idea

The gathering is full of people quietly working on overlapping problems who will
never discover each other in a hallway. But each of them has just spent hours
explaining their problem to Claude. That session *is* the perfect description of
what they're working on — it's just also full of things they'd never want to
broadcast (unpublished results, file paths, API keys, collaborators' names).

`wonder` turns that session into a safe set of keywords (and a one-paragraph
"here's what I'm wondering about"). **OhWow** takes those keywords, finds the
other people wondering about the same things, and connects them in a Discord room
— seeded with those shared keywords so there's an instant starting point for
conversation.

The feeling we're after: you're heads-down in a session, a little lonely talking
only to agents, you type `/wonder` — and a few minutes later you're in a room
with humans who care about the same thing you do.

## Naming

- **`/wonder`** — the command a user runs inside Claude Code.
- **OhWow** — the MCP service everyone's `/wonder` talks to. It matches on
  keywords and owns the Discord room creation + invites. (Working name; candidate
  domain TBD — `ohwow.science` was floated.)

## How it works (proposed)

```mermaid
flowchart TD
    S["Your Claude session"] -->|"/wonder"| SUM["Summarize: what am I wondering about? + keywords"]
    SUM --> SCRUB["Scrub sensitive info: secrets, PII, unpublished science, local env"]
    SCRUB --> REVIEW{"You review and approve the exact text + keywords"}
    REVIEW -->|"edit / redo"| SCRUB
    REVIEW -->|"approve"| OHWOW["OhWow service"]
    OHWOW --> MATCH["Match people on shared keywords"]
    MATCH --> ROOM["Programmatically create a Discord room, seeded with the keywords"]
    ROOM --> INVITE["Each person gets an invite link — you click to join"]
    ID[("ORCID sign-in (stretch / bonus)")] -.-> OHWOW
    VAL[("Valency: researcher metadata (stretch)")] -.-> MATCH
```

The non-negotiable property: **nothing leaves your machine until you've seen the
exact text and approved it.** `/wonder` drafts and sanitizes locally; the human
is the final gate; OhWow only ever receives the approved keywords/summary.

## The Discord side (core mechanic)

This is the heart of the demo. Via the Discord API, OhWow:

1. **Programmatically creates a room** (channel) when a set of people match.
2. **Seeds it with the shared keywords** — a starter message / topic so people
   land on common ground instead of an empty room.
3. **Invites the matched people** by handing each one an **invite link**.
4. Each person **actively clicks** to join — nobody is silently teleported in.
   Stay as long as you want, leave anytime.

**Not pairwise — one-to-N.** You aren't matched to a single person; you're routed
to a *room* of everyone wondering about the same cluster. Rooms scale with the
crowd: six people total might mean one shared room; a thousand means many more
specialized ones.

## Components

### 1. The `/wonder` command
Orchestrates the flow. Reads the current session, calls the summarizer, runs the
scrubbing skills, shows you the result, and — only on your approval — hands the
sanitized keywords + profile to OhWow. Owns the **profile schema** (below), which
is the contract everything else depends on. It's user-triggered: you're in the
middle of something, you decide you want company, you type `/wonder`.

### 2. Summarization → a "wonder profile"
Distills the session into a small, shareable, *structured* profile rather than a
blob of text, because structure makes both scrubbing and matching tractable:

- **Wondering about** — one line, the core question/problem
- **Field / domain** — e.g. structural biology, climate modeling
- **Methods & tools** — techniques, models, instruments in play
- **Looking for** — collaborators? data? a technique? feedback?
- **Can offer** — what you bring
- **Keywords** — the terms OhWow matches on and seeds the room with

### 3. Scrubbing skills (a set, not one)
Each skill targets one category of sensitive content so they're composable and
independently testable. `/wonder` runs them over the draft in sequence. You can
also pre-declare things to never leak ("do not mention this word / this IP"):

- **secrets** — API keys, tokens, passwords, connection strings (deterministic)
- **local-env** — file paths, hostnames, usernames, internal URLs (deterministic)
- **pii** — names, emails, affiliations of people who haven't consented
- **unpublished-science** — pre-publication results, raw data values, sequences,
  compound structures, grant numbers, anything under embargo / IP / NDA. This is
  the hard, science-specific case and leans on model judgment, not regex.

Scrubbing *proposes*; the user *disposes*. The review gate is part of the system,
not an afterthought.

### 4. OhWow MCP service
The routing brain. Matches incoming keyword sets, and drives the Discord side —
creating rooms, seeding them, and issuing invites. A small, deliberately split
interface:

- `suggest_rooms(profile)` → ranked rooms/people (read-only, safe to call)
- `connect(profile, room)` → the actual Discord side effect (creates + seeds the
  room if needed, returns an invite link the user clicks)

Keeping read-only suggestion separate from the side-effecting connect keeps the
user in control of the one step that's hard to undo.

### 5. Stretch / bonus layers
- **ORCID sign-in.** Authenticating to OhWow with an ORCID gives a real research
  identity, cuts down on abuse and the "dating app" angle, and avoids per-user
  tokens. **Bonus — only if we get to it.** v1 works on keywords alone.
- **Valency enrichment.** Given an ORCID, Valency supplies research profile,
  adjacent topics, and nearby researchers — so matching becomes "people whose
  work is adjacent to yours," not just keyword overlap. Stood up behind a single
  shared token so users don't each need their own. An enrichment layer *after* the
  keyword MVP works.

## Privacy, trust & abuse

- **Local-first** — summarizing and scrubbing happen in your session, on your machine.
- **Human-in-the-loop** — you see the exact text and explicitly approve; `/wonder` never auto-sends.
- **Defense in depth** — layered scrubbing skills *plus* human review; neither is trusted alone.
- **Least disclosure** — share the minimum needed to match (keywords + intent), never the raw transcript.
- **Minimal surface to the service** — OhWow receives only the approved keywords/profile.
- **Opt-in, high trust to start** — initially only people in the room, all opted in.
- **Abuse is stage two.** People will inevitably reach for something like this for
  connection or advice. We're not policing topics, but the moderation/liability
  layer is deliberately deferred; opt-in + invite-to-join is the v1 guardrail.

## Hackathon demo plan (what we build *today*)

Attack it from two angles and keep them separate:

1. **The plumbing** — prove a Claude session can run `/wonder`, emit keywords, and
   land the user in a programmatically created, keyword-seeded Discord room.
2. **The "why connect" matching** — the brain that decides *who* belongs together
   (later: embeddings / Valency).

For the demo we **fake the matching** and focus on the plumbing:

- Skip ORCID and Valency; match on **keywords** only.
- Everyone in the room publishes the skill, we all run `/wonder` live, and we
  should all land in the same seeded Discord room — dogfooding it in real time.
- Hard-code / fake "who should be paired" so we can show the end-to-end loop:
  session → keywords → OhWow → create room → seed with keywords → invite → click → talk.

## Open questions (for the group)

1. **Session access** — summarize from Claude's current in-context view (simplest) or read the raw transcript `.jsonl` for completeness?
2. **Who does the Discord write** — confirmed: `connect` creates + seeds the room server-side and returns an invite link the user clicks.
3. **Identity** — keywords-only for v1; ORCID is a bonus. If we add it, how do we collect it the first time and store it in local config?
4. **Hosting** — where do OhWow + the room catalog run during the gathering?
5. **Profile shape** — how much structured vs. freeform?
6. **Scrubbing depth** — deterministic rules cover secrets/paths; how aggressive should the model be on "unpublished science"?
7. **Room granularity** — at what crowd size do we split one big room into specialized ones, and who decides?

## Suggested build slices (≈4 people, parallelizable)

Two interfaces let everything proceed in parallel — pin these down together
*first*: **(a) the wonder-profile / keyword schema** and **(b) the OhWow tool contract**.

| Slice | Owns | Depends on |
|-------|------|------------|
| A. `/wonder` command + summarizer | orchestration, profile schema | — |
| B. Scrubbing skills + review gate | the scrub skill set | profile schema |
| C. OhWow MCP service + matching | keyword matching, `suggest`/`connect` | OhWow contract |
| D. Discord API: rooms + invites | create/seed rooms, invite links (keyword-seeded) | OhWow contract |

## Proposed repo layout

```
wonder/
  commands/wonder.md        # the /wonder command (Claude Code plugin)
  skills/
    summarize-session/      # session -> wonder profile + keywords
    scrub-secrets/
    scrub-local-env/
    scrub-pii/
    scrub-unpublished/
  server/                   # OhWow MCP service: matching + Discord room routing
  discord/                  # Discord API: create/seed rooms, invite links
  .mcp.json                 # wires OhWow into Claude
  PROFILE.md                # the shared wonder-profile schema (the contract)
```
