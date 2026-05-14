# Security Policy

## Supported Versions

Security fixes are handled on the latest published version.

## Reporting a Vulnerability

Please report vulnerabilities through GitHub Security Advisories when available, or by opening a minimal private report with:

- the affected version;
- the smallest input that reproduces the issue;
- the expected impact;
- any relevant environment details.

Please do not publish exploit details before there is time to investigate and release a fix.

## Scope

`file-extension-inspect-kit` does not read files, resolve paths, access the network, execute code, or infer MIME types. It only inspects string input. Security reports should focus on parsing behavior that can cause incorrect validation, denial of service, or misleading diagnostics.
