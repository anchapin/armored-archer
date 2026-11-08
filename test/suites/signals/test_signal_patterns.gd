extends GutTest

# Signal testing patterns (issue #1749).
#
# The three tests below were pending stubs (issue #1361). They now exercise
# GUT's real signal-testing API:
#   - watch_signals() + assert_signal_emitted()
#   - await wait_for_signal(signal, timeout)
#   - assert_signal_emitted_with_parameters()
#
# The fixture below is a tiny signal emitter that lives entirely in this file,
# so the suite needs no production/autoload code.

# Minimal signal emitter used as the fixture for these tests.
class SignalEmitter extends Node:
	signal fired(value)
	signal quiet

	func emit_fired(value: int) -> void:
		fired.emit(value)

var emitter: SignalEmitter

func before_each():
	emitter = SignalEmitter.new()
	add_child_autofree(emitter)

func after_each():
	emitter = null

func test_watch_signals_basic():
	watch_signals(emitter)
	emitter.emit_fired(1)

	assert_signal_emitted(emitter, "fired")
	assert_signal_emitted(emitter.fired)
	assert_eq(get_signal_emit_count(emitter, "fired"), 1)
	assert_signal_not_emitted(emitter, "quiet")

	emitter.emit_fired(2)
	assert_eq(get_signal_emit_count(emitter, "fired"), 2)

func test_wait_for_signal_async():
	watch_signals(emitter)
	# Deferred so the signal arrives while wait_for_signal() is waiting.
	emitter.call_deferred("emit_fired", 42)

	var got_signal: bool = await wait_for_signal(emitter.fired, 1.0)
	assert_true(got_signal, "wait_for_signal should report that the signal was emitted")
	assert_signal_emitted(emitter, "fired")
	assert_eq(get_signal_parameters(emitter, "fired"), [42])

func test_signal_emission_with_parameters():
	watch_signals(emitter)
	emitter.emit_fired(7)

	assert_signal_emitted_with_parameters(emitter, "fired", [7])
	assert_signal_emitted_with_parameters(emitter.fired, [7])

	emitter.emit_fired(8)
	assert_signal_emitted_with_parameters(emitter, "fired", [8])
	assert_eq(get_signal_parameters(emitter, "fired", 0), [7])
	assert_eq(get_signal_parameters(emitter, "fired"), [8])
