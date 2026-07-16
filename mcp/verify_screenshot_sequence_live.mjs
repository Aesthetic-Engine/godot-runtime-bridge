#!/usr/bin/env node

import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const options = { count: 3, intervalMs: 250 };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--project") options.project = argv[++index];
    else if (arg === "--godot-exe") options.godotExe = argv[++index];
    else if (arg === "--count") options.count = Number.parseInt(argv[++index], 10);
    else if (arg === "--interval-ms") options.intervalMs = Number.parseInt(argv[++index], 10);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.project) throw new Error("--project is required.");
  return options;
}

function firstText(result) {
  return result.content?.find((item) => item.type === "text")?.text || "";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = {
    GODOT_PATH: options.godotExe || process.env.GODOT_PATH || "",
    GDRB_FORCE_WINDOWED: "1",
    GDRB_SKIP_MIC_CHECK: "1",
    GDRB_FREEZE_CLOCK: "1",
    GDRB_DISABLE_VOICE_CAPTURE: "1",
  };
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, "index.js")],
    cwd: __dirname,
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "grb-sequence-live-verifier", version: "1.0.0" });
  let launched = false;

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert(
      tools.tools.some((tool) => tool.name === "grb_screenshot_sequence"),
      "MCP tool list does not contain grb_screenshot_sequence"
    );

    const launch = await client.callTool({
      name: "grb_launch",
      arguments: {
        project_path: path.resolve(options.project),
        ...(options.godotExe ? { godot_exe: path.resolve(options.godotExe) } : {}),
        tier: 2,
        window_size: "960x540",
      },
    });
    assert.notEqual(launch.isError, true, firstText(launch));
    launched = true;

    const capture = await client.callTool({
      name: "grb_screenshot_sequence",
      arguments: {
        count: options.count,
        interval_ms: options.intervalMs,
        label: "live-verification",
      },
    });
    assert.notEqual(capture.isError, true, firstText(capture));
    const summary = JSON.parse(firstText(capture));
    assert.equal(summary.ok, true);
    assert.equal(summary.status, "complete");
    assert.equal(summary.captured_count, options.count);
    assert.equal(summary.requested_count, options.count);
    assert.equal(summary.frames.length, options.count);
    assert.equal(fs.existsSync(summary.manifest_path), true);
    const manifest = JSON.parse(fs.readFileSync(summary.manifest_path, "utf8"));
    assert.equal(manifest.status, "complete");
    for (const frame of summary.frames) {
      const framePath = path.join(summary.sequence_dir, frame.filename);
      assert.equal(fs.existsSync(framePath), true, `Missing frame: ${framePath}`);
      assert.match(frame.sha256, /^[a-f0-9]{64}$/);
    }

    const errors = await client.callTool({ name: "grb_get_errors", arguments: {} });
    assert.notEqual(errors.isError, true, firstText(errors));
    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: "grb_screenshot_sequence",
          captured_count: summary.captured_count,
          interval_ms: summary.interval_ms,
          sequence_dir: summary.sequence_dir,
          manifest_path: summary.manifest_path,
          runtime_errors: firstText(errors),
        },
        null,
        2
      )
    );
  } finally {
    if (launched) {
      try {
        await client.callTool({ name: "grb_quit", arguments: {} });
      } catch {}
    }
    await transport.close();
  }
}

main().catch((error) => {
  console.error(`live screenshot sequence verification failed: ${error.message}`);
  process.exit(1);
});
