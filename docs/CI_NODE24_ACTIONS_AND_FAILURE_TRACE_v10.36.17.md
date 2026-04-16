# CI Node24 actions and failure trace — v10.36.17

This pass updates only `.github/workflows/ci.yml` and helper scripts/docs.

The Node20 deprecation warning is not usually the actual failing command, but it creates noise in the summary. The workflow now opts into Node24 action runtime and uses Node24-compatible major versions of official actions.

Expected workflow flow:

1. Checkout
2. Setup Node 24
3. Show runtime
4. Validate OddEngine shape
5. Install UI dependencies
6. Runtime import audit
7. Typecheck audit lane
8. Build UI
9. Verify dist artifact
10. Upload UI dist
11. Failure breadcrumbs, only if a prior step failed

If CI still exits with code 1 after this pass, the failure breadcrumbs should make the real command visible.
