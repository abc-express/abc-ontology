# DAEMON sebagai Pondasi `antero-platform`

**Tanggal:** 2026-06-05 (diperbarui) · **Disiapkan untuk:** Plt. CTO / Tim Dev ANTERO, ABC Express Group
**Sumber:** DAEMON `@d7a76d1`, Technology OS v1.1.1, Manifesto v1.2.1, Charter v1.0, Ontology Master 0A
**Program:** ANTERO + Parity Full Program (Gate 0 tutup · Fase 1 shadow read-only · Tier 1 ABC subset)
**Lensa:** Skunk Works (arsitektur), DHL (logistik/operasi), HedgeFund (kelayakan IPO & risiko). Zero-failure, no false-positive.

---

## Ringkasan eksekutif

DAEMON bukan sekadar *bisa* menjadi pondasi `antero-platform` — DAEMON **sudah dirancang sebagai pondasi itu**. Bukti di repo: pack ontologi `logistics-commercial` berisi persis entitas ANTERO (Shipment, Manifest, Dispatch, Trip, Order, RoutingDecision, Lead, Opportunity, Pipeline, Signal, TTK, Account), toolchain `scripts/abc-express/` yang membaca skema Supabase ANTERO sungguhan (`schema_columns.json`, `migrate_supabase_to_clickhouse.py`), dan `configs/governance/propagation.yaml` yang bertanda *"Technology OS alignment"*.

Yang dituntut Technology OS — ANTERO bertransformasi dari **data warehouse → decision-making factory**, dengan **propagasi top-down** dan **ontology conformance ke 0A** — adalah persis bentuk arsitektur DAEMON (collect-sensing → ontology → read-write-loops → action-runtime). Kecocokannya struktural, bukan kebetulan.

**Update Gate 0 (2026-06-05, `@d7a76d1`):** Empat temuan CRITICAL audit asli (C1–C4) **sudah dimitigasi** di gateway — `resolveBound` + `TenantScopeGuard`, `@Protected()` pada route data, policy check ber-principal, webhook HMAC fail-closed saat `DAEMON_WEBHOOK_REQUIRE_HMAC=1` / mode produksi. Bukti: `tests/integration/gateway-security.test.ts`, `tests/tenancy/isolation.test.ts` (termasuk `abc-antero` / `abc-arandy` / `abc-holding`), `pnpm run test:repo` hijau.

**Residual (bukan blocker Fase 1 shadow):** RBAC/ABAC/RLS penuh belum di hot path (H1 audit); JWT dev-mode tanpa verifikasi tanda tangan (H2); default `daemon-dev-key` hanya untuk dev lokal. Fase 1 read-only **dapat dimulai** dengan kredensial tenant-bound + HMAC webhook wajib di staging.

---

## 1. Mengapa ini cocok: pemetaan 6-Tingkat → DAEMON

Arsitektur 6-Tingkat ABC Express memisahkan *makna* (Tingkat 0–4) dari *implementasi berjalan* (Tingkat 5). DAEMON adalah mesin yang mengeksekusi pemisahan itu tanpa drift.

| Tingkat ABC Express | Artefak | Peran DAEMON |
|---|---|---|
| **0A** Ontology Master | Konstitusi ontologi 12-Layer | `ontology/` (registry, semantic-layer, packs) = SSOT semantik. Pack base + extension memetakan 0A → schema yang dapat dieksekusi. |
| **1** Strategi | Strategic Roadmap | Tetap di dokumen; DAEMON tidak menyetir strategi. |
| **2** Technology OS | APA/MENGAPA fungsi teknologi | DAEMON = realisasi teknis dari Technology OS (standar arsitektur, data governance, SDLC). |
| **3** Blueprint (PENDING) | Cara lintas-fungsi | `docs/` + propagation config = blueprint yang dikodekan. |
| **4** Spesifikasi (PRD, AI Agent) | Spesifikasi/regulasi | `products/` (customer-gpt, automations, ontology-query) + `action-runtime/agent-runtime`. |
| **5** Implementasi (ANTERO, Supabase) | Sistem berjalan | Gateway NestJS + Supabase/Postgres + read-write-loops. **`antero-platform` hidup di sini.** |

**Disiplin propagasi top-down** (pertahanan utama Technology OS terhadap drift) sudah ada sebagai mekanisme runtime: `PropagationExecutor` membaca `configs/governance/propagation.yaml` dan men-trigger read-model, graph-sync, materialized view, dan audit-loop pada setiap register/patch. Inilah jaminan teknis bahwa "tidak ada entitas baru lahir di kode tanpa amendment OS sumber."

