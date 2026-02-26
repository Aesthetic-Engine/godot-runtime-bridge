# Running GRB in CI/CD

## Linux (GitHub Actions / GitLab CI)

Godot requires a display server for rendering. On headless Linux runners, use `xvfb` (X Virtual Framebuffer):

### GitHub Actions Example

```yaml
name: GRB QA
on: [push, pull_request]

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Godot
        run: |
          wget -q https://github.com/godotengine/godot-builds/releases/download/4.6-stable/Godot_v4.6-stable_linux.x86_64.zip
          unzip -q Godot_v4.6-stable_linux.x86_64.zip
          chmod +x Godot_v4.6-stable_linux.x86_64
          echo "GODOT_PATH=$(pwd)/Godot_v4.6-stable_linux.x86_64" >> $GITHUB_ENV

      - name: Install xvfb
        run: sudo apt-get install -y xvfb

      - name: Install Node.js dependencies
        run: cd mcp && npm install

      - name: Run GRB missions
        run: |
          xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" \
            node missions/run_mission.mjs \
              --mission starters \
              --exe "$GODOT_PATH" \
              --project .
```

### Key Points

- `xvfb-run` provides a virtual display so Godot can render and GRB can capture screenshots
- `--auto-servernum` avoids display number conflicts
- `-screen 0 1280x720x24` sets the virtual screen resolution
- Screenshots captured via GRB will work normally

### Windows (GitHub Actions)

Windows runners have a display server by default. No xvfb needed:

```yaml
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run GRB missions
        run: |
          node missions/run_mission.mjs --mission starters --exe "Godot.exe" --project .
```

### macOS

macOS runners also have a display. Use the `.app` bundle or extracted binary.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GODOT_PATH` | Path to Godot executable |
| `GDRB_TIER` | Max tier (default 1; set to 2 for missions that use set_property/call_method) |

## Exit Codes

- `0` — All missions passed
- `1` — One or more missions had issues
- `2` — Boot errors detected (use `--allow-boot-errors` to override)
