# Cloudflare agent setup for Bosphorly

Official Cloudflare setup: https://developers.cloudflare.com/agent-setup/prompt.md

This repository provides a project-level Cloudflare MCP registration for **Codex** in `.codex/config.toml`:
```toml
[mcp_servers.cloudflare]
url = "https://mcp.cloudflare.com/mcp"
```

## Codex

1. Open this repository in Codex as a trusted project. Codex reads project-local `.codex/config.toml` only for trusted projects.
2. In Codex, use `/plugins`, search for **Cloudflare**, and install the official Cloudflare plugin to add Skills and MCPs (recommended). Alternatively, from the project root install Cloudflare Skills with:
   ```bash
   npx -y skills add cloudflare/skills --skill '*' --yes
   ```
   The skills installer installs to the current project's agent directory; review changes before committing. Do not install the plugin and a duplicate set of Skills unless required.
3. If OAuth has not appeared during the first Cloudflare tool call, use:
   ```bash
   codex mcp login cloudflare
   ```
4. In the browser, sign in to the intended Cloudflare account and approve only the permissions you need. Check with `codex mcp list` and make a read-only Cloudflare account/Worker query to confirm access.

For a global CLI installation on your own machine, Cloudflare's direct setup method is:
```bash
npx -y skills add cloudflare/skills --skill '*' --yes --global
codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp
codex mcp login cloudflare
```
Do not add an unnecessary second MCP entry if the project config or the official plugin already provides one.

## Claude Code

On the machine or agent where Claude Code runs, follow the official plugin installation:
```bash
claude plugin marketplace add cloudflare/skills
claude plugin install cloudflare@cloudflare
```
Then run `/reload-plugins` inside Claude. Authenticate when prompted by the Cloudflare plugin.

## Deployment safeguards

- This setup **only registers an agent tool endpoint**. It does not authenticate a Cloudflare account, deploy the Worker, configure Cloudflare DNS, or change production traffic.
- Keep Cloudflare OAuth credentials, API tokens, Workers secrets, Turnstile secrets and Resend keys out of Git.
- Bosphorly's current domain/DNS and Google MX/SPF/DKIM records must remain untouched unless a separately reviewed migration explicitly requires changes.
- The Worker deployment is independent: the existing `backend/wrangler.jsonc` still needs real Cloudflare D1 and environment-specific secrets, and `config/api.js` still needs a deployed endpoint.
- Cloudflare's optional beta `cf` CLI is intentionally **not** installed here. Ask before installing it.

References: https://developers.cloudflare.com/agent-setup/codex/ and https://developers.cloudflare.com/agent-setup/prompt.md
