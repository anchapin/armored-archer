const { rpcCreateMatch } = require("../matchmaker");
const { createMockLogger, createMockContext, createMockNakama } = require("../../__mocks__/nakama");

const mockCtx = createMockContext();
const mockLogger = createMockLogger();
const mockNk = createMockNakama();

console.log("Mock context:", mockCtx);
console.log("Mock context userId:", mockCtx.userId);

const payload = JSON.stringify({ 
  match_type: "ranked", 
  target_opponent_id: "target-user" 
});

console.log("Calling rpcCreateMatch...");
const result = rpcCreateMatch(mockCtx, mockLogger, mockNk, payload);
console.log("Result:", typeof result, result);

if (result) {
  const parsed = JSON.parse(result);
  console.log("Parsed result:", parsed);
  console.log("Success:", parsed.success);
  console.log("Match opponent_id:", parsed.match?.opponent_id);
} else {
  console.log("Result was undefined");
}

console.log("Test completed");