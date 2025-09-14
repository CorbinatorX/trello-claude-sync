w---
description: "Update current Trello card with TodoWrite progress"
command: "trello-claude-sync update $ARGUMENTS"
---

# /trello-update

Updates the current active Trello card with your TodoWrite progress and task status.

## Usage

```
/trello-update [optional progress note]
```

## Examples

```
/trello-update
/trello-update "Implemented user authentication, working on session management"
/trello-update "All core features complete, starting testing phase"
```

## What it does

1. Syncs current TodoWrite task status to the card description
2. Updates task status icons (✅ completed, ⚙️ in progress, 📋 pending)
3. Adds a progress comment with completion summary
4. Updates card timestamp to reflect recent activity

## Use Cases

- **Progress Sync**: Keep Trello card in sync with your TodoWrite progress
- **Status Updates**: Update team on current task completion
- **Checkpoint Updates**: Save progress before switching contexts
- **Collaboration**: Share current status with team members

## Prerequisites

- Must have an active card in session (use `/trello-pickup` first)
- TodoWrite tasks should be tracked in current session

## Next Steps

After updating:
- Continue working on remaining tasks
- Use `/trello-complete` when all work is finished
- Share the card URL with team for visibility