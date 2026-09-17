# Security and responsible reporting

Please do not put credentials, private requests or exploit details in public
issues. Use GitHub's private vulnerability reporting if enabled for this
repository; otherwise ask the repository owner for a private contact channel
without including the sensitive details. There is no guaranteed response SLA.

Provide the affected revision, fictional reproduction inputs, expected and
observed behaviour, and the boundary crossed. Do not probe third-party systems,
run billable requests or access other users' data to demonstrate a finding.

## Supported boundaries

- Local mode binds to loopback and checks Host and browser origin.
- Hosted mode requires exact-origin HTTPS ingress. Public access is explicitly
  configured; a password gate is optional. Visitor records are isolated by an
  expiring secure cookie. This is not an individual account system.
- Public-document retrieval checks destinations, resolves and pins public
  addresses, rechecks redirects and bounds payloads. Private network endpoints,
  embedded credentials and arbitrary ports are rejected.
- MCP inspection reads advertised tools only; it does not invoke them or install
  packages. Documentation and tool descriptions are untrusted model input.
- Model output is schema-checked and citations are checked against supplied
  excerpts. These controls do not prove semantic correctness.
- AI uses an operator credential on the backend, explicit browser consent,
  bounded calls and a durable cumulative budget with conservative reservations.
- Private requests and generated records are not persisted by APIFit. Runtime
  secrets, local cost state and generated private output are excluded from Git.

See [deployment requirements](documentation/deployment.md) and
[data handling](documentation/permissions.md). Do not expose the local server
through a public tunnel or skip HTTPS because the application has a password.
Infrastructure logs, third-party retention, dependency vulnerabilities and
public abuse and optional password distribution still need operator care. Public
visitors can exhaust the shared AI allowance or capacity despite the quotas;
the spending cap is not an availability guarantee. Passing tests is not a
security certification.
