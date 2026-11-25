# Mimo AI — independent assistant foundation

Experimental module for issue #122. This is a **disconnected scaffold**, not a running AI service. No changes to the existing Bosphorly assistant, public pages, backend, live deployment or SEO work.

## Boundary
- `createMimoCore({product, provider})` accepts a server-selected travel/general persona and an injected model adapter.
- `reply({message, locale})` is stateless. No user identity, tokens, database, history, real API calls or persistent memory.
- Tests use synthetic inputs and a mock provider. Never put customer chats or secrets in this public repository.
- The persona split is not an authorization or safety boundary; any future production endpoint must enforce identity, permissions, product and tenant isolation, content safety and quotas independently.

## Roadmap
1. Review existing Travel backend and extract adapters without changing its behavior; contract tests before migration.
2. Create an isolated private deployment/repository as appropriate; confirm brand/domain availability, provider licensing, cost ceiling, independent secrets and monitoring.
3. Separate web UI and account authentication, server-issued session identity, rate limits and abuse protection.
4. Opt-in memory, strict user/product scoping, retention controls, export/delete, audit and cross-account negative tests. No automatic copying of Travel chats. Provider data handling and privacy review required.
5. Streaming, accessibility, localization, tools and additional models; only after permission and cost controls.

Do not expose this as a public inference endpoint before the security, privacy and budget gates pass. No paid service or domain has been activated.
