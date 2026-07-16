export function formatBridgeError(result) {
  if (result?.error) {
    return `${result.error.code}: ${result.error.message}`;
  }
  if (result?.error_msg) {
    return result.error_code
      ? `${result.error_code}: ${result.error_msg}`
      : String(result.error_msg);
  }
  return JSON.stringify(result);
}

export function formatQuitResult({ hadSession, quitAcknowledged }) {
  if (!hadSession) {
    return "No active GRB session to quit.";
  }
  if (quitAcknowledged) {
    return "Game quit successfully.";
  }
  return "GRB session closed locally; the runtime did not acknowledge quit.";
}
