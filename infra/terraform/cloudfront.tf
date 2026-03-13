# =============================================================
# CloudFront CDN — Next.js static assets
# =============================================================

resource "aws_cloudfront_origin_access_identity" "web" {
  comment = "OAI for distroai web static assets"
}

resource "aws_s3_bucket" "web_static" {
  bucket = "distroai-prod-web-static"
}

resource "aws_s3_bucket_public_access_block" "web_static" {
  bucket                  = aws_s3_bucket.web_static.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "web_static" {
  bucket = aws_s3_bucket.web_static.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontRead"
      Effect    = "Allow"
      Principal = { AWS = aws_cloudfront_origin_access_identity.web.iam_arn }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.web_static.arn}/*"
    }]
  })
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"  # Asia + Europe + NA (important for Indian users)
  aliases             = ["cdn.${var.domain_name}"]

  origin {
    domain_name = aws_s3_bucket.web_static.bucket_regional_domain_name
    origin_id   = "s3-web-static"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.web.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-web-static"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400      # 1 day
    max_ttl                = 31536000   # 1 year (Next.js content-hashed assets)
    compress               = true
  }

  # Cache _next/static/* with long TTL (immutable)
  ordered_cache_behavior {
    path_pattern     = "_next/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-web-static"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 31536000
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.cdn.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  tags = {
    Name = "distroai-cdn"
  }
}
