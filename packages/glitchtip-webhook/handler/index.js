/**
 * GlitchTip Webhook Handler
 * Receives error notifications from GlitchTip and triggers GitHub Actions
 */

import fetch from 'node-fetch';

/**
 * Parse GlitchTip webhook payload and extract relevant error information
 */
function parseGlitchTipError(payload) {
  const event = payload.event || payload.data?.event || payload;

  return {
    errorId: event.id || event.event_id || 'unknown',
    title: event.title || event.message || 'Unknown Error',
    message: event.message || event.title || '',
    level: event.level || 'error',
    platform: event.platform || 'unknown',
    culprit: event.culprit || '',
    timestamp: event.timestamp || new Date().toISOString(),
    tags: event.tags || {},
    context: event.contexts || {},
    stacktrace: extractStacktrace(event),
    breadcrumbs: event.breadcrumbs || [],
    user: event.user || {},
    environment: event.environment || 'production',
    release: event.release || 'unknown',
    url: event.url || payload.url || '',
    projectName: payload.project?.name || event.project || 'unknown'
  };
}

/**
 * Extract stacktrace from GlitchTip event
 */
function extractStacktrace(event) {
  if (event.exception?.values?.[0]?.stacktrace) {
    return event.exception.values[0].stacktrace;
  }
  if (event.stacktrace) {
    return event.stacktrace;
  }
  return null;
}

/**
 * Trigger GitHub repository_dispatch event
 */
async function triggerGitHubAction(errorData) {
  const {
    GITHUB_TOKEN,
    GITHUB_REPO_OWNER,
    GITHUB_REPO_NAME
  } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    throw new Error('Missing required GitHub environment variables');
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/dispatches`;

  const payload = {
    event_type: 'error_investigation',
    client_payload: {
      error: errorData,
      source: 'glitchtip',
      timestamp: new Date().toISOString()
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'GlitchTip-Webhook-Handler'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
  }

  return {
    success: true,
    statusCode: response.status,
    repo: `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`
  };
}

/**
 * Validate webhook signature (optional)
 */
function validateWebhookSignature(payload, signature) {
  const { WEBHOOK_SECRET } = process.env;

  if (!WEBHOOK_SECRET) {
    return true; // Skip validation if no secret is configured
  }

  // Implement HMAC validation if GlitchTip supports it
  // For now, we'll skip this
  return true;
}

/**
 * Main handler function
 */
export async function main(args) {
  const startTime = Date.now();

  try {
    console.log('[GlitchTip Webhook] Received webhook call');
    console.log('[GlitchTip Webhook] Headers:', JSON.stringify(args.__ow_headers || {}, null, 2));

    // Extract payload from args
    const payload = args;

    // Validate webhook signature
    const signature = args.__ow_headers?.['x-glitchtip-signature'];
    if (!validateWebhookSignature(payload, signature)) {
      return {
        statusCode: 401,
        body: { error: 'Invalid webhook signature' }
      };
    }

    // Parse error data
    const errorData = parseGlitchTipError(payload);
    console.log('[GlitchTip Webhook] Parsed error:', JSON.stringify(errorData, null, 2));

    // Trigger GitHub Action
    const result = await triggerGitHubAction(errorData);
    console.log('[GlitchTip Webhook] GitHub Action triggered:', JSON.stringify(result, null, 2));

    const duration = Date.now() - startTime;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        success: true,
        message: 'Error investigation triggered',
        errorId: errorData.errorId,
        errorTitle: errorData.title,
        githubRepo: result.repo,
        processingTime: `${duration}ms`
      }
    };

  } catch (error) {
    console.error('[GlitchTip Webhook] Error:', error);

    const duration = Date.now() - startTime;

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        success: false,
        error: error.message,
        processingTime: `${duration}ms`
      }
    };
  }
}
