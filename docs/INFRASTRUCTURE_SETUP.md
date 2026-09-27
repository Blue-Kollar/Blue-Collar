# Infrastructure Setup

## Overview
This document describes how to provision the Blue-Collar infrastructure using Terraform.

## Prerequisites

### Tools
- Terraform >= 1.0
- AWS CLI configured
- AWS account with appropriate permissions

### AWS Resources Required
- S3 bucket for Terraform state
- DynamoDB table for state locking

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Blue-Kollar/Blue-Collar.git
cd Blue-Collar/terraform
