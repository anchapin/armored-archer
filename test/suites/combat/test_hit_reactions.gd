# Issue #1823: the hit-reaction tests live in test/test_hit_reactions.gd and
# are pulled into the GUT run (res://test/suites) through this shim, the same
# way the other stranded suites are discovered. No test bodies are copied
# here; the shim only makes the suite visible to the runner.
extends "res://test/test_hit_reactions.gd"
