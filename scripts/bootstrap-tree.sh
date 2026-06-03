#!/usr/bin/env bash
# Creates directory tree from architecture spec (dirs only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

dirs=(
  docs/reference
  configs/environments configs/policies
  language/data/schema-language language/data/mapping-language language/data/query-language language/data/serialization
  language/logic/rule-language language/logic/inference-language language/logic/policy-language language/logic/constraint-language
  language/action/command-language language/action/workflow-language language/action/agent-language language/action/tool-language
  language/security/auth-language language/security/trust-language language/security/audit-language language/security/governance-language
  sources/data-sources/structured/postgres sources/data-sources/structured/mysql sources/data-sources/structured/warehouse
  sources/data-sources/unstructured/documents sources/data-sources/unstructured/emails sources/data-sources/unstructured/tickets sources/data-sources/unstructured/logs
  sources/data-sources/streaming/kafka sources/data-sources/streaming/nats sources/data-sources/streaming/webhooks
  sources/logic-sources/business-rules sources/logic-sources/playbooks sources/logic-sources/workflows sources/logic-sources/decision-tables
  sources/systems-of-record/erp sources/systems-of-record/crm sources/systems-of-record/wms sources/systems-of-record/hris sources/systems-of-record/cmdb
  collect-sensing/orchestrator collect-sensing/connectors/db-connectors collect-sensing/connectors/api-connectors
  collect-sensing/connectors/file-connectors collect-sensing/connectors/event-connectors
  collect-sensing/normalization collect-sensing/pipelines
  ontology/registry ontology/models/entities ontology/models/relations ontology/models/events ontology/models/states ontology/models/traits
  ontology/semantic-layer ontology/vector-layer ontology/logic-layer ontology/projections/read-models ontology/projections/materialized-views ontology/projections/query-optimizers
  read-write-loops/interfaces/human-interface read-write-loops/interfaces/agent-interface read-write-loops/interfaces/session-context
  read-write-loops/reads read-write-loops/writes read-write-loops/loop-controller read-write-loops/external-writes
  action-runtime/workflow-engine action-runtime/agent-runtime action-runtime/command-runtime
  action-runtime/automation/incident-response action-runtime/automation/approval-flows action-runtime/automation/enterprise-ops
  security-governance/identity security-governance/policy security-governance/trust security-governance/audit security-governance/guardrails
  engine/data-engine engine/logic-engine engine/action-engine engine/security-engine
  toolchain/cli toolchain/sdk/ts toolchain/sdk/go toolchain/sdk/rust toolchain/sdk/python
  toolchain/plugins/connectors toolchain/plugins/validators toolchain/plugins/exporters toolchain/plugins/agent-tools
  toolchain/scaffolds toolchain/runtime
  api/gateway api/graphql api/rest api/grpc api/websocket
  products/analytics-workflows products/automations products/customer-gpt products/internal-applications products/admin-console products/product-shell
  external-systems/adapters external-systems/sync-jobs external-systems/outbound-actions external-systems/system-proxies
  data-platform/lakehouse data-platform/operational-store data-platform/graph-store data-platform/vector-store data-platform/cache
  observability/metrics observability/tracing observability/logging observability/evals observability/dashboards
  deployment/docker deployment/kubernetes deployment/helm deployment/terraform
  tests/contract tests/integration tests/policy tests/ontology tests/e2e
  packages/platform-types/src packages/sdk/src packages/cli/src packages/cli/bin
  .github/workflows
)

for d in "${dirs[@]}"; do mkdir -p "$d"; done
echo "Tree created under $ROOT"
