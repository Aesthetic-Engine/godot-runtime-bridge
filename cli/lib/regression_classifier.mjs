export function classifyRegression(parts, expectation = "no_unintended_change") {
  const statuses = Object.values(parts).map((part) => part.status);

  if (statuses.includes("blocked")) {
    return {
      result: "blocked",
      human_review_required: true,
      reason: "Comparison could not pair or read enough artifacts.",
    };
  }

  if (statuses.includes("regression_suspected")) {
    return {
      result: "regression_suspected",
      human_review_required: true,
      reason: "Candidate run has a worse issue/error surface than the baseline.",
    };
  }

  if (statuses.includes("difference_detected")) {
    return {
      result: expectation === "change_expected" ? "difference_detected" : "human_review_required",
      human_review_required: true,
      reason: "Differences were detected and need human interpretation.",
    };
  }

  return {
    result: "matched",
    human_review_required: false,
    reason: "Compared artifacts matched within the current GRB comparison checks.",
  };
}
