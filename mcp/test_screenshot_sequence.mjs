#!/usr/bin/env node

import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  captureScreenshotSequence,
  normalizeSequenceOptions,
} from "./screenshot_sequence.mjs";

function expectThrow(fn, pattern) {
  assert.throws(fn, pattern);
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "grb-sequence-test-"));
  try {
    let now = Date.parse("2026-07-16T16:00:00.000Z");
    const waits = [];
    let captureCount = 0;
    const result = await captureScreenshotSequence({
      projectPath: tempRoot,
      options: { count: 3, interval_ms: 100, label: "books / fly", include_images: true },
      clock: () => now,
      wait: async (ms) => {
        waits.push(ms);
        now += ms;
      },
      capture: async () => {
        captureCount++;
        now += 5;
        return {
          ok: true,
          width: 960,
          height: 540,
          png_base64: Buffer.from(`fake-png-${captureCount}`).toString("base64"),
        };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.manifest.status, "complete");
    assert.equal(result.manifest.label, "books-fly");
    assert.equal(result.manifest.captured_count, 3);
    assert.deepEqual(waits, [95, 95], "capture cadence should anchor to the sequence start");
    assert.deepEqual(
      result.manifest.frames.map((frame) => frame.elapsed_ms),
      [5, 105, 205]
    );
    assert.equal(result.inlineImages.length, 3);
    for (const frame of result.manifest.frames) {
      assert.equal(fs.existsSync(path.join(result.sequenceDir, frame.filename)), true);
      assert.match(frame.sha256, /^[a-f0-9]{64}$/);
    }
    const persisted = JSON.parse(fs.readFileSync(result.manifestPath, "utf8"));
    assert.equal(persisted.status, "complete");
    assert.equal(persisted.frames.length, 3);

    now += 1000;
    let failingCapture = 0;
    const partial = await captureScreenshotSequence({
      projectPath: tempRoot,
      options: { count: 3, interval_ms: 100, label: "partial" },
      clock: () => now,
      wait: async (ms) => {
        now += ms;
      },
      capture: async () => {
        failingCapture++;
        now += 1;
        if (failingCapture === 2) {
          return { ok: false, error: { code: "capture_failed", message: "synthetic" } };
        }
        return {
          ok: true,
          width: 320,
          height: 200,
          png_base64: Buffer.from("first-frame").toString("base64"),
        };
      },
    });
    assert.equal(partial.ok, false);
    assert.equal(partial.manifest.status, "failed");
    assert.equal(partial.manifest.captured_count, 1);
    assert.match(partial.manifest.error, /capture_failed: synthetic/);
    assert.equal(JSON.parse(fs.readFileSync(partial.manifestPath, "utf8")).status, "failed");

    assert.deepEqual(normalizeSequenceOptions({}), {
      count: 15,
      intervalMs: 1000,
      includeImages: false,
      label: "sequence",
    });
    expectThrow(() => normalizeSequenceOptions({ count: 0 }), /count must be an integer/);
    expectThrow(() => normalizeSequenceOptions({ interval_ms: 99 }), /interval_ms must be an integer/);
    expectThrow(
      () => normalizeSequenceOptions({ count: 21, include_images: true }),
      /include_images supports at most 20 frames/
    );
    expectThrow(
      () => normalizeSequenceOptions({ count: 60, interval_ms: 10000 }),
      /Sequence duration must not exceed/
    );
    expectThrow(() => normalizeSequenceOptions({ label: "../" }), /letter or number/);

    console.log("ok screenshot sequence validation, cadence, artifacts, hashes, and partial failure");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`screenshot sequence verification failed: ${error.message}`);
  process.exit(1);
});
