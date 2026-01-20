# Architecture

## System Overview

The Automations system provides automated error investigation and PR creation for the Flexy application.

## Components

### 1. GlitchTip Webhook Handler (DigitalOcean Function)

**Location:** `packages/glitchtip-webhook/handler/index.js`

**Responsibilities:**
- Receive webhook notifications from GlitchTip
- Parse error payloads and extract relevant information
- Trigger GitHub Actions via repository_dispatch event
- Validate webhook signatures (optional)
- Log all activities for debugging

**Runtime:** Node.js 18
**Deployment:** DigitalOcean App Platform

### 2. GitHub Actions Workflows

#### Deployment Workflow

**Location:** `.github/workflows/deploy.yml`

**Triggers:** Push to `main` branch

**Actions:**
- Checkout code
- Deploy to DigitalOcean App Platform using official action
- Update running functions automatically

#### Claude Investigation Workflow

**Location:** `.github/workflows/claude-investigator.yml`

**Triggers:** `repository_dispatch` event with type `error_investigation`

**Actions:**
1. Receive error payload from webhook handler
2. Display error information
3. Create error context file
4. Install Claude Code SDK
5. Run investigation with error context
6. Create PR with fixes (or GitHub issue as placeholder)

## Data Flow

```
┌─────────────┐
│  GlitchTip  │
│   (Heroku)  │
└──────┬──────┘
       │ Webhook POST
       ▼
┌─────────────────────────────┐
│ DigitalOcean Cloud Function │
│  glitchtip-webhook-handler  │
│                             │
│  1. Parse error payload     │
│  2. Validate (optional)     │
│  3. Extract error context   │
└──────┬──────────────────────┘
       │ GitHub API
       │ repository_dispatch
       ▼
┌─────────────────────────────┐
│    GitHub Actions Runner    │
│  claude-investigator.yml    │
│                             │
│  1. Receive error context   │
│  2. Checkout repository     │
│  3. Install Claude Code     │
│  4. Run investigation       │
└──────┬──────────────────────┘
       │ Claude Code API
       ▼
┌─────────────────────────────┐
│      Claude Code Agent      │
│                             │
│  1. Analyze error           │
│  2. Search codebase         │
│  3. Identify root cause     │
│  4. Implement fix           │
│  5. Write tests             │
└──────┬──────────────────────┘
       │ Git operations
       ▼
┌─────────────────────────────┐
│    Pull Request Created     │
│                             │
│  - Fix implementation       │
│  - Test coverage            │
│  - Error context reference  │
└─────────────────────────────┘
```

## Configuration

### Environment Variables

**DigitalOcean (Function Runtime):**
- `GITHUB_TOKEN` - GitHub PAT with `repo` scope (SECRET)
- `GITHUB_REPO_OWNER` - Repository owner/org name
- `GITHUB_REPO_NAME` - Target repository name
- `WEBHOOK_SECRET` - Optional webhook validation (SECRET)

**GitHub Actions (Secrets):**
- `DIGITALOCEAN_ACCESS_TOKEN` - For deployment automation
- `ANTHROPIC_API_KEY` - For Claude Code SDK
- `GITHUB_TOKEN` - Automatically provided by GitHub

### DigitalOcean App Platform Spec

**File:** `.digitalocean/spec.staging.yaml`

Defines:
- Function name and runtime
- Route configuration
- Environment variables
- Resource limits

### DigitalOcean Functions Config

**File:** `project.yml`

Defines:
- Namespace configuration
- Package structure
- Function parameters
- Environment variable mappings

## Security

### Secrets Management

1. **DigitalOcean Secrets:**
   - Encrypted at rest
   - Available only at runtime
   - Never logged or exposed

2. **GitHub Secrets:**
   - Encrypted storage
   - Masked in workflow logs
   - Scoped to repository or organization

### Webhook Validation

Optional HMAC validation for webhook requests:
- GlitchTip sends signature in header
- Cloud function validates using shared secret
- Rejects unauthorized requests

### GitHub API Access

- Personal Access Token (PAT) with minimal scope
- Only `repo` permission required
- Can be fine-grained for specific repository

## Monitoring & Debugging

### DigitalOcean Logs

```bash
# Via doctl
doctl apps logs <app-id> --type run --follow

# Via App Platform UI
Dashboard → Apps → automations → Runtime Logs
```

### GitHub Actions Logs

- Available in GitHub UI under Actions tab
- Each workflow run shows detailed logs
- Error context preserved in artifacts

### Error Tracking

All components log structured JSON for easy parsing:

```json
{
  "timestamp": "2026-01-18T20:00:00Z",
  "component": "glitchtip-webhook",
  "level": "info",
  "message": "Triggered GitHub Action",
  "errorId": "abc123",
  "repo": "flexy-tools/flexy-v2-backend"
}
```

## Scalability

### DigitalOcean Functions

- Auto-scaling based on demand
- Cold start: ~100-500ms
- Concurrent execution supported
- Free tier: 90,000 GB-seconds/month

### GitHub Actions

- Concurrent workflow runs supported
- Queue management automatic
- Rate limits: 1,000 API requests/hour (PAT)
- Free tier: 2,000 minutes/month

## Future Enhancements

1. **Multi-Repository Support**
   - Route errors to different repos based on tags
   - Centralized error dashboard

2. **Enhanced Error Analysis**
   - Historical error patterns
   - Regression detection
   - Impact analysis

3. **Notification Integrations**
   - Slack notifications for investigations
   - Email summaries
   - Metrics dashboard

4. **Advanced Claude Integration**
   - Custom investigation prompts
   - Context-aware fixes
   - Test generation improvements

5. **Performance Optimization**
   - Caching for frequent errors
   - Batch processing for similar errors
   - Parallel investigation for multiple issues
