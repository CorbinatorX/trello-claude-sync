---
description: "Load existing Trello card into current session"
command: "cd dev-tools/trello-integration && npm run build && node commands/trello-pickup.js $ARGUMENTS"
---

# /trello-pickup

Loads an existing Trello card into your current TodoWrite session for active work.

## Usage

```
/trello-pickup <card-id-or-name>
```

## Examples

```
/trello-pickup "user authentication"
/trello-pickup "auth feature"
/trello-pickup 507f1f77bcf86cd799439011
```

## What it does

1. Searches for the card by name or loads by ID
2. Extracts any structured tasks from the card description
3. Links the card to your current session
4. Shows card details and current status
5. Prepares the card for active development

## Search Tips

- Use partial names: "auth" will find "User Authentication Feature"
- If multiple cards match, you'll see a list to choose from
- Card IDs are always unique and work reliably

## Next Steps

After picking up a card:
- Work on the tasks using TodoWrite
- Use `/trello-complete` when all work is finished
- Check progress with `/trello-status`