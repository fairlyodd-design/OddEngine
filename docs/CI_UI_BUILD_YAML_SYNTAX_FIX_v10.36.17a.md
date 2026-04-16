# v10.36.17a CI UI Build YAML Syntax Fix Pass

Fixes the invalid workflow syntax in `.github/workflows/ci-ui-build.yml` caused by broken indentation under `steps`.

## What it fixes

The broken workflow had this shape:

```yaml
- name: Install UI dependencies
  run: npm ci --include=dev

- name: Verify Vite exists
  run: ls -la node_modules/vite/bin
```

…but the `run:` line and following `- name` entries were not indented under `steps`, so GitHub reported a YAML syntax error around line 45.

## What this pass changes

- Rewrites `.github/workflows/ci-ui-build.yml` with valid YAML indentation.
- Keeps the same UI install/build intent.
- Updates UI CI to Node 24 and Node 24 action runtime opt-in.
- Adds typecheck and dist verification for clearer failures.

## Apply

```powershell
.\APPLY_v10.36.17a_CIUIBuildYamlSyntaxFixPass.bat
.\RUN_v10.36.17a_CI_UI_BUILD_YAML_CHECK.bat
```
