---
name: grill-mvp
description: Grill a design with MVP focus — ask only what's needed to start coding, park everything else. Produces a short design spec with resolved decisions and a list of parked open questions. Use when user wants to stress-test an idea but get to code fast, or says "grill mvp", "what do I need to decide before coding", "quick grill".
---

# Grill MVP — Decide Enough to Start Coding

Grill the user's idea with one filter on every question:
**"Can I start coding the MVP without answering this?"**

- Yes → **Park it.** Log it as an open question, move on.
- No → **Resolve it now.**

The goal is the shortest path from idea to code that doesn't paint you into a corner.

## When to Use

- User has an idea or plan and wants to start coding soon
- Design is fuzzy but coding shouldn't wait for every answer
- User says "grill mvp", "what do I need before I code?", "quick grill"

## Grill Loop

Ask **one question at a time**. For each question:

### 1. Pick the question

Walk the design tree from the top. Start with the highest-impact unknowns — the ones that shape the code structure.

If a question can be answered by exploring the codebase, explore the codebase instead of asking.

### 2. Render

```
**Q<n>: <question>**

Options:
- (A) ...
- (B) ...

**Recommendation:** (A) — <one-line reason>.

**MVP gate:** <Must-Resolve | Parkable> — <why>
```

If the question is **Parkable**, say so and recommend parking it:

```
**Q<n>: <question>**

This doesn't block the MVP. Recommend parking it.
**Open question (parked):** "<restate as a clear question for later>"

Park, or resolve now?
```

### 3. User answers

Wait. Accept their pick, override, or parking decision.

The user can also override the MVP gate:
- Promote a Parkable to Must-Resolve if they want to decide now
- Demote a Must-Resolve to Parked if they're okay deferring it

### 4. Quick stress-test

Before moving on, check:
- Does this conflict with a prior decision in this session?
- Does this close off a parked question's future options?

If something is off, flag it. Otherwise move on.

### 5. Loop

Go back to 1. Stop when:
- All Must-Resolve questions for the MVP are answered, OR
- The user says "enough" / "let's write"

## Output — Design Spec

When the grill is done (or the user calls it), draft a design spec and **show it to the user for confirmation before writing to a file**.

Format:

```markdown
# <Project/Feature Name> — MVP Design Spec

## Goal
<one sentence — what the MVP delivers>

## Decisions

- **Q<n>: <question>** → <decision>. <one-line reason>.
- **Q<n>: <question>** → <decision>. <one-line reason>.
- ...

## Open Questions (Parked)

These are known unknowns. They don't block the MVP but should be revisited.

- [ ] <question> — <brief context on why it was parked>
- [ ] <question> — <brief context>
- ...
```

Ask the user:
> Here's the spec. Want me to write it to a file? If so, where?

Respect their answer. If they say no, leave it in the conversation.

## Rules

- ALWAYS recommend an answer. Never ask without proposing.
- ALWAYS tag each question as Must-Resolve or Parkable.
- ONE question at a time.
- NEVER grill deeper than the MVP needs. If it's parkable, park it and move on.
- NEVER write files without user confirmation.
- When the user says "enough" or "let's code" — stop grilling and jump to the output spec.
- Park > Drop. Parked questions are visible in the spec so nothing is forgotten.
- Keep the spec short. If it's longer than a screen, it's too long.
