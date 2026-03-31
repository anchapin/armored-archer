extends RefCounted

# GDScript source parser for identifying executable lines
# Implemented in: 13-01-PLAN.md Task 1

static func parse_executable_lines(file_path: String) -> Array:
	"""Parse GDScript file and return array of executable line numbers."""
	var file = FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		return []

	var executable_lines = []
	var line_number = 1
	var in_multiline_comment = false

	while not file.eof_reached():
		var line = file.get_line().strip_edges()

		# Skip multiline comments
		if line.begins_with('#'):
			line_number += 1
			continue

		# Track multiline comment state
		if "##" in line:
			in_multiline_comment = true
		if in_multiline_comment:
			line_number += 1
			if "##" in line:
				in_multiline_comment = false
			continue

		# Skip empty lines and comment-only lines
		if line.is_empty() or line.begins_with('#'):
			line_number += 1
			continue

		# Skip lines with only braces or punctuation
		if line in ['{', '}', '[', ']', '(', ')', ':', ';']:
			line_number += 1
			continue

		# This line has executable code
		executable_lines.append(line_number)
		line_number += 1

	file.close()
	return executable_lines

static func parse_autoload_directory() -> Dictionary:
	"""Parse all autoload scripts and build line number map."""
	var autoload_dir = "res://autoloads/"
	var line_map = {}

	var dir = DirAccess.open(autoload_dir)
	if dir:
		dir.list_dir_begin()
		var file_name = dir.get_next()

		while file_name != "":
			if file_name.ends_with('.gd'):
				var file_path = autoload_dir + file_name
				var lines = parse_executable_lines(file_path)
				line_map[file_path] = lines
			file_name = dir.get_next()

		dir.list_dir_end()

	return line_map
