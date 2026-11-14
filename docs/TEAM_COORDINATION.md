# Team Coordination

## GitHub collaboration

Codex owns backend work and Claude owns frontend work. Each agent fetches the latest `origin/main`, creates a task-specific branch, and commits only its scoped changes. When authorized, the agent pushes the branch and opens a Pull Request; otherwise it hands the local branch to a human. GitHub branches, commits, PR descriptions, and review comments are the durable coordination channel; do not rely on local chat context being shared between agents.

Before starting, check open PRs and announce the files in scope. Coordinate with a human before either agent edits shared files (`docs/`, root configuration, CI, or the API contract). Never work directly on another agent's branch unless the handoff explicitly requests it.

## API change process

1. Record the proposed endpoint, method, request and response fields, validation rules, error behavior, and representative JSON. Mark all of it **Proposed — not implemented**.
2. Ask both owners to assess backend and frontend impact.
3. Obtain explicit human approval before changing `docs/API_CONTRACT.md` or implementation code.
4. Update the approved contract first (or in the same reviewed PR), then implement backend behavior and contract tests.
5. The frontend consumes only the approved `docs/API_CONTRACT.md`, updates its types/schema/client, and adds integration-facing tests.
6. Run both stacks' required checks before merge. Never infer an API from unfinished code or invent a temporary endpoint.

The frontend obtains the contract by fetching the approved commit from GitHub and reading `docs/API_CONTRACT.md`. PR descriptions must identify that exact contract commit when frontend work depends on an API change.

## Handoff checklist

Every completed-work handoff must include:

- branch name and commit hash when committed;
- concise status: **Implemented**, **Proposed**, or **Blocked**;
- changed files and the reason for each change;
- representative request and response JSON for API-affecting work;
- tests, typechecks, and builds run, with results;
- known limitations, blockers, follow-up work, and any required human decision;
- confirmation that the branch was not merged and whether it was pushed.

Implemented means the described changes exist on the named commit and the required checks are reported. Proposed means design-only or future work and must not be described as available behavior. A Proposed handoff does not require a commit hash; when no commit exists, state **Not committed** and identify the relevant base revision when useful. Blocked means implementation is incomplete, with the blocking dependency stated explicitly. Use these labels in PRs and handoffs.

## Avoiding conflicting edits

- Assign one owner per file or tightly related file set before coding.
- For cross-stack work, agree on the owner of each affected file and the integration order before editing.
- Re-fetch and inspect active PRs before editing a shared file. If another branch already changes it, stop and coordinate rather than duplicating the edit.
- Hand off through committed GitHub state; do not copy uncommitted files between machines.
- Rebase or merge the latest approved base only with human direction, resolve conflicts with both affected owners, and never force-push.
