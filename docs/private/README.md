# Private governance document vault

This directory holds **client governance sources** and derived **client definition** artifacts. Contents under `sources/`, `extracted/`, and `client-definition/` are **gitignored** and must not be committed to a public repository.

## Layout

| Path | Purpose |
|------|---------|
| `sources/` | Original PDF/DOCX files (copy from secure storage) |
| `extracted/` | Plain-text / markdown extractions for diff and review |
| `client-definition/` | Client-facing definition pack (`00`–`09`) |

## Document register

| ID | Filename | Version | Precedence | Extraction |
|----|----------|---------|------------|------------|
| DOC-01 | `Charter_<client>_v1_0.docx` | 1.0 | 1 (highest) | done |
| DOC-02 | `Manifesto_<client>_v1_2_1.docx` | 1.2.1 | 2 | done |
| DOC-03 | `Ontology_Master_v2_0_3.pdf` | 2.0.3 | 3 | done |
| DOC-04 | `Technology_OS_v1_1_1.pdf` | 1.1.1 | 4 | done |

**Deliverables:**

| Artifact | Path |
|----------|------|
| Client definition pack | `client-definition/00`–`09` |
| **PRD (implementation, private)** | `client-definition/PRD-logistics-ontology-extension.md` |
| Public PRD stub (committed) | `docs/PRD-logistics-commercial-extension.md` |
| Structured outlines | `extracted/outline-*.md` |

**Recommended order:** definition pack → **PRD** → engineering (R1/R2).

Precedence on conflict: Charter → Manifesto → Ontology Master → Technology OS.

Machine-readable SSOT for CI and runtime remains under `configs/ontology/`, `configs/governance/`, and `configs/policies/`. See [../08-semantic-governance-alignment.md](../08-semantic-governance-alignment.md).

## Refresh workflow

1. Copy updated sources into `sources/`.
2. Re-run extraction (see `extracted/README.md` if present).
3. Regenerate `client-definition/` from outlines + repo traceability.
