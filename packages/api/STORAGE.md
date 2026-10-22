# Storage Architecture

## Overview

Blue Collar API uses an S3-compatible object storage backend with an automatic fallback to local disk storage for development and testing environments.

## Active Backend

### Primary: S3-Compatible Storage

The API uses the AWS SDK v3 `S3Client` for object storage, which is compatible with:

- **AWS S3** — Production-grade cloud storage
- **MinIO** — Self-hosted S3-compatible storage
- **Cloudflare R2** — R2 provides S3-compatible APIs with reduced egress costs
- **DigitalOcean Spaces** — S3-compatible object storage

**Configuration:**

```bash
S3_BUCKET=my-bucket              # Required to enable S3
S3_REGION=us-east-1              # Default: us-east-1
S3_ENDPOINT=https://minio:9000   # Optional: for MinIO, R2, etc.
S3_ACCESS_KEY=AKIA...            # Optional: defaults to IAM role
S3_SECRET_KEY=...                # Optional: defaults to IAM role
S3_SIGNED_URL_TTL=3600           # Default: 3600 seconds
```

When `S3_BUCKET` is set, all file uploads go to S3, and the API generates pre-signed URLs for downloads with automatic expiration.

### Fallback: Local Disk Storage

When `S3_BUCKET` is not configured (empty or undefined), the API falls back to local disk storage:

- Files are written to the directory specified by `UPLOAD_DIR` (default: `storage/uploads`)
- Download URLs are served directly (e.g., `/uploads/filename.webp`)
- This fallback is **not production-ready** and is intended only for development and testing

**Use cases for fallback:**

- Local development without S3 credentials
- CI/CD test environments
- Temporary testing

## Implementation Details

**File:** `packages/api/src/services/storage.service.ts`

### Exported Functions

#### `uploadFile(localPath: string, key: string, contentType: string): Promise<string>`

Uploads a file to S3 (or returns a local URL path when S3 is not configured).

- **Params:**
  - `localPath` — Path to the temporary local file
  - `key` — S3 key (path within the bucket)
  - `contentType` — MIME type (e.g., `image/webp`)
- **Returns:** S3 key or local URL path
- **Side effect:** Deletes the local temp file after successful S3 upload

#### `getSignedDownloadUrl(key: string): Promise<string>`

Generates a pre-signed URL for downloading a stored file.

- **Params:**
  - `key` — S3 key or local path
- **Returns:** Pre-signed S3 URL (expires in `S3_SIGNED_URL_TTL` seconds) or local URL path
- **Notes:** Local fallback paths (starting with `/uploads/`) are returned as-is without signing

#### `deleteFile(key: string): Promise<void>`

Deletes an object from S3 (or logs a warning for local files).

- **Params:**
  - `key` — S3 key or local path
- **Notes:** Local file deletion is not automatic; admin action may be required

## Usage in the API

### Image Upload Pipeline

The `packages/api/src/middleware/upload.ts` middleware:

1. Receives image uploads from the client
2. Generates three variants: thumbnail, medium, and full-size (via Sharp)
3. Converts all variants to WebP format
4. Uploads all variants to S3 (or local fallback)
5. Returns pre-signed download URLs to the client

### Worker Profile Images

Worker profile images are uploaded via the worker profile endpoints and stored with the key pattern:

```
workers/{workerId}/profile-{timestamp}-{variant}.webp
```

Variants: `thumb`, `medium`, `full`

## Monitoring & Operations

### Healthy Checks

- **S3 connectivity:** Test with `aws s3 ls s3://{bucket}` (requires credentials)
- **Fallback verification:** Ensure `UPLOAD_DIR` is writable and has sufficient disk space
- **Pre-signed URLs:** Validate that URLs are reachable and expire correctly

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "S3 SDK not available" | AWS SDK v3 not installed | `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` |
| Files not uploading | S3 credentials invalid | Verify `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_REGION` |
| Pre-signed URLs expire too quickly | `S3_SIGNED_URL_TTL` too low | Increase to at least 3600 seconds |
| Disk space full | Local fallback overflow | Monitor `UPLOAD_DIR` or migrate to S3 |

## Migration from Local to S3

If you're currently using local storage and want to migrate to S3:

1. Set up an S3 bucket (AWS, MinIO, Cloudflare R2, etc.)
2. Set environment variables: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
3. Restart the API service
4. New uploads will go to S3
5. Optionally migrate existing files: `aws s3 cp storage/uploads/ s3://my-bucket/uploads/ --recursive`

## Security Considerations

- **Pre-signed URLs:** URLs expire after `S3_SIGNED_URL_TTL` seconds; ensure this is short enough to prevent URL sharing
- **Bucket policies:** Restrict public access to the bucket; only the API should have write permissions
- **Credentials:** Use IAM roles in production instead of hardcoded access keys
- **CORS:** Configure S3 CORS policies to allow the web app's origin for direct uploads (if implemented)

## Testing

Unit and integration tests for storage functionality can be found in:

- `packages/api/src/middleware/upload.ts` (file upload middleware)
- `packages/api/src/__tests__/` (API tests that verify upload endpoints)

All tests use the local fallback by default (no S3 credentials needed).
