# Container Registry

BlueCollar uses AWS ECR as its private container registry.

## Repository

`bluecollar-api` — stores all API service images.

## Image tagging

| Tag pattern   | When created            |
| ------------- | ----------------------- |
| `v1.2.3`      | On a semver Git tag     |
| `sha-abc1234` | On every push to `main` |

Tags are **immutable** — an existing tag cannot be overwritten.

## Vulnerability scanning

Every image is scanned on push via ECR's built-in scanner (backed by Clair).
The CI pipeline also runs **Trivy** before pushing and fails on `CRITICAL` or `HIGH` findings.
Results are uploaded to GitHub Security → Code Scanning.

## Image signing

Images are signed with **Cosign** using keyless signing (Sigstore OIDC).
Verify a signature:

```bash
cosign verify \
  --certificate-identity-regexp="https://github.com/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  <ECR_REPO_URL>:<tag>
```

## Retention policy

| Rule                             | Action         |
| -------------------------------- | -------------- |
| Untagged images older than 1 day | Deleted        |
| More than 10 `v*`-tagged images  | Oldest deleted |

## Access controls

| Role                | Permissions                     |
| ------------------- | ------------------------------- |
| `bluecollar-ci`     | Push + pull (CI builds)         |
| `bluecollar-deploy` | Pull only (ECS/K8s deployments) |
