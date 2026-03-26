# Build Feature Workflow

Codex adaptation of `.claude/commands/build-feature.md`.

## Sequence

1. `planner`
   - Read the relevant code.
   - Produce a spec before edits begin.
2. `fixer`
   - Implement only the approved scope.
   - Run relevant verification when feasible.
3. `cleaner`
   - Review the implementation against the spec.
   - Report `[BLOCK]`, `[WARN]`, and `[NOTE]` findings.
4. `fixer` again if needed
   - Address any blocking review findings.
5. `ghost` if needed
   - Add tests for risky logic, new interfaces, or review-identified gaps.
6. `librarian` if requested
   - Assess version bump, changelog, and tag steps.

## How To Request It

- `Run the build-feature workflow for this task.`
- `Use planner -> fixer -> cleaner on this request.`
- `Use planner first, then wait for my approval before fixer.`
