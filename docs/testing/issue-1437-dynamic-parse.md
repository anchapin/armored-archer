# Dynamic difficulty suite parse/discovery restoration

Six absent comparison helpers become inclusive vendored assert_gte/assert_lte.
Thin configured discovery wrapper reuses original bodies. Every test uses a
fresh detached production manager with only save_difficulty_state overridden;
_ready service connections/save loading do not run. Teardown frees the node.
Actual difficulty/reward logic remains unchanged and executes.

Godot4.6 focused20tests17pass3fail27/30assertions. Preserved failures:

- Tests expect adjustment after three wins/losses; production waits for four.
- Extreme reward expectation1.4x differs from existing client1.5x.

Neither historical test target nor current client value approves server rewards.
No threshold, reward or expectation changes are included. Remains draft pending
behavior adjudication, even if broad CI tolerance permits the count.
Full694tests618pass4fail97risky versus main674tests601pass1fail97risky.
Scoped lint/diff checks pass. No production, workflow or baseline changes.

## Owner decisions applied, October 15

The owner selected a four-game streak and matching the existing client's 1.5x
Extreme reward target. Tests now check no adjustment after three results, then
an adjustment on the fourth. Extreme expectation is 1.5x. These test targets do
not implement or authorize a server reward settlement change.

Focused: 20 tests pass, 32 assertions. Full: 694 tests, 621 pass, one existing
theme-consistency failure, 97 risky; paired XML/baseline gate passes. Scoped lint
and diffcheck pass. Historical red result above is diagnostic history, not a
waiver. No production, workflow or baseline change in this test restoration.
