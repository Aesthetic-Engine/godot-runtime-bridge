# Changelog

## 0.1.0 — 2026-02-20

Initial public release.

- TCP debug server with grb/1 wire protocol
- 16 commands across 4 capability tiers (Observe, Input, Control, Danger)
- Bearer token authentication on every command
- Localhost-only, random port by default
- Synthetic input mode (background testing without OS cursor movement)
- Thread-safe producer-consumer architecture
- Editor bottom panel with launch configuration and command reference
- Zero overhead when inactive — safe to ship in production
- 20 game-agnostic QA missions with CLI runner and perceptual screenshot diff
