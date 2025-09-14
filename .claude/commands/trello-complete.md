---
description: "Move current card to Done and complete the workflow"
command: "trello-claude-sync complete $ARGUMENTS"
---

# /trello-complete

Completes the current Trello card by moving it to the Done list and clearing the session.

## Usage

```
/trello-complete [optional completion note]
```

## Examples

```
/trello-complete
/trello-complete "All tests passing, feature fully implemented"
/trello-complete "Ready for code review and deployment"
```

## What it does

1. Moves the current session's card to the "Done" list
2. Adds a completion comment with timestamp
3. Optionally includes your completion note
4. Clears the session (no active card)
5. Confirms the completion

## Prerequisites

- Must have an active card in session
- Use `/trello-pickup` or `/trello-create` first
- Check current status with `/trello-status`

## Next Steps

After completing a card:
- Start new work with `/trello-create` for planning
- Pick up another card with `/trello-pickup`
- The completed card remains in Done list for project tracking