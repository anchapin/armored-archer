# Alpha CI/CD Pipeline Configuration

**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Phase**: 1.1 - Alpha Environment Setup
**Task**: 1.1.5 - CI/CD Pipeline Configuration
**Date**: 2026-03-16

---

## Overview

This document describes the CI/CD pipeline configuration for deploying to the alpha environment using GitHub Actions.

---

## Pipeline Architecture

### Current Workflows

The project already has the following CI/CD workflows:

| Workflow | File | Purpose |
|----------|------|---------|
| CI | `.github/workflows/ci.yml` | Build, test, lint on push/PR |
| CD | `.github/workflows/cd.yml` | Deploy to staging/production |
| Test | `.github/workflows/test.yml` | Run test suites |
| Rollback | `.github/workflows/rollback.yml` | Rollback deployments |

### Alpha Deployment Flow

```
┌─────────────┐
│  Push to    │
│  alpha      │
│  branch     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  CI Pipeline│
│  - Lint     │
│  - Test     │
│  - Build    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Approval   │
│  Gate       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Deploy to  │
│  Alpha      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Health     │
│  Checks     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Notify     │
│  Slack      │
└─────────────┘
```

---

## 1. GitHub Environment Setup

### Create Alpha Environment

1. Go to repository Settings → Environments
2. Click "New environment"
3. Name: `alpha`
4. Configure:
   - **Deployment branches**: `alpha`, `main`
   - **Required reviewers**: Add alpha team members
   - **Wait timer**: 0 minutes (immediate for alpha)
   - **Environment variables**: Add alpha-specific vars
   - **Deployment protection rules**: Enable as needed

### Environment Secrets

Configure the following secrets in GitHub → Settings → Secrets and variables → Actions → Environments → alpha:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `ALPHA_SERVER_HOST` | Alpha server SSH host | `alpha.armored-archer.com` |
| `ALPHA_SERVER_USER` | SSH username | `deploy` |
| `ALPHA_SSH_KEY` | SSH private key for deployment | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `ALPHA_DATABASE_URL` | Database connection string | `postgres://...` |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | `https://hooks.slack.com/...` |
| `NAKAMA_SERVER_KEY` | Nakama server key | `<unique-key>` |

---

## 2. Alpha Deployment Workflow

Create `.github/workflows/deploy-alpha.yml`:

