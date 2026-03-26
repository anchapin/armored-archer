extends SceneTree

var _gut: Node
var _exit_code: int = 0

func _init():
	# Create GUT instance
	_gut = GutMain.new()

	# Add to tree
	root.add_child(_gut)

	# Run tests
	print("Running GUT tests...")
	_gut.test_scripts()

	# Wait for tests to finish
	_gut.end_run.connect(_on_tests_finished)

func _process(_delta: float):
	# Check if tests are done
	if not _gut.is_running():
		_on_tests_finished()

func _on_tests_finished():
	var summary = _gut.get_summary()

	if summary.failing > 0:
		_exit_code = 1
		print("FAILED: %d tests failed" % summary.failing)
	elif summary.pending > 0:
		_exit_code = 0
		print("WARNING: %d tests pending" % summary.pending)
	else:
		_exit_code = 0
		print("SUCCESS: All %d tests passed" % summary.passing)

	# Clean up and exit
	call_deferred("quit", [_exit_code])
