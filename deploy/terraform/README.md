# BlueCollar Infrastructure (Terraform)

All infrastructure is managed as code using Terraform.

## Structure

```
deploy/terraform/
├── main.tf           # Root module — wires all child modules
├── variables.tf      # Input variables
├── outputs.tf        # Root outputs
├── bootstrap/        # One-time state backend setup
│   └── state.tf
├── modules/
│   ├── networking/   # VPC, subnets, IGW
│   ├── database/     # RDS PostgreSQL
│   ├── registry/     # ECR repository + lifecycle policies
│   └── cdn/          # S3 + CloudFront
└── tests/
    └── infra_test.go # Terratest integration tests
```

## First-time setup

1. Bootstrap remote state (run once):

   ```bash
   terraform -chdir=deploy/terraform/bootstrap init
   terraform -chdir=deploy/terraform/bootstrap apply
   ```

2. Initialise the root module:

   ```bash
   cd deploy/terraform
   terraform init
   ```

3. Plan and apply:
   ```bash
   terraform plan -var="db_username=..." -var="db_password=..."
   terraform apply
   ```

## State management

- State is stored in S3 (`bluecollar-terraform-state`) with versioning and AES-256 encryption.
- State locking uses DynamoDB (`bluecollar-terraform-locks`).

## CI/CD

The `terraform.yml` workflow runs on every PR and push to `main`:

- PRs: `fmt` → `validate` → `plan` (plan posted as PR comment)
- Merge to main: `apply` (requires `production` environment approval)

## Infrastructure tests

Uses [Terratest](https://terratest.gruntwork.io/):

```bash
cd deploy/terraform/tests
go test -v -timeout 30m ./...
```
