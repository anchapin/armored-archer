# ThemeToggle mode API repair

ThemeToggle called missing is_dark_theme/set_theme manager methods, subscribed
its bool callback to a String signal, and toggled accessibility instead of mode.
Use existing is_dark_mode/set_theme_mode/toggle_theme_mode APIs and the bool
mode-only dark_mode_changed signal. Retain local fallback and public component API.
An injected detached manager allows persistence-free regression tests; normal
instances still use the autoload. Tree exit disconnects the same mode signal.

Godot4.6 focused regression suite:6tests6pass26assertions. Same new tests against
old production source:6fail, including missing APIs and String-to-bool errors.
Full run680tests607pass1fail97risky, versus same-session baseline674tests601pass
1fail97risky; same152errors26warnings42orphans. Existing theme-consistency failure
unchanged; committed baseline gate passes. Scoped lint/diff checks pass.

Rendered both mode labels with actual component code in a640x240 viewport and
inspected pixels. Labels switch correctly, but pre-existing dark button styling
has weak contrast for Light text, and this Linux renderer lacks the dark emoji
glyph. No palette/font/layout redesign in this API repair. Visual quality is not
claimed clean; target-device font coverage remains unverified.

The separate legacy UI suite still needs its coroutine/signal/loading fixtures
restored. Its disabled-state mismatch calls native set_disabled rather than the
component's existing apply_disabled API; no production callers requiring a
behavior change were found in scenes/scripts.
