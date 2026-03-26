# Claude Crew Reference

This repository preserves a lightweight Claude-style crew definition under `.claude/` and a Codex-adapted equivalent under `.codex/`.

## Crew

- `planner`: spec first
- `fixer`: implementation
- `cleaner`: review
- `ghost`: tests
- `librarian`: release work

## Codex Usage

The Codex-native profiles live under `.codex/` and are the files intended for actual use in this environment.

For lower-friction local execution after installing this kit, run:

- `scripts/codex-approvals enable`

If you also want shell-wrapper commands auto-approved for Codex, use:

- `scripts/codex-approvals enable --shell`

The `--shell` mode is broader and may also allow shell-wrapped `git push`, so leave it off if you want push confirmation preserved.
