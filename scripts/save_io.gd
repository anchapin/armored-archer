class_name SaveIO
extends RefCounted
## Crash-safe JSON save helper (issue #1723).
##
## Writes go to "<path>.tmp" first, then the previous good file is kept as
## "<path>.bak" and the temp file is renamed over the target. A kill mid-write (common on
## phones) can no longer leave a half-written save. Reads fall back to the
## ".bak" copy when the main file is missing or does not parse.
##
## Saved dictionaries get a "_version" field so later migrations can tell
## which layout they are reading.

const SAVE_VERSION: int = 1


static func write_json(path: String, data: Dictionary) -> bool:
	var payload: Dictionary = data.duplicate()
	payload["_version"] = SAVE_VERSION
	return write_text(path, JSON.stringify(payload))


static func write_text(path: String, text: String) -> bool:
	var tmp_path := path + ".tmp"
	var file := FileAccess.open(tmp_path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(text)
	file.close()
	_backup_previous(path)
	return DirAccess.rename_absolute(tmp_path, path) == OK


## Keeps the previous save as "<path>.bak" so a truncated or corrupt main
## file can still be recovered from the backup.
##
## Only a *good* previous file (one that parses) is copied over the backup:
## promoting a corrupt file into the backup slot would destroy the last
## known-good copy instead of protecting it.
static func _backup_previous(path: String) -> void:
	if not FileAccess.file_exists(path):
		return
	if _parse_file(path) == null:
		return
	DirAccess.copy_absolute(path, path + ".bak")


static func read_json(path: String) -> Variant:
	## Returns the parsed Dictionary or Array, or null when neither the main
	## file nor its backup holds valid JSON.
	for candidate in [path, path + ".bak"]:
		var parsed: Variant = _parse_file(candidate)
		if parsed != null:
			return parsed
	return null


static func _parse_file(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	var text := file.get_as_text()
	file.close()
	var json := JSON.new()
	if json.parse(text) != OK:
		return null
	if json.data is Dictionary or json.data is Array:
		return json.data
	return null
