extends RefCounted
## grb/1 wire protocol: parse requests, build responses, validate structure.

const PROTO_VERSION := "grb/1"

## Parse a JSON line into a validated request dictionary.
## Returns {"valid": true, "id": ..., "cmd": ..., "args": ..., "token": ...}
## or {"valid": false, "error_code": ..., "error_msg": ..., "id": ...}
static func parse_request(line: String) -> Dictionary:
	var json := JSON.new()
	var err := json.parse(line)
	if err != OK:
		return _parse_error("bad_json", "Malformed JSON: " + json.get_error_message(), "")

	var req: Variant = json.data
	if not req is Dictionary:
		return _parse_error("bad_json", "Request must be a JSON object", "")

	var req_id: String = str(req.get("id", ""))
	var proto: String = str(req.get("proto", ""))
	if proto != "" and proto != PROTO_VERSION:
		return _parse_error("bad_proto", "Unsupported protocol: %s (expected %s)" % [proto, PROTO_VERSION], req_id)

	var cmd: String = str(req.get("cmd", ""))
	if cmd == "":
		return _parse_error("bad_json", "Missing 'cmd' field", req_id)

	var args: Dictionary = {}
	var raw_args: Variant = req.get("args", {})
	if raw_args is Dictionary:
		args = raw_args

	var token: String = str(req.get("token", ""))

	return {
		"valid": true,
		"id": req_id,
		"cmd": cmd,
		"args": args,
		"token": token,
	}


static func _parse_error(code: String, msg: String, req_id: String) -> Dictionary:
	return {"valid": false, "error_code": code, "error_msg": msg, "id": req_id}


## Build a success response.
static func ok(req_id: String, data: Dictionary = {}) -> Dictionary:
	var resp := {"id": req_id, "ok": true}
	resp.merge(data)
	return resp


## Build an error response.
static func error(req_id: String, code: String, message: String, extra: Dictionary = {}) -> Dictionary:
	var resp := {"id": req_id, "ok": false, "error": {"code": code, "message": message}}
	if not extra.is_empty():
		resp["error"].merge(extra)
	return resp


## Serialize a response dictionary to a JSONL line (with trailing newline).
static func serialize(resp: Dictionary) -> String:
	return JSON.stringify(resp) + "\n"
