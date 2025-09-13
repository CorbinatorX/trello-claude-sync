---
description: "Create Trello card from current TodoWrite plan"
command: "cd dev-tools/trello-integration && npm run build && node commands/trello-create.js $ARGUMENTS"
---

# /trello-create

Creates a Trello card from your current TodoWrite tasks and planning.

## Usage

```
/trello-create [optional custom title or description]
```

## Examples

```
/trello-create
/trello-create "User Authentication Feature"
/trello-create "Implement user login with JWT tokens and session management"
```

## What it does

1. Takes your current TodoWrite planning and task breakdown
2. Creates a Trello card in the TODO list
3. Formats your plan as the card description
4. Links the card to your current session
5. Returns the card URL and ID for reference

## Next Steps

After creating a card, you can:
- Continue working and use `/trello-complete` when finished
- Use `/trello-pickup <card-id>` to resume work later
- Check status with `/trello-status`