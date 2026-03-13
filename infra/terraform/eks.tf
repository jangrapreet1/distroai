# =============================================================
# EKS Cluster + Node Groups
# =============================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Enable IRSA (IAM Roles for Service Accounts)
  enable_irsa = true

  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    main = {
      name           = "distroai-main"
      instance_types = ["t3.medium"]  # 2 vCPU, 4GB
      min_size       = 2
      max_size       = 6
      desired_size   = 2
      disk_size      = 50

      labels = {
        workload = "general"
      }
    }

    ai = {
      name           = "distroai-ai"
      instance_types = ["t3.large"]   # 2 vCPU, 8GB — for Prophet + LangChain
      min_size       = 1
      max_size       = 3
      desired_size   = 1
      disk_size      = 50

      labels = {
        workload = "ai"
      }

      taints = [{
        key    = "workload"
        value  = "ai"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}
