# CI UI Build npm install fallback

The repo's primary runtime build workflow and local recovery checks use `npm install` for the UI lane. The separate `ci-ui-build.yml` workflow was stricter with `npm ci --include=dev`, which can fail when lockfile state differs from package metadata.

This pass aligns the UI workflow with the passing local command path and adds breadcrumbs for future failures.
