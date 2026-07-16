import crypto from "crypto";
import fs from "fs";
import path from "path";

export const DEFAULT_SEQUENCE_COUNT = 15;
export const DEFAULT_SEQUENCE_INTERVAL_MS = 1000;
export const MAX_SEQUENCE_COUNT = 60;
export const MAX_INLINE_SEQUENCE_IMAGES = 20;
export const MAX_SEQUENCE_DURATION_MS = 120000;

function requireInteger(value, name, { min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function sanitizeLabel(value) {
  if (value == null || value === "") return "sequence";
  if (typeof value !== "string") throw new Error("label must be a string.");
  const label = value
    .trim()
    .slice(0, 64)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!label) throw new Error("label must contain at least one letter or number.");
  return label;
}

export function normalizeSequenceOptions(raw = {}) {
  const count = requireInteger(raw.count ?? DEFAULT_SEQUENCE_COUNT, "count", {
    min: 1,
    max: MAX_SEQUENCE_COUNT,
  });
  const intervalMs = requireInteger(
    raw.interval_ms ?? DEFAULT_SEQUENCE_INTERVAL_MS,
    "interval_ms",
    { min: 100, max: 10000 }
  );
  const durationMs = (count - 1) * intervalMs;
  if (durationMs > MAX_SEQUENCE_DURATION_MS) {
    throw new Error(
      `Sequence duration must not exceed ${MAX_SEQUENCE_DURATION_MS} ms; requested ${durationMs} ms.`
    );
  }
  const includeImages = raw.include_images === true;
  if (includeImages && count > MAX_INLINE_SEQUENCE_IMAGES) {
    throw new Error(
      `include_images supports at most ${MAX_INLINE_SEQUENCE_IMAGES} frames; save a larger sequence to disk instead.`
    );
  }
  return {
    count,
    intervalMs,
    includeImages,
    label: sanitizeLabel(raw.label),
  };
}

function defaultWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestampForPath(epochMs) {
  return new Date(epochMs).toISOString().replace(/[:.]/g, "-");
}

function responseError(response) {
  if (response?.error?.code || response?.error?.message) {
    return `${response.error.code || "screenshot_failed"}: ${response.error.message || "unknown error"}`;
  }
  return JSON.stringify(response);
}

export async function captureScreenshotSequence({
  projectPath,
  options: rawOptions = {},
  capture,
  clock = Date.now,
  wait = defaultWait,
}) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new Error(
      "A project-backed session is required. Launch with grb_launch before capturing a sequence."
    );
  }
  if (typeof capture !== "function") throw new Error("capture must be a function.");

  const options = normalizeSequenceOptions(rawOptions);
  const startedMs = clock();
  const screenshotsRoot = path.join(projectPath, "debug", "screenshots");
  const sequenceName = `sequence-${timestampForPath(startedMs)}-${options.label}`;
  const sequenceDir = path.join(screenshotsRoot, sequenceName);
  const manifestPath = path.join(sequenceDir, "manifest.json");
  fs.mkdirSync(sequenceDir, { recursive: true });
  const gdignorePath = path.join(screenshotsRoot, ".gdignore");
  if (!fs.existsSync(gdignorePath)) fs.writeFileSync(gdignorePath, "");

  const manifest = {
    schema_version: 1,
    kind: "grb_screenshot_sequence",
    status: "capturing",
    label: options.label,
    started_at: new Date(startedMs).toISOString(),
    completed_at: null,
    requested_count: options.count,
    captured_count: 0,
    interval_ms: options.intervalMs,
    scheduled_duration_ms: (options.count - 1) * options.intervalMs,
    frames: [],
    error: null,
  };
  const inlineImages = [];
  const persistManifest = () => {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  };
  persistManifest();

  for (let index = 0; index < options.count; index++) {
    const scheduledElapsedMs = index * options.intervalMs;
    const remainingMs = startedMs + scheduledElapsedMs - clock();
    if (remainingMs > 0) await wait(remainingMs);

    let response;
    try {
      response = await capture();
    } catch (error) {
      manifest.status = "failed";
      manifest.error = String(error?.message || error);
      manifest.completed_at = new Date(clock()).toISOString();
      persistManifest();
      return { ok: false, sequenceDir, manifestPath, manifest, inlineImages };
    }
    if (!response?.ok || typeof response.png_base64 !== "string") {
      manifest.status = "failed";
      manifest.error = responseError(response);
      manifest.completed_at = new Date(clock()).toISOString();
      persistManifest();
      return { ok: false, sequenceDir, manifestPath, manifest, inlineImages };
    }

    const capturedMs = clock();
    const elapsedMs = Math.max(0, capturedMs - startedMs);
    const png = Buffer.from(response.png_base64, "base64");
    const frameNumber = String(index + 1).padStart(3, "0");
    const elapsedLabel = String(elapsedMs).padStart(6, "0");
    const filename = `frame-${frameNumber}-${elapsedLabel}ms.png`;
    fs.writeFileSync(path.join(sequenceDir, filename), png);
    const frame = {
      index: index + 1,
      filename,
      captured_at: new Date(capturedMs).toISOString(),
      scheduled_elapsed_ms: scheduledElapsedMs,
      elapsed_ms: elapsedMs,
      width: response.width,
      height: response.height,
      bytes: png.length,
      sha256: crypto.createHash("sha256").update(png).digest("hex"),
    };
    manifest.frames.push(frame);
    manifest.captured_count = manifest.frames.length;
    if (options.includeImages) {
      inlineImages.push({ filename, png_base64: response.png_base64 });
    }
    persistManifest();
  }

  manifest.status = "complete";
  manifest.completed_at = new Date(clock()).toISOString();
  persistManifest();
  return { ok: true, sequenceDir, manifestPath, manifest, inlineImages };
}
