# Language and engine matrix

The `language/` tree defines schema, mapping, query, rule, policy, command, and workflow grammars validated by `@daemon/cli` and toolchain plugins.

| Engine | Crate / module | Role |
|--------|----------------|------|
| data-engine | `engine/data-engine` | Canonical records, validation |
| logic-engine | `engine/logic-engine` | Rules and inference |
| action-engine | `engine/action-engine` | Command dispatch |
| security-engine | `engine/security-engine` | Policy evaluation hooks |

TypeScript facades in domain packages call into Rust/Go runtimes over HTTP or FFI where applicable.
