---
name: create-pr-main
description:
  Create a PR from current changes against main. Stashes work, rebases on
  latest main, commits relevant files, pushes, and opens a GitHub PR.
  Use when the user says "create pr", "pr to main", or invokes /create-pr-main.
---

# Create PR to Main

Automate the full flow of getting current changes into a clean PR against `main`.

## Workflow

### 1. Capture current state

```bash
git stash --include-untracked
```

Save the current branch name so you can reference it later if needed.

### 2. Update main

```bash
git checkout main
git pull origin main
```

### 3. Create a feature branch

Generate a branch name from the conversation context (e.g., `fix/add-user-agent-header`). If there's no clear context, ask the user for a branch name.

```bash
git checkout -b <branch-name>
```

### 4. Restore changes

```bash
git stash pop
```

### 5. Stage files

- **If the conversation modified specific files**: only stage those files.
- **If no conversation context or unclear**: stage all changed files (`git add -A`), but warn the user first and list what will be included.

Never stage files that likely contain secrets (`.env`, credentials, tokens).

### 6. Commit

- Analyze the staged diff to write a concise commit message (1-2 sentences, focused on "why").
- Append the co-author trailer.

```bash
git commit -m "<message>

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 7. Push and create PR

```bash
git push -u origin <branch-name>
```

Then create the PR using `gh`:

```bash
gh pr create --title "<short title>" --body "$(cat <<'EOF'
## Summary
<bullets>

## Test plan
<bullets>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- PR title: under 70 characters, descriptive.
- Summary: 1-3 bullet points covering what changed and why.
- Test plan: how to verify the changes work.

### 8. Report back

Print the PR URL so the user can open it directly.

## Error handling

- If `git stash` has nothing to stash, skip the stash/pop steps.
- If `git stash pop` has conflicts, stop and tell the user.
- If the push or PR creation fails, show the error and do not retry blindly.
- If the user is already on main with no other branch, just create the feature branch directly.