```yaml
name: Deploy to Alpha

on:
  push:
    branches: [ alpha ]
  workflow_dispatch:
    inputs:
      commit:
        description: 'Commit SHA to deploy'
        required: false
        default: ''

# Concurrency control for alpha deployments
concurrency:
  group: ${{ github.workflow }}-alpha
  cancel-in-progress: false

jobs:
  # ============================================
  # Stage 1: Build and Test
  # ============================================
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.commit || github.sha }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run linter
        working-directory: ./backend
        run: npm run lint

      - name: Run type check
        working-directory: ./backend
        run: npm run typecheck

      - name: Run tests
        working-directory: ./backend
        run: npm test

      - name: Build TypeScript
        working-directory: ./backend
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: backend-build
          path: backend/build/
          retention-days: 7

  # ============================================
  # Stage 2: Deploy to Alpha
  # ============================================
  deploy-alpha:
    name: Deploy to Alpha
    runs-on: ubuntu-latest
    needs: build-and-test
    environment:
      name: alpha
      url: https://alpha.armored-archer.com
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: backend-build
          path: backend/build/

      - name: Setup SSH key
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.ALPHA_SSH_KEY }}

      - name: Deploy to alpha server
        env:
          ALPHA_SERVER_HOST: ${{ secrets.ALPHA_SERVER_HOST }}
          ALPHA_SERVER_USER: ${{ secrets.ALPHA_SERVER_USER }}
        run: |
          # Transfer build files
          scp -o StrictHostKeyChecking=no -r backend/build/ ${ALPHA_SERVER_USER}@${ALPHA_SERVER_HOST}:/opt/armored-archer/backend/build/
          
          # Run deployment script on server
          ssh -o StrictHostKeyChecking=no ${ALPHA_SERVER_USER}@${ALPHA_SERVER_HOST} << 'EOF'
            cd /opt/armored-archer/backend
            docker-compose pull
            docker-compose up -d --build
          EOF

      - name: Wait for services to be healthy
        env:
          ALPHA_SERVER_HOST: ${{ secrets.ALPHA_SERVER_HOST }}
          ALPHA_SERVER_USER: ${{ secrets.ALPHA_SERVER_USER }}
        run: |
          echo "Waiting for services to be healthy..."
          for i in {1..30}; do
            if ssh -o StrictHostKeyChecking=no ${ALPHA_SERVER_USER}@${ALPHA_SERVER_HOST} \
              "docker exec armored_archer_server /nakama/nakama healthcheck" 2>/dev/null; then
              echo "Services are healthy!"
              exit 0
            fi
            echo "Waiting for services... ($i/30)"
            sleep 10
          done
          echo "Services failed to become healthy"
          exit 1

      - name: Verify deployment
        env:
          ALPHA_SERVER_HOST: ${{ secrets.ALPHA_SERVER_HOST }}
          ALPHA_SERVER_USER: ${{ secrets.ALPHA_SERVER_USER }}
        run: |
          ssh -o StrictHostKeyChecking=no ${ALPHA_SERVER_USER}@${ALPHA_SERVER_HOST} << 'EOF'
            cd /opt/armored-archer/backend
            docker-compose ps
            docker-compose logs --tail=50 nakama
          EOF

  # ============================================
  # Stage 3: Post-Deployment
  # ============================================
  notify-success:
    name: Notify Success
    runs-on: ubuntu-latest
    needs: deploy-alpha
    if: success()
    steps:
      - name: Send Slack notification
        uses: slackapi/slack-github-action@v1.25.0
        with:
          payload: |
            {
              "text": "✓ Alpha deployment successful",
              "blocks": [
                {
                  "type": "header",
                  "text": {
                    "type": "plain_text",
                    "text": "✓ Alpha Deployment Successful"
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    {
                      "type": "mrkdwn",
                      "text": "*Commit:*\n${{ github.sha }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Branch:*\n${{ github.ref_name }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Deployed by:*\n${{ github.actor }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Environment:*\nAlpha"
                    }
                  ]
                },
                {
                  "type": "actions",
                  "elements": [
                    {
                      "type": "button",
                      "text": {
                        "type": "plain_text",
                        "text": "View Workflow"
                      },
                      "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                    }
                  ]
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  notify-failure:
    name: Notify Failure
    runs-on: ubuntu-latest
    needs: [build-and-test, deploy-alpha]
    if: failure()
    steps:
      - name: Send Slack notification
        uses: slackapi/slack-github-action@v1.25.0
        with:
          payload: |
            {
              "text": "✗ Alpha deployment failed",
              "blocks": [
                {
                  "type": "header",
                  "text": {
                    "type": "plain_text",
                    "text": "✗ Alpha Deployment Failed",
                    "emoji": true
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    {
                      "type": "mrkdwn",
                      "text": "*Commit:*\n${{ github.sha }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Branch:*\n${{ github.ref_name }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Failed by:*\n${{ github.actor }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Environment:*\nAlpha"
                    }
                  ]
                },
                {
                  "type": "actions",
                  "elements": [
                    {
                      "type": "button",
                      "text": {
                        "type": "plain_text",
                        "text": "View Logs"
                      },
                      "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                    }
                  ]
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 3. Manual Deployment Script

For manual deployments, create `scripts/deploy-alpha.sh`:

```bash
#!/bin/bash
# Manual Alpha Deployment Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "Armored Archer - Alpha Deployment"
echo "=========================================="
echo ""

# Configuration
ALPHA_HOST="${ALPHA_HOST:-alpha.armored-archer.com}"
ALPHA_USER="${ALPHA_USER:-deploy}"
BACKEND_DIR="backend"

# Check if on alpha branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "alpha" ]; then
    echo -e "${YELLOW}⚠ Warning: You are on branch '$CURRENT_BRANCH', not 'alpha'${NC}"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build
