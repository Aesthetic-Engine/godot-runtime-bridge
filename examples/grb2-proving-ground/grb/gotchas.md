# GRB 2.0 Proving Ground Gotchas

- Run `node tools/sync_grb_addon.mjs` before mission runs so the project has a local ignored addon copy.
- Open the project once in Godot before mission runs so `.godot/` metadata exists.
- Keep node names stable. The missions use button names and the root `Main` node.
- Do not commit `addons/`, `.godot/`, or `grb_reports/` from this example project.
- If a screenshot changes unexpectedly, inspect the mission report before calling it a regression.
