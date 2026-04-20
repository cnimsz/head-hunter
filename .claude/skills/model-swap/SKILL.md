---
name: model-swap
description: Swap the Claude model used by the Head Hunter generation pipeline. Validates the model ID is current, updates src/lib/claude.js, runs a smoke test, and commits on success. Use when upgrading to a newer model or testing a different tier.
argument-hint: [model-id]
allowed-tools: Edit, Read, Bash
---

# Swap the Head Hunter Generation Model

Update the model ID used by the generation pipeline to $ARGUMENTS.

## Validate the model ID

$ARGUMENTS must be one of the current supported models. As of 2026:

- `claude-opus-4-7` — premium tier, $5/$25 per Mtok
- `claude-opus-4-6` — older premium, same pricing
- `claude-sonnet-4-6` — recommended default, $3/$15 per Mtok
- `claude-haiku-4-5-20251001` — fast/cheap, $1/$5 per Mtok

If $ARGUMENTS is not in this list, or if it matches a deprecated pattern (e.g., `claude-sonnet-4-20250514`, `claude-3-*`, or any ID with a pre-2025-11 date suffix), stop and warn the user.

If the user provides an unfamiliar model ID, use web search to verify it exists in Anthropic's current model list before proceeding.

## Update the code

1. Read `src/lib/claude.js` and locate the `MODEL` constant.

2. Update the `MODEL` constant to $ARGUMENTS.

3. Also update CLAUDE.md if it references the old model ID.

## Smoke test

Run the `test-pipeline` skill with the new model:

```
/test-pipeline
```

Report:
- Response time delta vs. the previous model
- Any parsing issues (newer models sometimes produce different JSON formatting)
- Token cost delta

## Commit

If the smoke test passes:

```bash
git add src/lib/claude.js CLAUDE.md
git commit -m "Swap Head Hunter model to $ARGUMENTS"
```

If it fails, do not commit. Report the failure mode to the user and suggest the next step:
- If parsing failed: the prompts may need adjustment for the new model's formatting tendencies
- If token cost is drastically higher: confirm the user wants to proceed anyway
- If response time is much slower: confirm this model tier is acceptable
