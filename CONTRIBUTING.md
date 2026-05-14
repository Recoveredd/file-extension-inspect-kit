# Contributing

Thanks for taking the time to improve `file-extension-inspect-kit`.

## Local Setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Pull Requests

- Keep the package dependency-free at runtime.
- Keep the public API small and explicit.
- Add tests for every behavior change.
- Prefer stable diagnostics over thrown errors for expected invalid input.
- Update the README when user-facing behavior changes.

## Release Checklist

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```
