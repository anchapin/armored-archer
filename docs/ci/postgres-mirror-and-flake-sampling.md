# CI Postgres mirrors and backend flake sampling

Required test and coverage gates are unchanged. Backend flake sampling is
advisory and scheduled weekly, not part of the push or required-job graph.
It runs two full Jest suites, with a five-minute process budget per suite
and a fifteen-minute job budget. A missing report, suite execution error,
changing test identities or timeout fails the advisory job as incomplete.
Skipped tests never count as passes. Intermittent and consistent failures
are reported separately. JSON and Markdown artifacts live for seven days.
Two observations are a sample, not proof of flake freedom. Historical data
in these artifacts covers this run; history is not committed automatically.

The manual `Mirror Pinned CI Postgres` workflow copies the exact public ECR
Postgres 14/15 alpine manifest digests in `.github/ci/postgres-mirrors.json`
to `ghcr.io/anchapin/armored-archer/ci-postgres`, without rebuilding or changing
Postgres versions. Only that publisher job has `packages: write`, using its
short-lived repository token. It runs only on main and verifies the copied
manifest digest. New upstream digests need a reviewed change to the pins,
then a manual refresh. There is no automatic tag drift or fallback registry.

Bootstrap order: land the publisher, dispatch it, make the upstream-only
package public, verify anonymous digest pulls, then land consumer references.
Public visibility is needed for read-only/anonymous service-container pulls.
The copier can still fail if the upstream registry is unavailable or capped;
consumer CI uses GHCR after bootstrap. GHCR outages remain possible. The
separate Nakama image and local development compose are unchanged.

Consumer rollback: revert only the three CI consumer files to the prior
public ECR references. This restores the old endpoint and its known data-cap
risk; it does not weaken required gates or remove the published package.
