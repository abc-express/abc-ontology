# DAEMON SDK — Mintlify site

Professional documentation for the public DAEMON SDK monorepo. Deploy this directory from the monorepo root.

## Local preview

Mintlify CLI requires **Node LTS** (20 or 22). It does **not** run on Node 25+.

```bash
# If you use nvm and default is Node 25:
nvm use 22
cd mintlify
npx mint dev
```

Open the URL printed in the terminal (often http://localhost:3000).

```bash
npx mint validate
npx mint broken-links
```

## Dashboard setup

1. Create or connect a Mintlify project at [mintlify.com/start](https://mintlify.com/start).
2. In **Git settings**, enable monorepo and set documentation path to `/mintlify`.
3. Push to your default branch; Mintlify deploys on git push.

## Authoring with MCP

See [guides/using-mintlify-mcp.mdx](./guides/using-mintlify-mcp.mdx) (published as `/guides/using-mintlify-mcp`).

## Sync from `docs/`

Engineering docs live in `../docs/*.md`. When updating architecture content, either:

- Edit MDX here directly, or
- Update Markdown in `docs/` and ask an agent (with Mintlify Docs MCP) to port changes into `mintlify/`.
