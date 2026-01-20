# Deployment Guide

## Prerequisites

1. **DigitalOcean Account**
   - Active account with App Platform access
   - API token with write permissions
   - Payment method configured (free tier available)

2. **GitHub Account**
   - Organization or personal account
   - Admin access to target repositories
   - Ability to create PATs and manage secrets

3. **GlitchTip Instance**
   - Running instance (Heroku, self-hosted, etc.)
   - Admin access to configure webhooks
   - Project created for monitoring

4. **Claude API Access**
   - Anthropic API key
   - Available credits/subscription

## Initial Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/flexy-tools/automations.git
cd automations
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```bash
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO_OWNER=flexy-tools
GITHUB_REPO_NAME=flexy-v2-backend
WEBHOOK_SECRET=your_secret_here
DIGITALOCEAN_ACCESS_TOKEN=dop_v1_your_token_here
```

## Deployment Methods

### Method 1: Automatic Deployment (Recommended)

This method uses GitHub Actions for continuous deployment.

#### 1. Configure GitHub Secrets

Go to: `Settings → Secrets and variables → Actions`

Add these secrets:
- `DIGITALOCEAN_ACCESS_TOKEN` - Your DigitalOcean API token
- `ANTHROPIC_API_KEY` - Your Claude API key

#### 2. Push to Main Branch

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

GitHub Actions will automatically deploy to DigitalOcean.

#### 3. Monitor Deployment

Check deployment status:
- GitHub: `Actions` tab
- DigitalOcean: App Platform dashboard

### Method 2: Manual Deployment via doctl

#### 1. Install doctl

```bash
# macOS
brew install doctl

# Linux
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf ~/doctl-1.98.1-linux-amd64.tar.gz
sudo mv ~/doctl /usr/local/bin
```

#### 2. Authenticate

```bash
doctl auth init
# Enter your DigitalOcean API token when prompted
```

#### 3. Install Serverless Plugin

```bash
doctl serverless install
```

#### 4. Connect to Namespace

```bash
doctl serverless connect
```

#### 5. Deploy Functions

```bash
doctl serverless deploy .
```

#### 6. Get Function URL

```bash
doctl serverless functions get glitchtip-webhook/handler --url
```

### Method 3: DigitalOcean App Platform UI

#### 1. Create New App

1. Go to DigitalOcean → App Platform
2. Click "Create App"
3. Select "GitHub" as source
4. Choose `flexy-tools/automations` repository
5. Select `main` branch

#### 2. Configure App

The `.digitalocean/spec.staging.yaml` file will be auto-detected.

Review settings:
- Function name: `glitchtip-webhook-handler`
- Runtime: Node.js 18
- Region: NYC1 (or your preferred region)

#### 3. Set Environment Variables

Add these environment variables (mark secrets as encrypted):
- `GITHUB_TOKEN` (SECRET)
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `WEBHOOK_SECRET` (SECRET)

#### 4. Deploy

Click "Create Resources" and wait for deployment to complete.

## Post-Deployment Configuration

### Configure GlitchTip Webhook

1. Log into your GlitchTip instance
2. Navigate to your project
3. Go to Settings → Alerts
4. Click "Add Alert Recipient"
5. Select "Webhook"
6. Enter your function URL:
   ```
   https://automations-xxxxx.ondigitalocean.app/glitchtip-webhook
   ```
7. Save the configuration

### Configure Target Repository

The repository where Claude Code will create PRs needs:

1. **Enable Actions**
   - Go to repository settings
   - Enable GitHub Actions if not already enabled

2. **Configure Branch Protection (Optional)**
   - Require PR reviews
   - Require status checks
   - Prevent force pushes

## Verification

### Test the Webhook

Send a test payload:

```bash
curl -X POST https://your-app.ondigitalocean.app/glitchtip-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "id": "test-error-123",
      "title": "Test Error from Deployment",
      "message": "Testing the webhook handler",
      "level": "error",
      "platform": "python",
      "culprit": "test.py",
      "timestamp": "2026-01-18T20:00:00Z"
    }
  }'
```

