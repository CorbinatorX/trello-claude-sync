---
description: "Show current Trello session status and active card"
command: "trello-claude-sync status"
---

# /trello-status

Shows the current Trello integration session status and active card information.

## Usage

```
/trello-status
```

## What it shows

When you have an active card:
- Card name and Trello URL
- Current list position (TODO, DOING, etc.)
- Card ID for reference
- Last modified timestamp
- Card description
- Available next actions

When no card is active:
- Session status (no active card)
- Available commands to get started

## Use Cases

- Check what card you're currently working on
- Get the Trello URL to view in browser
- Verify card status before completing
- Understand current workflow state

## Next Steps

Based on status, you can:
- Continue working on the active card
- Complete with `/trello-complete`
- Switch cards with `/trello-pickup`
- Create new card with `/trello-create`