# DAEMON SDK — Mintlify documentation

## Project

- Published docs root: `mintlify/` (deploy path `/mintlify` in Mintlify dashboard)
- Engineering source (Markdown): `docs/` at repo root — sync into MDX when content changes
- **Never** publish `docs/private/**` via Mintlify or admin MCP

## MCP servers

| Server | URL | Use |
|--------|-----|-----|
| Docs (read) | `https://www.mintlify.com/docs/mcp` | `search_mintlify`, `query_docs_filesystem_mintlify` |
| Admin (write) | `https://mcp.mintlify.com` | `checkout`, `write_page`, `edit_page`, `save` → PR |

See [Using Mintlify MCP](/guides/using-mintlify-mcp).

## Style

- Second person, active voice, sentence case headings
- Root-relative links without extension: `/architecture/overview`
- Code blocks always have language tags
- No marketing filler; no emoji in body copy
- Use Mintlify components when they aid scanning: `Steps`, `Card`, `Note`, `Warning`

## Verify before PR

```bash
cd mintlify
npx mint broken-links
npx mint validate
npx mint dev
```