---

## 2. Bukti DAEMON sudah di-fork untuk ANTERO

Tiga artefak di repo membuktikan niat desain:

1. **Pack `logistics-commercial`** (`configs/ontology/packs/extensions/logistics-commercial/`) — 17+ entitas yang identik dengan modul ANTERO live yang disebut Technology OS (shipment, manifest, dispatch, pickup→Trip, tracking→TTK, route price→RoutingDecision, customer DB→Account/Contact, plus lapisan komersial Lead/Opportunity/Pipeline/Signal untuk Sales OS).
2. **`scripts/abc-express/`** — `migrate_supabase_to_clickhouse.py` + `schema_columns.json` (72KB skema kolom nyata). DAEMON sudah tahu bentuk database ANTERO. Ini jalur "data warehouse → decision factory": Supabase (OLTP/SSOT operasional) → ClickHouse (OLAP/analitik).
3. **`propagation.yaml`** berlabel *"Technology OS alignment"* — governance ABC Express sudah dikodekan ke dalam runtime DAEMON.

Kesimpulan: `antero-platform` paling tepat dipahami sebagai **distribusi/deployment ABC Express dari DAEMON** — DAEMON sebagai engine generik (open-core), `antero-platform` sebagai pack + konfigurasi + produk spesifik-ANTERO di atasnya.

---

## 3. Empat capability transform → komponen DAEMON

Technology OS menargetkan 4 capability yang mengubah ANTERO menjadi decision-making factory. Pemetaan ke DAEMON:

| Capability transform | Komponen DAEMON yang memikul | Status |
|---|---|---|
| **TP Engine** (formula Three-Step pricing) | `engine/logic-engine` + `read-write-loops` + Action Types deklaratif (`configs/governance/action-types.yaml`, `logic/tp-routing-rules.yaml`, `action-type-guard.ts`). | **Partial (Tier 1):** aturan TP via logic-layer; governed write RoutingDecision tetap Fase 3. |
| **Shadow Pricing** | `products/analytics-workflows/shadow-pricing.ts` + `POST /v1/products/shadow-pricing/simulate` (read-only); ClickHouse `abc_express` opsional. | **Partial (Tier 1):** simulasi read-only teruji di `antero-shadow-parity.integration.test.ts`. |
| **OBL Integration** | `configs/collect-sensing/sources.abc-express.yaml` — `abc-fixture-obl-manifests` + stub `abc-obl-v3` (http-pull, disabled). | **Partial (Tier 1):** normalizer Manifest enrichment; live OBL menunggu kredensial. |
| **Commercial Intelligence** | `products/customer-gpt` + `products/ontology-query` + entitas `Signal`/`Opportunity` di shadow ingest P1. | **Fondasi ada;** produk rekomendasi = Fase 2. |

Semua empat memetakan ke modul yang **sudah eksis** di DAEMON — beban kerja adalah konfigurasi + perakitan produk, bukan membangun engine dari nol. Ini selaras dengan prinsip Manifesto "Platform mengalahkan armada" dan "asset-light juga di teknologi".

---

## 4. Strategi adopsi (asset-light, anti over-build)

Technology OS eksplisit: *"manfaatkan platform terkelola Supabase/Vercel, jangan over-build"* dan *"jangan rebuild yang sudah jalan."* Maka pola adopsinya **bukan** rewrite ANTERO live, melainkan **strangler-fig**:

**Fase 0 — Hardening pondasi (prasyarat mutlak).** ✅ **Substantially closed** `@d7a76d1` (lihat §5 mitigasi + `DAEMON_Security_Audit.md` Lampiran Remediasi).

**Fase 1 — Read-only shadow (zero risiko ke ANTERO live).** 🟢 **In progress / artefak ter-ship:**
- Tenancy ABC: `abc-antero`, `abc-arandy`, `abc-holding` di `configs/tenancy.yaml`; peran `logistics-viewer`, `commercial-analyst`, `abc-platform-admin` di `configs/governance/rbac.yaml`.
- Ingest: `sources.abc-express.yaml` (fixture P0/P1 + live `abc-antero-*` postgres-read); fixture aktif dengan `DAEMON_ABC_FIXTURES=1`, live shadow dengan `DAEMON_ABC_LIVE_INGEST=1` + `ANTERO_SUPABASE_DB_URL`.
- Parity gate: `tests/integration/antero-shadow-parity.integration.test.ts` + job CI `antero-parity`.
- ANTERO live tetap SSOT; tidak ada governed write ke Supabase di Fase 1.

