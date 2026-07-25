# Security model

[Russian version](../ru/security.md)

ApexHUD treats Community modules as untrusted code. Module iframes are sandboxed, Node integration is disabled, context isolation is enabled, and direct Electron IPC/filesystem access is unavailable. Assets are exposed through a custom protocol that normalizes paths and confines requests to an approved module root.

The host filters each telemetry frame to scopes declared in `manifest.json`. This is capability reduction, not a secrecy boundary: race telemetry is not sensitive authentication material. Modules must not receive arbitrary filesystem paths, process APIs, or network credentials.

Telemetry HTTP/WebSocket endpoints bind only to loopback. Do not change this to `0.0.0.0` without authentication, origin controls, and an explicit threat review.

A module remains executable JavaScript. Sandboxing reduces impact but cannot make malicious UI harmless. Review source, pin trusted catalog commits/releases, and report vulnerabilities privately according to root `SECURITY.md`.

Do not put secrets in manifests, layout settings, screenshots, logs, or the Community repository. Do not weaken Content Security Policy to allow broad remote script execution.