echo -e "${BLUE}Building backend...${NC}"
cd "$BACKEND_DIR"
npm ci
npm run lint || echo -e "${YELLOW}⚠ Linting warnings found${NC}"
npm run typecheck || echo -e "${YELLOW}⚠ Type check warnings found${NC}"
npm test || { echo -e "${RED}✗ Tests failed${NC}"; exit 1; }
npm run build
cd ..

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Deploy
echo -e "${BLUE}Deploying to alpha server ($ALPHA_HOST)...${NC}"
scp -r $BACKEND_DIR/build/ ${ALPHA_USER}@${ALPHA_HOST}:/opt/armored-archer/backend/build/

echo -e "${BLUE}Restarting services...${NC}"
ssh ${ALPHA_USER}@${ALPHA_HOST} << 'EOF'
  cd /opt/armored-archer/backend
  docker-compose pull
  docker-compose up -d --build
EOF

echo ""
echo -e "${BLUE}Waiting for services to be healthy...${NC}"
for i in {1..30}; do
    if ssh ${ALPHA_USER}@${ALPHA_HOST} \
      "docker exec armored_archer_server /nakama/nakama healthcheck" 2>/dev/null; then
        echo -e "${GREEN}✓ Services are healthy!${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 10
done

echo ""
echo -e "${GREEN}✓ Alpha deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Check logs: ssh ${ALPHA_USER}@${ALPHA_HOST} 'docker-compose logs -f nakama'"
echo "  2. Test API: curl https://alpha.armored-archer.com/health"
echo "  3. Check Grafana: https://alpha.armored-archer.com:3000"
```

Make executable:

```bash
chmod +x scripts/deploy-alpha.sh
```

---

## 4. Rollback Procedure

### Automated Rollback

The existing `.github/workflows/rollback.yml` can be used for alpha:

```bash
# Using GitHub CLI
gh workflow run rollback.yml -f environment=alpha -f reason="Bug fix" -f rollback_type=full
```

### Manual Rollback

```bash
# SSH to alpha server
ssh deploy@alpha.armored-archer.com

# Navigate to project
cd /opt/armored-archer/backend

# View recent deployments
docker images | grep armored-archer

# Rollback to previous image
docker-compose down
docker-compose up -d --build

# Or restore from backup
/opt/armored-archer/scripts/rollback-alpha.sh
```

---

## 5. Deployment Verification

### Health Check Commands

```bash
# Check Nakama health
curl https://alpha.armored-archer.com:7350/health

# Check API endpoints
curl -H "Authorization: Bearer <token>" \
  https://alpha.armored-archer.com:7350/v2/storage

# Check metrics endpoint
curl https://alpha.armored-archer.com:7350/metrics
```

### Smoke Test Script

Create `scripts/smoke-test-alpha.sh`:

```bash
#!/bin/bash
# Alpha Smoke Tests

ALPHA_URL="${ALPHA_URL:-https://alpha.armored-archer.com:7350}"

echo "Running smoke tests against $ALPHA_URL..."

# Health check
echo -n "Health check... "
if curl -s -f "$ALPHA_URL/health" > /dev/null; then
    echo "✓"
else
    echo "✗"
    exit 1
fi

# API version check
echo -n "API version... "
if curl -s -f "$ALPHA_URL/status" > /dev/null; then
    echo "✓"
else
    echo "✗"
fi

echo "Smoke tests complete!"
```

---

## 6. Deployment Checklist

### Pre-Deployment

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] Alpha branch is up to date
- [ ] Environment secrets configured
- [ ] Team notified of deployment

### During Deployment

- [ ] Monitor GitHub Actions logs
- [ ] Watch for deployment notifications
- [ ] Check Slack for status updates

### Post-Deployment

- [ ] Health check passes
- [ ] Smoke tests pass
- [ ] Grafana dashboards show normal metrics
- [ ] No errors in application logs
- [ ] Team notified of successful deployment

---

## Next Steps

After CI/CD configuration:

1. Proceed to Task 1.1.6 - Monitoring Infrastructure
2. Test deployment pipeline end-to-end
3. Document any custom deployment requirements
4. Train team on deployment procedures

---

**Created**: 2026-03-16
**Status**: 📋 Ready for Execution
