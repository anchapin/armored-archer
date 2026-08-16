# Match settlement is server-declared only

Status: accepted

`armored_archer/complete_match` accepted a client-asserted `winner_id`/`loser_id` and settled Elo, XP, and rewards without cross-checking the server's own match state — a parallel completion authority beside `combat_system.ts`'s server-side resolution (health-zero, forfeit, timeout), in a product whose core promise is server authority. We decided the server's match state is the *sole* source of winner truth: the client may trigger settlement but never assert outcomes; the client's winner claim becomes, at most, advisory logging.

## Considered Options

- Dual path + validation (reject calls disagreeing with match state) — rejected: still two authorities racing on the same settlement; deleting the concept of client-asserted outcomes is simpler and matches the PRD's "clients send actions, not results."
