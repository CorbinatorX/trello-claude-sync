# Smart Commit Command

Please analyze the current git diff and create an appropriate commit message following conventional commit format. The message should use one of these prefixes:

- **feat:** for new features (gets ✨ emoji)
- **fix:** for bug fixes (gets 🐛 emoji)
- **docs:** for documentation (gets 📚 emoji)
- **chore:** for maintenance tasks (gets 🔧 emoji)
- **refactor:** for code refactoring (gets ♻️ emoji)
- **test:** for adding tests (gets 🧪 emoji)
- **style:** for formatting changes (gets 💄 emoji)
- **perf:** for performance improvements (gets ⚡ emoji)
- **ci:** for CI/CD changes (gets 👷 emoji)
- **build:** for build system changes (gets 👷 emoji)

## Process:

1. First, run `git status` to see what files are staged/modified
2. Run `git diff --cached` to see staged changes (or `git diff` for unstaged)
3. Analyze the changes and determine:
   - What type of change this is (feat, fix, docs, etc.)
   - What the change accomplishes
   - Which files/components are affected
4. Generate a descriptive but concise commit message
5. Run `git add .` if there are unstaged changes
6. Run `git commit -m "[generated message]"`

The prepare-commit-msg hook will automatically add the appropriate emoji based on the prefix.

## Guidelines:

- **Be specific**: Instead of "fix: bug fix", write "fix: resolve user login validation error"
- **Use imperative mood**: "add", "fix", "update" not "added", "fixed", "updated"
- **Focus on what and why**: What changed and why it was necessary
- **Keep under 72 characters** for the first line
- **Use present tense**: "fix bug" not "fixed bug"

## Examples:

- `feat: add dark mode toggle to user preferences`
- `fix: resolve memory leak in image processing`
- `refactor: simplify user authentication flow`
- `docs: update API documentation for v2 endpoints`
- `test: add unit tests for payment processing`

Make the message descriptive but concise, focusing on what changed and why.