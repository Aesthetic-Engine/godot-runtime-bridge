import fs from "fs";
import path from "path";
import { resolveProjectDir } from "./paths.mjs";
import { parseSimpleYaml } from "./simple_yaml.mjs";

export const VALID_MISSION_PATTERNS = ["default", "transition", "toggle"];

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch (_) {
    return false;
  }
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function validateMissionId(missionId) {
  if (!missionId || !/^[a-z][a-z0-9_]*$/.test(missionId)) {
    throw new Error("Mission id must use snake_case starting with a letter, e.g. pause_menu or inventory_panel.");
  }
}

function validatePattern(pattern) {
  const patternId = pattern || "default";
  if (!VALID_MISSION_PATTERNS.includes(patternId)) {
    throw new Error(`Invalid mission scaffold pattern: ${patternId}. Valid patterns: ${VALID_MISSION_PATTERNS.join(", ")}.`);
  }
  return patternId;
}

function titleCaseFromId(missionId) {
  return missionId
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readDefaultRecipe(projectDir) {
  const projectConfig = path.join(projectDir, "grb.project.yaml");
  if (!isFile(projectConfig)) return { recipe: "default", source: "fallback" };

  try {
    const parsed = parseSimpleYaml(fs.readFileSync(projectConfig, "utf-8"));
    if (typeof parsed.default_recipe === "string" && parsed.default_recipe.trim()) {
      return { recipe: parsed.default_recipe.trim(), source: "grb.project.yaml" };
    }
  } catch (_) {
    return { recipe: "default", source: "fallback" };
  }

  return { recipe: "default", source: "fallback" };
}

function renderDefaultMission({ missionId, recipe }) {
  const title = titleCaseFromId(missionId);
  return `# GRB mission scaffold.
# Customize the TODOs before relying on this as proof.
# Keep this mission small: one feature surface, one clear before/after.

id: ${missionId}
name: ${title}
goal: TODO prove one small project surface, such as a pause menu, inventory panel, or title-to-gameplay transition.
recipe: ${recipe}
targeted_proof_tier: R
compare_expectation: change_expected
tier_required: 1
estimated_time_sec: 20

blocked_proof:
  what_blocked_higher_proof: This mission captures before/after runtime evidence, but cannot judge project intent or experience quality by itself.
  artifact_to_inspect: mission_runner/${missionId}/after.png
  human_should_check_next: Inspect before/after screenshots and the mission report, then confirm whether the observed change is intended.
  unresolved_question: Does this before/after evidence show the intended project behavior?

human_handoff:
  artifact_to_inspect: mission_runner/${missionId}/after.png
  check_next: Confirm the after screenshot shows the intended state, and update this mission with project-specific expectations.
  unresolved_question: What exact visual or runtime state should this mission prove next?

steps:
  - action: runtime_info
  - action: screenshot
    label: before

  # TODO interaction: replace this placeholder with the smallest real action.
  # Examples:
  # - action: press_button
  #   name: PauseButton
  # - action: click
  #   x: 480
  #   y: 270
  # - action: key
  #   args:
  #     action: ui_cancel
  - action: wait
    ms: 300

  - action: screenshot
    label: after
  - action: screenshot_diff
    a: before
    b: after
    issue_title: TODO expected visual change did not appear
  - action: check_errors
    label: post_mission_errors
`;
}

function renderTransitionMission({ missionId, recipe }) {
  const title = titleCaseFromId(missionId);
  return `# GRB mission scaffold pattern: transition.
# Use for title -> gameplay, menu -> panel, screen/state change, or one bounded before/after transition.
# Replace the TODO interaction with the smallest action that causes the transition.
# This captures evidence; it does not prove product correctness by itself.

id: ${missionId}
name: ${title}
goal: TODO prove one bounded transition, such as title to gameplay, menu to settings, or lobby to match.
recipe: ${recipe}
targeted_proof_tier: R
compare_expectation: change_expected
tier_required: 1
estimated_time_sec: 20

blocked_proof:
  what_blocked_higher_proof: This mission can capture before/after transition evidence, but a human must decide whether the resulting state is correct.
  artifact_to_inspect: mission_runner/${missionId}/after_transition.png
  human_should_check_next: Inspect before/after screenshots and confirm the after state is the intended transition target.
  unresolved_question: Did the transition reach the intended project state?

human_handoff:
  artifact_to_inspect: mission_runner/${missionId}/after_transition.png
  check_next: Confirm the after screenshot shows the intended destination state, then add any project-specific expectations.
  unresolved_question: What exact visual or runtime signal should prove this transition in future runs?

steps:
  - action: runtime_info
  - action: screenshot
    label: before_transition

  # TODO transition action: replace this with one real step.
  # Examples:
  # - action: press_button
  #   name: StartButton
  # - action: press_button
  #   name: EnterLabButton
  # - action: key
  #   args:
  #     action: ui_accept
  - action: wait
    ms: 300

  - action: screenshot
    label: after_transition
  - action: screenshot_diff
    a: before_transition
    b: after_transition
    issue_title: TODO expected transition did not change the visible state
  - action: check_errors
    label: transition_errors
`;
}

function renderToggleMission({ missionId, recipe }) {
  const title = titleCaseFromId(missionId);
  return `# GRB mission scaffold pattern: toggle.
# Use for open/close or hidden/visible UI surfaces: pause menu, inventory, map, settings, debug panel.
# Replace the TODO interaction with the smallest action that toggles the surface.
# This captures evidence; it does not prove product correctness by itself.

id: ${missionId}
name: ${title}
goal: TODO prove one toggleable UI surface, such as opening a pause menu, inventory panel, map, or settings overlay.
recipe: ${recipe}
targeted_proof_tier: R
compare_expectation: change_expected
tier_required: 1
estimated_time_sec: 20

blocked_proof:
  what_blocked_higher_proof: This mission can capture hidden/visible or closed/open evidence, but a human must decide whether the UI is correct.
  artifact_to_inspect: mission_runner/${missionId}/toggle_on.png
  human_should_check_next: Inspect before/after screenshots and confirm the toggled surface is visible and acceptable.
  unresolved_question: Did the toggle reveal the intended UI surface?

human_handoff:
  artifact_to_inspect: mission_runner/${missionId}/toggle_on.png
  check_next: Confirm the after screenshot shows the intended toggled state, then add any project-specific expectations.
  unresolved_question: What exact visual or runtime signal should prove this toggle in future runs?

steps:
  - action: runtime_info
  - action: screenshot
    label: toggle_off

  # TODO toggle action: replace this with one real step.
  # Examples:
  # - action: press_button
  #   name: TogglePanelButton
  # - action: press_button
  #   name: InventoryButton
  # - action: key
  #   args:
  #     action: ui_cancel
  - action: wait
    ms: 300

  - action: screenshot
    label: toggle_on
  - action: screenshot_diff
    a: toggle_off
    b: toggle_on
    issue_title: TODO expected toggle did not change the visible state
  - action: check_errors
    label: toggle_errors
`;
}

function renderMission({ missionId, recipe, pattern }) {
  if (pattern === "transition") return renderTransitionMission({ missionId, recipe });
  if (pattern === "toggle") return renderToggleMission({ missionId, recipe });
  return renderDefaultMission({ missionId, recipe });
}

export function scaffoldMission(options = {}) {
  const projectDir = resolveProjectDir(options.projectDir);
  const missionId = options.missionId;
  validateMissionId(missionId);
  const pattern = validatePattern(options.pattern);

  if (!isDirectory(projectDir)) {
    throw new Error(`Project path not found or not a directory: ${projectDir}`);
  }

  const missionsDir = path.join(projectDir, "grb", "missions");
  if (!isDirectory(missionsDir)) {
    throw new Error(`GRB missions directory not found: ${missionsDir}\nRun init first: node <path-to-grb-main>\\cli\\grb.mjs init --project "${projectDir}"`);
  }

  const missionPath = path.join(missionsDir, `${missionId}.yaml`);
  if (fs.existsSync(missionPath)) {
    throw new Error(`Mission already exists: ${missionPath}\nChoose a new mission id. This command does not overwrite existing missions.`);
  }

  const recipeInfo = options.recipe
    ? { recipe: options.recipe, source: "--recipe" }
    : readDefaultRecipe(projectDir);

  fs.writeFileSync(missionPath, renderMission({ missionId, recipe: recipeInfo.recipe, pattern }));

  return {
    projectDir,
    missionId,
    missionPath,
    pattern,
    recipe: recipeInfo.recipe,
    recipeSource: recipeInfo.source,
  };
}
