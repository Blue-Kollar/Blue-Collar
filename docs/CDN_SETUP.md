# CDN Setup Guide for BlueCollar

This guide covers setting up CloudFront CDN for faster delivery of static assets (images, CSS, JavaScript) in the BlueCollar platform.

## Overview

- **CDN Provider**: AWS CloudFront
- **Origin**: S3 bucket or API Gateway
- **Cache Policy**: Optimized for static assets with versioning
- **Invalidation**: Automated on deployment

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- Terraform or CloudFormation (optional, for IaC)

## Step 1: Create S3 Bucket for Static Assets

```bash
aws s3 mb s3://bluecollar-assets-prod --region us-east-1
```

Enable versioning:

```bash
aws s3api put-bucket-versioning \
  --bucket bluecollar-assets-prod \
  --versioning-configuration Status=Enabled
```

## Step 2: Configure CloudFront Distribution

### Using AWS Console

1. Go to CloudFront → Distributions → Create Distribution
2. **Origin Settings**:
   - Origin Domain: `bluecollar-assets-prod.s3.us-east-1.amazonaws.com`
   - Origin Path: `/` (or `/assets` if using subdirectory)
   - S3 Origin Access Identity: Create new OAI

3. **Default Cache Behavior**:
   - Viewer Protocol Policy: `Redirect HTTP to HTTPS`
   - Allowed HTTP Methods: `GET, HEAD, OPTIONS`
   - Cache Policy: Create custom policy (see below)
   - Compress Objects Automatically: `Yes`

4. **Cache Policy Settings**:
   - TTL for static assets: 31536000 seconds (1 year)
   - TTL for HTML: 3600 seconds (1 hour)
   - Query String Forwarding: `None`

### Using Terraform

```hcl
resource "aws_cloudfront_distribution" "bluecollar_cdn" {
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-bluecollar-assets"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  enabled = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-bluecollar-assets"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 31536000
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
```

## Step 3: Asset Versioning Strategy

### Filename-based Versioning

Include content hash in filenames:

```
app.abc123def456.js
styles.xyz789uvw012.css
logo.hash123.png
```

### Build Configuration

Update `next.config.mjs` for the app:

```javascript
export default {
  assetPrefix: process.env.CDN_URL || '',
  images: {
    domains: ['d123456.cloudfront.net'],
    unoptimized: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.output.filename = 'static/js/[name].[contenthash].js';
      config.output.chunkFilename = 'static/js/[name].[contenthash].chunk.js';
    }
    return config;
  },
};
```

## Step 4: Automated Invalidation on Deploy

### GitHub Actions Workflow

Create `.github/workflows/cdn-invalidate.yml`:

```yaml
name: Invalidate CDN Cache

on:
  workflow_run:
    workflows: ['Deploy to Production']
    types: [completed]

jobs:
  invalidate:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### Manual Invalidation

```bash
aws cloudfront create-invalidation \
  --distribution-id E123EXAMPLE456 \
  --paths "/*"
```

## Step 5: Monitor CDN Performance

### CloudWatch Metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name BytesDownloaded \
  --dimensions Name=DistributionId,Value=E123EXAMPLE456 \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Key Metrics to Monitor

- **BytesDownloaded**: Total bytes served by CloudFront
- **BytesUploaded**: Total bytes uploaded to origin
- **Requests**: Total number of requests
- **4xxErrorRate**: Client errors (cache misses, invalid requests)
- **5xxErrorRate**: Server errors

## Step 6: Environment Variables

Add to `.env.production`:

```
NEXT_PUBLIC_CDN_URL=https://d123456.cloudfront.net
CDN_BUCKET=bluecollar-assets-prod
CLOUDFRONT_DISTRIBUTION_ID=E123EXAMPLE456
```

## Step 7: Upload Assets to S3

```bash
# Build the app
cd packages/app
npm run build

# Upload to S3 with cache headers
aws s3 sync .next/static s3://bluecollar-assets-prod/static \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

# Upload HTML with shorter TTL
aws s3 sync .next s3://bluecollar-assets-prod \
  --cache-control "public, max-age=3600" \
  --exclude "static/*" \
  --delete
```

## Troubleshooting

### Cache Not Updating

1. Check invalidation status:

   ```bash
   aws cloudfront list-invalidations --distribution-id E123EXAMPLE456
   ```

2. Verify S3 bucket permissions and OAI configuration

3. Check CloudFront error logs in CloudWatch

### High Origin Load

- Increase cache TTL for static assets
- Implement cache headers in API responses
- Use CloudFront compression

### CORS Issues

Add CORS headers to S3 bucket:

```bash
aws s3api put-bucket-cors \
  --bucket bluecollar-assets-prod \
  --cors-configuration file://cors.json
```

Where `cors.json`:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://bluecollar.app"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

## Cost Optimization

- Use CloudFront's free tier for data transfer (1TB/month)
- Enable compression to reduce bandwidth
- Set appropriate cache TTLs
- Use S3 Intelligent-Tiering for cost optimization
- Monitor and optimize invalidation patterns

## Security

- Enable S3 bucket encryption
- Use Origin Access Identity (OAI) to restrict S3 access
- Enable CloudFront logging for audit trails
- Use WAF rules to protect against attacks
- Implement HTTPS-only access

## References

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [S3 + CloudFront Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [Cache Control Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
