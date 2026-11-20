# Run the legacy smoke test inside GUT.
#
# Reason this file is shimmed rather than deleted (issue #1852): the body is a
# single `assert_true(true)` and therefore asserts nothing about production
# code, but it is still a valid runner smoke check (it proves the GUT runner
# executed at least one script). Deleting it would drop that smoke signal, so
# the legacy file is kept at test/simple_test.gd and wired into GUT from here
# instead of being stranded outside the suites directory.
extends "res://test/simple_test.gd"
