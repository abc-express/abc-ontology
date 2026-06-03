variable "kubeconfig_path" {
  description = "Path to kubeconfig for cluster access"
  type        = string
  default     = "~/.kube/config"
}

variable "namespace" {
  description = "Kubernetes namespace for Daemon platform workloads"
  type        = string
  default     = "daemon-platform"
}
