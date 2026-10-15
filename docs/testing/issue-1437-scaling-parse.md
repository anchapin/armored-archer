# Difficulty scaling suite parse/discovery restoration

Replace16absent assert_ge/assert_le calls with inclusive vendored
assert_gte/assert_lte equivalents. Thin inherited configured discovery script
reuses original bodies, without changing any gameplay expectation.

Godot4.6 focused run discovers11tests:0pass,11risky,0assertions. Every test
returns before its assertions because DifficultyScalingManager is absent from
the current tracked tree and project autoload list. This is visible unimplemented
coverage, not a working scaling system or an all-passing suite. Do not fabricate
a production manager or weaken checks to turn this green.

Full configured run685tests601pass1fail108risky, versus unchanged main baseline
674tests601pass1fail97risky. Existing theme-consistency failure remains; baseline
gate passes. Scoped lint/diff checks pass. No production, reward, threshold,
workflow or baseline changes.
