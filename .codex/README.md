# Codex Agent Profiles

This repository includes Codex-side agent profiles adapted from the Claude crew preserved in `.claude/`.

## What These Profiles Are

Codex does not expose arbitrary custom agent types. In this environment, the usable built-in agent roles are:

- `default`
- `explorer`
- `worker`

These profiles map the Claude personas onto those built-in roles so they can be invoked consistently in this repo.

## Available Profiles

- `planner`: analyze requests before implementation and produce a spec
- `fixer`: implement approved scope with minimal deviation
- `cleaner`: review for bugs, regressions, and risk
- `ghost`: add pragmatic tests for meaningful behavior
- `librarian`: handle versioning, changelog, and release tagging

## How To Use Them

Ask for the profile explicitly:

- `Use the planner profile for this feature.`
- `Use the fixer profile and implement the spec.`
- `Review this with the cleaner profile.`
- `Use the ghost profile to add tests for this change.`
- `Use the librarian profile to recommend the next version.`

You can also ask for the workflow:

- `Run planner -> fixer -> cleaner for this task.`
- `Run the build-feature workflow with the Codex profiles.`

You can inspect the local setup from the terminal:

- `scripts/codex-agents list`
- `scripts/codex-agents show planner`
- `scripts/codex-agents workflow`

## Mapping To Codex Capabilities

- `planner`: usually local, optionally aided by `explorer` for narrow codebase reads
- `fixer`: local or delegated to a `worker` for bounded implementation
- `cleaner`: local review, optionally aided by `explorer` for isolated questions
- `ghost`: local or delegated to a `worker` for disjoint test files
- `librarian`: local because it depends on git state and release judgment

## Source Of Truth

The original crew prompts are preserved under `.claude/`.
The Codex-adapted versions live in `.codex/profiles/`.

## Reusing In Other Repos

For most repos, copying `.codex/` is enough to carry over the Codex-side agent profiles.

Copy `.claude/` too if you want:

- the original source prompts preserved in-repo
- the Claude-style command docs as reference
- a clear provenance trail for how the Codex profiles were derived

After copying, adjust any repo-specific context inside the profile docs if the target repo has a different stack, deployment model, or workflow expectations.

## Command Approvals

Claude Code can be configured per repository through `.claude/settings.json`. This kit ships a permissive project-level setting that allows bash commands in the repo while still denying `git push`.

Codex does not currently use a repo-local command allowlist in this kit. Its approvals are stored under `~/.codex/`, so this repo includes a bootstrap helper:

- `scripts/codex-approvals enable`
- `scripts/codex-approvals enable --shell`

The default `enable` command marks the repo trusted in `~/.codex/config.toml` and seeds broad direct-command prefixes like `python`, `python3`, `npx`, `npm`, `node`, `uv`, and `make` into `~/.codex/rules/default.rules`.

`--shell` also allows shell wrapper commands such as `/bin/bash -lc`, which reduces prompts further but can also allow shell-wrapped `git push`. Keep that flag off if preserving push confirmation matters.
