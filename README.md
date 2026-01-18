# Automations

Automated error investigation and PR creation system for Flexy.

## Overview

This repository contains serverless functions that automate error investigation and resolution:

1. **GlitchTip Webhook Handler** - Receives error notifications from GlitchTip
2. **Claude Code Investigator** - Analyzes errors and creates PRs with fixes

## Architecture

```
GlitchTip Error Detection
         ↓
DigitalOcean Cloud Function (Webhook Handler)
         ↓
GitHub repository_dispatch Event
         ↓
GitHub Actions Workflow
         ↓
Claude Code Investigation
         ↓
Pull Request with Fix
```

## Setup

### Prerequisites

- DigitalOcean account with App Platform access
- GitHub account with repo access
- GlitchTip instance (deployed on Heroku or elsewhere)
- Claude API key (for Claude Code)

### Environment Variables

Configure these in DigitalOcean App Platform:

```bash
GITHUB_TOKEN=ghp_xxx              # GitHub PAT with repo scope
GITHUB_REPO_OWNER=flexy-tools     # Your GitHub username/org
GITHUB_REPO_NAME=flexy-v2-backend # Target repository
WEBHOOK_SECRET=xxx                # Optional: webhook validation
```

Configure these in GitHub Secrets:

```bash
DIGITALOCEAN_ACCESS_TOKEN=dop_v1_xxx  # For deployment
ANTHROPIC_API_KEY=sk-ant-xxx          # For Claude Code
```

### Deployment

#### Automatic Deployment (Recommended)

Push to `main` branch triggers automatic deployment:

```bash
git push origin main
```

GitHub Actions will deploy to DigitalOcean App Platform automatically.

#### Manual Deployment

```bash
# Install doctl
brew install doctl

# Authenticate
doctl auth init

# Install serverless plugin
doctl serverless install

# Deploy
doctl serverless deploy .
```

## Usage

### Configure GlitchTip Webhook

1. Go to GlitchTip → Project Settings → Alerts
2. Click "Add Alert Recipient"
3. Select "Webhook"
4. Enter URL: `https://your-app.ondigitalocean.app/glitchtip-webhook`
5. Save

### Test the Webhook

```bash
curl -X POST https://your-app.ondigitalocean.app/glitchtip-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "id": "test-error-123",
      "title": "Test Error",
      "message": "This is a test error",
      "level": "error",
      "platform": "python",
      "culprit": "test.py in test_function",
      "timestamp": "2026-01-18T20:00:00Z"
    }
  }'
```

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Deploy to dev namespace
npm run deploy
```

### Project Structure

```
automations/
├── packages/
│   └── glitchtip-webhook/
│       └── handler/
│           ├── index.js          # Webhook handler
│           └── package.json
├── .github/
│   └── workflows/
│       ├── deploy.yml            # CI/CD pipeline
│       └── claude-investigator.yml
├── .do/
│   └── app.yaml                  # App Platform config
├── project.yml                   # DigitalOcean Functions config
└── README.md
```

## Monitoring

### DigitalOcean Logs

```bash
doctl apps logs <app-id> --type run
```

### GitHub Actions

Check workflow runs at: https://github.com/flexy-tools/automations/actions

## Troubleshooting

### Webhook not triggering

- Check GlitchTip webhook configuration
- Verify function URL is correct
- Check DigitalOcean function logs

### GitHub Action not running

- Verify `GITHUB_TOKEN` has correct permissions
- Check repository_dispatch event type matches
- Review GitHub Actions logs

### Claude Code not creating PRs

- Verify `ANTHROPIC_API_KEY` is set
- Check Claude Code SDK installation
- Review workflow logs

## Contributing

This is an internal automation system for Flexy. Changes should be made carefully and tested thoroughly.

## License

MIT
