# =============================================================
# Route53 DNS
# =============================================================

data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# API subdomain → EKS ingress load balancer
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    # This will be the ALB/NLB created by nginx-ingress controller
    # Update after cluster is provisioned and ingress is deployed
    name                   = "PLACEHOLDER-ALB-DNS"
    zone_id                = "PLACEHOLDER-ALB-ZONE"
    evaluate_target_health = true
  }

  lifecycle {
    ignore_changes = [alias]  # Managed by external-dns or manually after ingress deploy
  }
}

# App subdomain → EKS ingress load balancer
resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "app.${var.domain_name}"
  type    = "A"

  alias {
    name                   = "PLACEHOLDER-ALB-DNS"
    zone_id                = "PLACEHOLDER-ALB-ZONE"
    evaluate_target_health = true
  }

  lifecycle {
    ignore_changes = [alias]
  }
}

# CDN subdomain → CloudFront
resource "aws_route53_record" "cdn" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "cdn.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}
