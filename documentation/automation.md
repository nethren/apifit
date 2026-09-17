# Continuous integration

The GitHub workflow runs offline tests, repository hygiene checks and the
production frontend build on pushes and pull requests. A separate job builds
the deployment container and checks public-mode startup, AI-off readiness,
non-root volume writes and marker persistence after restart, with networking
disabled. It has read-only repository permissions, no provider
keys, no AI evaluation calls and no deployment credentials.

CI does not create infrastructure or publish a hosted app. A passing container
build does not test the real ingress, persistent disk, secret injection or DNS.
Those remain explicit release checks in the [deployment guide](deployment.md).

Use `npm ci` with the committed lockfile. Review dependency and base-image
updates before release; do not assume a previously passing build remains safe
forever. Do not expose secrets to untrusted pull-request code or introduce a
`pull_request_target` execution path for contributor code.
