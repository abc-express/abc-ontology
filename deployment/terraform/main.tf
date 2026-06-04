terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
  }
}

variable "enable_k8s" {
  type        = bool
  description = "When true, manage a daemon namespace in the configured cluster"
  default     = false
}

variable "namespace" {
  type        = string
  description = "Kubernetes namespace for daemon workloads"
  default     = "daemon"
}

provider "kubernetes" {
  # Uses KUBECONFIG or in-cluster config
}

resource "kubernetes_namespace" "daemon" {
  count = var.enable_k8s ? 1 : 0

  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/part-of" = "daemon-platform"
    }
  }
}

output "namespace" {
  value       = var.enable_k8s ? kubernetes_namespace.daemon[0].metadata[0].name : null
  description = "Target namespace when enable_k8s is true"
}
