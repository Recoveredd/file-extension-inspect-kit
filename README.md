# file-extension-inspect-kit

[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Recoveredd/file-extension-inspect-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/Recoveredd/file-extension-inspect-kit/actions/workflows/ci.yml)

Inspect file extensions from filenames or path-like strings with explicit policies for dotfiles, extensionless names, compound extensions and invalid input.

`file-extension-inspect-kit` is a small clean-room toolkit for upload forms, import pipelines, asset validators and browser-side developer tools. It is intentionally narrower than a full path parser or MIME detector.

Links: [Demo](https://packages.wasta-wocket.fr/file-extension-inspect-kit/) · [GitHub](https://github.com/Recoveredd/file-extension-inspect-kit)

## Package quality

- TypeScript types are generated from the source.
- ESM-only package with no runtime dependencies.
- Marked as side-effect free for bundlers.
- Browser-friendly implementation with no Node-only APIs.
- CI runs `npm ci`, `typecheck`, `build`, and `test`.
- Tested on Node.js 20 and 22 with GitHub Actions.

## Publication status

This package is currently a GitHub preview and is queued for npm publication. The browser demo is available now, and the install command below is the command to use once the npm package is published.

## Install after npm publication

```bash
npm install file-extension-inspect-kit
```

## Quick Start

```ts
import {
  createFileExtensionInspector,
  getFileExtension,
  hasFileExtension,
  inspectFileExtension
} from "file-extension-inspect-kit";

getFileExtension("archive.tar.gz");
// "gz"

inspectFileExtension("  report.PDF  ");
// {
//   ok: true,
//   input: "report.PDF",
//   fileName: "report.PDF",
//   extension: "pdf",
//   diagnostics: ["input-trimmed"],
//   ...
// }

inspectFileExtension("/uploads/.env", { dotfile: "name" });
// {
//   ok: true,
//   input: "/uploads/.env",
//   fileName: ".env",
//   stem: ".env",
//   effectiveStem: ".env",
//   extension: "",
//   compoundExtension: "",
//   effectiveExtension: "",
//   segments: [],
//   diagnostics: ["dotfile-treated-as-name"]
// }

const archives = createFileExtensionInspector({
  compoundExtensions: ["tar.gz", "tar.bz2"]
});

archives.inspect("backup.tar.gz");
// {
//   ok: true,
//   fileName: "backup.tar.gz",
//   stem: "backup.tar",
//   effectiveStem: "backup",
//   extension: "gz",
//   compoundExtension: "tar.gz",
//   effectiveExtension: "tar.gz",
//   segments: ["tar", "gz"],
//   diagnostics: ["compound-extension-matched"],
//   ...
// }

hasFileExtension("avatar.PNG", [".jpg", "png"]);
// true
```

## Why This Package

Filename extension checks are deceptively small. Dotfiles, compound extensions and extensionless names often produce quiet edge-case bugs:

- `.env` can be treated as a name, an extension, or no extension depending on your product.
- `archive.tar.gz` may need `gz` for a simple check or `tar.gz` for an archive validator.
- `Makefile` might be extensionless or a known extension-like name.
- Pasted input often contains harmless surrounding whitespace.
- UI display may need original casing while validation should still be case-insensitive.
- UI validation often needs diagnostics, not just an empty string.

This package makes those choices explicit and keeps the result inspectable.

## API

### `inspectFileExtension(input, options?)`

Returns a structured result. Expected invalid values return `{ ok: false }` instead of throwing.

```ts
const result = inspectFileExtension("archive.tar.gz", {
  compoundExtensions: ["tar.gz"]
});

if (result.ok) {
  result.extension;
  // "gz"

  result.effectiveExtension;
  // "tar.gz"
}
```

Successful results include:

```ts
type FileExtensionInfo = {
  ok: true;
  input: string;
  fileName: string;
  stem: string;
  effectiveStem: string;
  extension: string;
  compoundExtension: string;
  effectiveExtension: string;
  segments: string[];
  diagnostics: FileExtensionDiagnostic[];
};
```

### `getFileExtension(input, options?)`

Returns only the final extension string, or an empty string when no extension is found.

```ts
getFileExtension("photo.JPEG");
// "jpeg"

getFileExtension("photo.JPEG", { caseMode: "preserve" });
// "JPEG"
```

### `hasFileExtension(input, expected, options?)`

Checks one extension or a list of extensions. Leading dots are accepted in `expected`.

```ts
hasFileExtension("avatar.PNG", [".jpg", "png"]);
// true

hasFileExtension("backup.tar.gz", "tar.gz", {
  compoundExtensions: ["tar.gz"]
});
// true

hasFileExtension("avatar.PNG", "png", {
  caseMode: "preserve"
});
// true

hasFileExtension("avatar.PNG", "png", {
  caseMode: "preserve",
  caseSensitive: true
});
// false
```

### `splitFileExtension(input, options?)`

Returns the final and effective split for successful inputs.

```ts
splitFileExtension("index.d.ts", {
  compoundExtensions: ["d.ts"]
});
// {
//   stem: "index.d",
//   effectiveStem: "index",
//   extension: "ts",
//   effectiveExtension: "d.ts"
// }
```

### `createFileExtensionInspector(defaultOptions?)`

Creates a small inspector object that reuses the same defaults across a form, importer or validator. Per-call options override the defaults.

```ts
const inspector = createFileExtensionInspector({
  compoundExtensions: ["d.ts", "tar.gz"],
  dotfile: "name"
});

inspector.get("index.d.ts");
inspector.has("archive.tar.gz", "tar.gz");
inspector.split(".env");
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `caseMode` | `"lower"` | Lowercase returned extensions. Use `"preserve"` to keep original casing in returned values. |
| `caseSensitive` | `false` | Match `compoundExtensions` and `hasFileExtension` values case-insensitively by default. |
| `trim` | `true` | Trim surrounding whitespace before inspecting the filename. |
| `dotfile` | `"name"` | How single-segment dotfiles such as `.env` are treated: `"name"`, `"extension"`, or `"empty"`. |
| `extensionless` | `"empty"` | How names without dots are treated: `"empty"` or `"name"`. |
| `compoundExtensions` | `[]` | Known compound extensions such as `"tar.gz"` or `"d.ts"`. Leading dots are accepted. |

## Diagnostics

Diagnostics are stable strings intended for logs, UI hints or tests:

- `empty-input`
- `blank-input`
- `input-trimmed`
- `path-ends-with-separator`
- `dotfile-treated-as-name`
- `dotfile-treated-as-extension`
- `extensionless-treated-as-name`
- `compound-extension-matched`

## Limits

This package scans the final filename segment in a string. It does not:

- normalize paths;
- resolve directories;
- touch the filesystem;
- infer MIME types;
- validate whether an extension is safe;
- parse URLs or remove query strings;
- replace Node's `path.parse`.

Use it as a small extension-inspection layer before product-specific validation.

## License

MPL-2.0
