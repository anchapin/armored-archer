# Discover the legacy pixel-art functional asset expectations in GUT without
# copying test bodies; the assets and scenes live under assets/ and scenes/.
# The legacy file was converted to the GUT lifecycle (issue #1852): resources
# are loaded in before_each() and the stale node-name assertions now target
# the nodes the current scenes actually ship.
extends "res://test/functional_asset_test.gd"
