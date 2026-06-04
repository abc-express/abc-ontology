# Terraform — daemon platform (minimal)

This directory holds **provider-agnostic hooks** for teams that manage Kubernetes outside this repo. It is not a full cloud account bootstrap.

## Prerequisites

- Terraform >= 1.5
- A reachable Kubernetes cluster and credentials (`KUBECONFIG` or in-cluster)
- `DAEMON_POSTGRES_URL` and secrets managed by your secret store (not committed here)

## Validate locally

```bash
cd deployment/terraform
terraform init
terraform validate
```

## Apply (Kubernetes-only stub)

The root module wires the `kubernetes` provider when `var.enable_k8s` is true. Customize `terraform.tfvars` for your cluster:

```hcl
enable_k8s = true
namespace  = "daemon"
```

```bash
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

**Note:** Application manifests (gateway, policy, ingest) ship in `deployment/kubernetes/` and `deployment/helm/daemon-platform/`. Terraform here creates namespace/labels only; deploy Helm after apply:

```bash
helm upgrade --install daemon-platform deployment/helm/daemon-platform \
  -n daemon --create-namespace
```

## State

Use remote state (S3, GCS, Terraform Cloud) in production. Do not commit `terraform.tfstate`.

See [docs/04-deployment.md](../../docs/04-deployment.md) and [docs/06-deployment-topology.md](../../docs/06-deployment-topology.md).