**Fase 2 — Decision factory di atas shadow.**
Bangun 4 capability transform sebagai produk DAEMON yang **membaca** ontology, **menulis** rekomendasi (bukan mutasi operasional). Shadow Pricing & Commercial Intelligence dulu — keduanya read-heavy, risiko rendah.

**Fase 3 — Governed writes selektif.**
Pindahkan jalur tulis bernilai-tinggi-bertaksonomi (mis. RoutingDecision, pricing) ke `read-write-loops` DAEMON dengan policy + audit penuh. Modul ANTERO matang (shipment entry, manifest, dispatch) **tetap** di ANTERO — sesuai "jangan rebuild yang sudah jalan."

**Fase 4 — ANTERO sebagai pengalaman di atas DAEMON.**
Frontend Vercel ANTERO memanggil gateway DAEMON sebagai sumber kebenaran semantik. DAEMON jadi "OS bisnis"; ANTERO jadi experience layer + modul operasional matang.

Multi-entitas (Antero / Arandy / Holding) dipetakan ke **tenancy** DAEMON (`X-Daemon-Tenant` + domain) — dimensi yang persis disebut Technology OS untuk "lensa pendapatan". Tapi lihat peringatan keamanan tenancy di §5.

---

## 5. Risiko — status pasca-remediasi (HedgeFund lens)

Pondasi tidak boleh "lulus dengan false-positive". Status terhadap audit asli (`DAEMON_Security_Audit.md` @ `5f11592`):

| Temuan asli | Status @ `d7a76d1` | Bukti singkat |
|---|---|---|
| **C1 — Tenant header tidak terikat sesi** | **Mitigated** | `TenantContextService.resolveBound` + `TenantScopeGuard` (`api/gateway/src/auth/tenant-scope.guard.ts`); isolasi `abc-antero`/`abc-arandy`/`abc-holding` di `tests/tenancy/isolation.test.ts` |
| **C2 — Policy buta-peran** | **Mitigated (local RBAC path)** | `PolicyService.check(PolicyCheckInput)` + `configs/governance/rbac.yaml`; Rust HTTP adapter `policy-http-server.rs` |
| **C3 — Read tanpa `@Protected`** | **Mitigated** | `read.controller.ts` — `@Protected()` + `@PolicyCheck` pada semua route |
| **C4 — Webhook fail-open** | **Mitigated (config-dependent)** | `webhook-hmac.ts` fail-closed bila HMAC wajib; webhook tenant dipaksa dari `sources.yaml` scope |
| **H1 — RBAC/ABAC/RLS dead code** | **Open (residual)** | RBAC YAML aktif di local authorizer; paket ABAC/RLS belum di hot path |
| **H2/H3 — JWT dev / default admin key** | **Open (dev-only)** | Wajib `DAEMON_AUTH_MODE=prod` + `DAEMON_API_KEYS` sebelum exposure eksternal |

**Governance gap non-teknis (tetap):** Technology OS — **CTO vacant (target Q3 2026)**; governed-writes Fase 3+ menunggu sign-off Plt. CTO / ratifikasi OS.

Rincian temuan asli + lampiran remediasi: `DAEMON_Security_Audit.md`.

---

## 6. Rekomendasi konkret

1. **Posisikan `antero-platform` = distribusi ABC Express dari DAEMON.** DAEMON = engine open-core; `antero-platform` = pack `logistics-commercial` + config tenancy + 4 produk transform + frontend Vercel. Pertahankan pemisahan repo agar engine generik bisa dipakai entitas lain (sejalan "platform mengalahkan armada").
2. **Mulai Fase 0+1 segera, paralel.** Hardening keamanan (tim security) + shadow read-only (tim data) tidak saling memblok.
3. **Kodekan TP/OBL/Signal sebagai aturan di logic-layer**, bukan hardcode — agar disiplin propagasi top-down terjaga dan governance review OS sumber tetap berlaku.
4. **Jadikan parity test gerbang rilis.** `foundry-parity-golden` + `antero-shadow-parity` + `check:parity-matrix` sebelum promosi fase (CI job `antero-parity` pada branch promosi).
5. **Tunda governed-writes (Fase 3+) hingga CTO definitif + ratifikasi Technology OS**, demi IPO-readiness ITGC.

---

*Catatan ruang lingkup: `github.com/daemon-blockint-tech/antero-platform` belum ada/privat di organisasi (repo terlihat: DAEMON, VDR, dst). Analisis ini berbasis DAEMON `@d7a76d1` + dokumen Space ABC Express + program ANTERO shadow (Fase 1 artefak di repo). Begitu `antero-platform` tersedia, pemetaan dapat dikonkretkan ke kode aktualnya.*
