# Pacing suite parse/discovery restoration

Use vendored inclusive assert_gte/assert_lte in three places. A thin inherited
wrapper discovers unchanged test bodies. Each test uses a fresh production
manager with only _ready service/save loading omitted and save_pacing_state
no-op. Classification initialization remains real. Tree attachment permits the
production fatigue color lookup; teardown frees the node. Live pacing autoload
and save files are not reset or modified by tests.

Godot4.6 focused25tests20pass4fail1risky,28/33assertions. Preserved failures:

- Max combat streak expected5, production6.
- High/critical fatigue expected70/85, production75/88.
- Critical break expected at least300seconds/narrative, production120/exploration.

Six-encounter conditional break test still asserts nothing, visibly risky.
No production tuning or expectation change is authorized here. This remains a
draft pending behavior adjudication, regardless of any broad CI tolerance.
Full699tests621pass5fail98risky versus main674tests601pass1fail97risky.
Scoped lint/diff checks pass. No reward, threshold, workflow or baseline change.
