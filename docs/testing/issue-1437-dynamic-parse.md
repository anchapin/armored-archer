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
