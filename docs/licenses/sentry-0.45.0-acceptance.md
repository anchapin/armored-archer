# Sentry 0.45.0 restricted-license acceptance

Decision date: October 12, 2026. Owner: Alex Chapin.

The owner accepted the new transitive `sentry@0.45.0` dependency for Armored
Archer's non-competing game telemetry and build tooling, with license notices
retained. This records that scoped decision. It does not approve all FSL
packages, future versions, or competing monitoring products.

## Package boundary

The dependency update in PR #1527 changes `@sentry/node` to 11.6.0. The Node
SDK remains MIT. Its chain through `@sentry/bundler-plugins@11.6.0` adds the
`sentry@0.45.0` CLI/tool package licensed FSL-1.1-Apache-2.0. The license flag
is on that transitive package, not a finding that the SDK is exploitable.

## Conditions and notices

- Use is limited to non-competing game telemetry/build tooling. Re-review any
  use that provides a commercial substitute for Sentry or substantially
  similar functionality.
- When redistributing copies, modifications or derivatives of this package,
  include its license text or a link and retain copyright notices.
- Keep `sentry-0.45.0-LICENSE.md` with distributed notices whenever this package
  is included. Build/deployment packaging must not strip these notices.
- The future Apache-2.0 grant applies on the second anniversary of this
  version's availability, not immediately. Do not substitute an Apache-only
  notice before verifying the applicable availability date.
- Re-review a version change, dependency-chain change, packaging change or
  change in use. This is an owner acceptance record, not legal advice or an
  unconditional compliance certification.

## Check treatment

The Sourcery/Trivy finding is an unrecognized-license review flag. Any triage
must be limited to the exact reviewed finding and include this decision and
package/version scope as its reason. Do not ignore FSL globally, suppress all
license checks, or hide unrelated findings. The finding must be reviewed and
its updated check status verified; a documentation commit alone does not turn
its red check green. All other PR and main CI gates remain required.

## Sources

- Exact package license: https://cdn.jsdelivr.net/npm/sentry@0.45.0/LICENSE.md
- Dependency PR and lockfile review: https://github.com/anchapin/armored-archer/pull/1527
- Finding-specific triage: https://docs.sourcery.ai/security/triage/