Expected response:

```json
{
  "success": true,
  "message": "Error investigation triggered",
  "errorId": "test-error-123",
  "errorTitle": "Test Error from Deployment",
  "githubRepo": "flexy-tools/flexy-v2-backend",
  "processingTime": "234ms"
}
```

### Verify GitHub Action Triggered

1. Go to target repository
2. Click "Actions" tab
3. Look for "Claude Code Error Investigation" workflow
4. Verify it shows a run triggered by `repository_dispatch`

### Check DigitalOcean Logs

```bash
# Get app ID
doctl apps list

# View logs
doctl apps logs <app-id> --type run --follow
```

## Monitoring

### DigitalOcean Monitoring

- **App Platform Dashboard**: Real-time metrics
- **Runtime Logs**: Function execution logs
- **Metrics**: Request count, response times, errors

### GitHub Actions Monitoring

- **Workflow Runs**: All investigation runs
- **Logs**: Detailed execution logs
- **Artifacts**: Error context files

### Set Up Alerts

#### DigitalOcean Alerts

1. Go to App Platform → Monitoring
2. Configure alerts for:
   - High error rate
   - Slow response times
   - Resource usage

#### GitHub Alerts

GitHub will email you on workflow failures by default.

## Troubleshooting

### Deployment Fails

**Check GitHub Actions logs:**
```bash
gh run list --repo flexy-tools/automations
gh run view <run-id> --log
```

**Common issues:**
- Missing `DIGITALOCEAN_ACCESS_TOKEN` secret
- Invalid `.digitalocean/spec.staging.yaml` syntax
- Insufficient DigitalOcean quota

### Function Not Responding

**Check function logs:**
```bash
doctl apps logs <app-id> --type run
```

**Common issues:**
- Missing environment variables
- Invalid GitHub token
- Network connectivity issues

### GitHub Action Not Triggering

**Verify repository_dispatch:**
- Check GitHub API rate limits
- Verify `GITHUB_TOKEN` has `repo` scope
- Ensure workflow file is on default branch

**Test manually:**
```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/flexy-tools/flexy-v2-backend/dispatches \
  -d '{"event_type":"error_investigation","client_payload":{"error":{"errorId":"test-123"}}}'
```

## Rollback Procedure

### Rollback DigitalOcean Deployment

```bash
# List deployments
doctl apps list-deployments <app-id>

# Rollback to previous deployment
doctl apps create-deployment <app-id> --deployment-id <previous-deployment-id>
```

### Rollback GitHub Deployment

```bash
# Revert commit
git revert <commit-hash>
git push origin main
```

## Scaling

### Increase Function Resources

Edit `.digitalocean/spec.staging.yaml`:

```yaml
functions:
  - name: glitchtip-webhook-handler
    # ... existing config ...
    instance_size_slug: professional-xs  # Upgrade from basic
    instance_count: 2  # Increase instances
```

### Rate Limiting

Add rate limiting to prevent abuse:

```javascript
// In webhook handler
const rateLimit = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const requests = rateLimit.get(ip) || [];
  const recentRequests = requests.filter(t => now - t < 60000);

  if (recentRequests.length >= 10) {
    return false;
  }

  recentRequests.push(now);
  rateLimit.set(ip, recentRequests);
  return true;
}
```

## Maintenance

### Update Dependencies

```bash
npm update
npm audit fix
git commit -am "Update dependencies"
git push origin main
```

### Monitor Costs

- DigitalOcean: App Platform dashboard → Billing
- GitHub Actions: Settings → Billing → Actions usage
- Claude API: Anthropic console → Usage

### Backup Configuration

Regularly backup:
- `.digitalocean/spec.staging.yaml`
- `project.yml`
- Environment variable configurations
- GlitchTip webhook settings

## Support

For issues or questions:
- Internal team communication
- GitHub Issues (for this repo)
- DigitalOcean Support (for platform issues)
- Anthropic Support (for Claude API issues)
