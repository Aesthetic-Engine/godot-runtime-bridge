# Ship Readiness Report — GRB 1.0.0

**Date:** 2026-02-26  
**Version:** 1.0.0  
**Test project:** The Never House  
**Test run:** `node mcp/test_new_commands.mjs --exe "Godot_v4.6-stable_win64_console.exe" --project "c:\The Never House"`

---

## Summary

| Feature | Status | Notes |
|---------|--------|-------|
| `grb_performance` | ✅ Ready | 7/7 tests passed |
| `audio_state` | ✅ Ready | |
| `network_state` | ✅ Ready | |
| `gesture` (pinch/swipe) | ✅ Ready | |
| `run_custom_command` | ✅ Ready | Graceful `not_found` when GRBCommands not set up |
| `capabilities` (new commands) | ✅ Ready | |

---

## Per-Feature Report

### 1. `grb_performance` (Tier 0)

**Capability:** Returns FPS, process times, object counts, draw calls, video memory.

**Test:** `sendCommand("grb_performance")` → response includes `fps`, `render_draw_calls`, etc.

**Verdict:** ✅ **Ship-ready** — Returns expected numeric fields; no errors observed.

---

### 2. `audio_state` (Tier 0)

**Capability:** Returns bus volumes (dB), mute state, mix rate for all audio buses.

**Test:** `sendCommand("audio_state")` → response includes `buses`, `mix_rate`.

**Verdict:** ✅ **Ship-ready** — Structured data as expected.

---

### 3. `network_state` (Tier 0)

**Capability:** Returns multiplayer/network state (placeholder for games without multiplayer).

**Test:** `sendCommand("network_state")` → response includes `multiplayer`.

**Verdict:** ✅ **Ship-ready** — Placeholder behavior correct for non-multiplayer games.

---

### 4. `gesture` (pinch / swipe) (Tier 1)

**Capability:** Injects pinch or swipe gestures via `InputEventMagnifyGesture` and `InputEventPanGesture`.

**Test:**
- Pinch: `sendCommand("gesture", { type: "pinch", params: { center: [320, 180], scale: 1.1 } })`
- Swipe: `sendCommand("gesture", { type: "swipe", params: { center: [320, 180], delta: [10, 0] } })`

**Verdict:** ✅ **Ship-ready** — Both types accepted; no protocol or runtime errors.

---

### 5. `run_custom_command` (Tier 2)

**Capability:** Invokes game-registered custom commands via `GRBCommands` autoload.

**Test:** `sendCommand("run_custom_command", { name: "test_cmd" })` — The Never House does not have `GRBCommands` autoload.

**Expected:** Graceful `not_found` or equivalent when GRBCommands is absent or command not registered.

**Verdict:** ✅ **Ship-ready** — Graceful degradation; no crash; agent can detect unavailable commands.

---

### 6. Capabilities list

**Test:** `sendCommand("capabilities")` → `commands` array includes `gesture`, `audio_state`, `network_state`, `grb_performance`.

**Verdict:** ✅ **Ship-ready** — New commands visible to clients.

---

## Recommendations

1. **Ship 1.0.0** — All features pass basic tests.
2. **Test script:** `mcp/test_new_commands.mjs` can be kept for regression testing.
3. **GRBCommands:** Document in README that games must add the autoload in Project Settings to use `run_custom_command`.
