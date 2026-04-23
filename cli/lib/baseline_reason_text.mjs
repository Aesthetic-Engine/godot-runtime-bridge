function cleanLoadMessage(reason) {
  return String(reason || "")
    .replace(/^load_failed:/, "")
    .trim();
}

export function baselineReasonText(reason) {
  const text = String(reason || "").trim();

  if (!text) return "No reason was recorded.";
  if (text === "candidate run excluded from baseline selection") {
    return "The candidate run is the run being compared, so it is never eligible as the baseline.";
  }
  if (text === "candidate run") {
    return "This is the candidate run being compared.";
  }
  if (text === "explicit baseline path supplied by user") {
    return "You supplied this explicit baseline path.";
  }
  if (text === "newest eligible passing run with the same mission_id") {
    return "GRB chose the newest prior passing run with the same mission id.";
  }
  if (text === "candidate_self") {
    return "The candidate cannot be used as its own baseline.";
  }
  if (text === "mission_mismatch") {
    return "This run belongs to a different mission, so it is not eligible for same-mission comparison.";
  }
  if (text === "missing_mission_id") {
    return "This run is missing mission metadata, so GRB cannot prove it belongs to the same mission.";
  }
  if (text === "missing_run_json") {
    return "This folder does not contain run.json, so it is not a complete proof bundle.";
  }
  if (text.startsWith("unusable_result:")) {
    const result = text.slice("unusable_result:".length) || "unknown";
    return `This run ended with result '${result}', so it is not eligible as an automatic baseline.`;
  }
  if (text.startsWith("load_failed:")) {
    const detail = cleanLoadMessage(text);
    return `This run bundle could not be loaded${detail ? `: ${detail}` : "."}`;
  }

  return text;
}

export function baselineBlockedText(blockedReason) {
  const text = String(blockedReason || "").trim();

  if (!text) return "No baseline was selected.";
  if (text.startsWith("Explicit baseline rejected:")) {
    const reason = text.slice("Explicit baseline rejected:".length).trim();
    return `The explicit baseline was rejected. ${baselineReasonText(reason)}`;
  }
  if (text.startsWith("Explicit baseline could not be loaded:")) {
    const detail = text.slice("Explicit baseline could not be loaded:".length).trim();
    return `The explicit baseline bundle could not be loaded${detail ? `: ${detail}` : "."}`;
  }
  if (text.startsWith("No eligible passing baseline found for mission")) {
    return "No prior passing run exists yet for this mission, or every candidate was rejected.";
  }
  if (text.startsWith("No grb_reports directory found:")) {
    return "No grb_reports directory exists yet, so there are no prior proof bundles to choose from.";
  }
  if (text === "Candidate run cannot be used as its own baseline.") {
    return "The candidate cannot be used as its own baseline.";
  }

  return text;
}

export function blockedNextStep(blockedReason) {
  const text = String(blockedReason || "").trim();

  if (text.startsWith("Explicit baseline")) {
    return "Choose a different explicit baseline bundle that passes and matches the comparison you intend, or create a new passing baseline run.";
  }
  if (text.startsWith("No eligible passing baseline found") || text.startsWith("No grb_reports directory found")) {
    return "Run this mission once, inspect the proof bundle, accept it as a baseline candidate only if trustworthy, then compare a later run.";
  }
  if (text === "Candidate run cannot be used as its own baseline.") {
    return "Compare against a different prior run, or run the mission again after creating a trustworthy baseline candidate.";
  }

  return "Select an explicit trustworthy baseline or create a passing baseline run, then compare again.";
}
