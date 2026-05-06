# Proof Report Template

Use this for project-specific slice closeouts when a coding agent changed files
and collected GRB evidence. Keep it short, factual, and honest.

## Worktree Preflight Before

- Command: `git status --short` or `node <grb-repo>/tools/grb_worktree_preflight.mjs <project>`
- Dirty state found before editing:
  - TODO: list likely source edits, docs, generated artifacts, proof reports, or suspicious files
- Prior/user work preserved:
  - TODO: list any dirty files that existed before this slice and were not yours
- Intended touch paths:
  - TODO: list files/folders the slice was expected to edit

## Files Changed

- TODO: file path — short reason

## What Changed

Briefly explain the product/code/doc change in plain language.

## Proof Commands

```bash
TODO: exact command run
```

Include failed or blocked commands too when they explain the proof boundary.

## W-Tier Evidence

W-tier answers: did the project launch/connect/run the intended automation path?

- TODO: command output, proof bundle path, doctor result, or launch/connect evidence

## R-Tier Evidence

R-tier answers: what runtime artifacts were captured for review?

- TODO: screenshots, runtime state, JSON debug snapshots, logs, comparison report, or `run.json`
- Primary artifact to inspect:
  - TODO: path

## E-Tier Evidence

E-tier requires human judgment. Do not claim it unless a human actually reviewed
or played the slice.

- Claimed: TODO yes/no
- Human reviewer / review note: TODO

## Known Issues / Not Claimed

- TODO: what automation did not prove
- TODO: unresolved visual/design/feel/product questions
- TODO: flaky, noisy, or unstable evidence surfaces

## Worktree Preflight After

- Command: `git status --short` or `node <grb-repo>/tools/grb_worktree_preflight.mjs <project>`
- Dirty state after the slice:
  - TODO: list remaining changed files by likely category
- New files/edits from this slice:
  - TODO: list what you intentionally changed
- Prior/user work still preserved:
  - TODO: confirm unchanged prior dirty files, or explain any intentional overlap

## Next Recommended Slice

State the smallest useful next step. Do not hide broad follow-up work inside a
single vague recommendation.
