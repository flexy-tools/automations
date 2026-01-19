/**
 * BetterStack Webhook Handler
 * Receives error notifications from BetterStack and triggers GitHub Actions for Claude Code investigation
 */

import fetch from 'node-fetch';

/**
 * Parse BetterStack webhook payload and extract relevant error information
 */
function parseBetterStackError(payload) {
  const incident = payload.data || payload;
  const attributes = incident.attributes || {};

  // Extract application name from metadata
  const applicationMeta = attributes.metadata?.find(m => m.key === 'Application');
  const applicationName = applicationMeta?.value || 'unknown';

  // Extract error information from cause field
  const cause = attributes.cause || '';
  const errorType = extractErrorType(cause);
  const errorMessage = extractErrorMessage(cause);
  const stacktrace = extractStacktraceFromCause(cause);
  const filePath = extractFilePath(cause);

  return {
    errorId: incident.id || 'unknown',
    title: attributes.name || 'Unknown Error',
    message: errorMessage,
    errorType: errorType,
    level: 'error',
    platform: 'python',
    culprit: filePath,
    timestamp: attributes.started_at || new Date().toISOString(),
    tags: {},
    context: {
      cause: cause,
      metadata: attributes.metadata || []
    },
    stacktrace: stacktrace,
    breadcrumbs: [],
    user: {},
    environment: 'production',
    release: 'unknown',
    url: attributes.url || '',
    projectName: applicationName,
    incidentUrl: attributes.url || ''
  };
}

/**
 * Extract error type from BetterStack cause field
 * Example: "**ZeroDivisionError**" -> "ZeroDivisionError"
 */
function extractErrorType(cause) {
  const match = cause.match(/\*\*([^*]+)\*\*/);
  return match ? match[1] : 'Unknown';
}

/**
 * Extract error message from BetterStack cause field
 * Example: "```\ndivision by zero\n```" -> "division by zero"
 */
function extractErrorMessage(cause) {
  const match = cause.match(/```\n([^`]+)\n```/);
  return match ? match[1].trim() : 'No error message';
}

/**
 * Extract file path from BetterStack cause field
 * Example: "`flexy/urls.py` in `trigger_error`" -> "flexy/urls.py in trigger_error"
 */
function extractFilePath(cause) {
  const match = cause.match(/`([^`]+\.py)`\s+in\s+`([^`]+)`/);
  return match ? `${match[1]} in ${match[2]}` : 'unknown';
}

/**
 * Extract stacktrace information from BetterStack cause field
 */
function extractStacktraceFromCause(cause) {
  return {
    raw: cause,
    parsed: {
      errorType: extractErrorType(cause),
      errorMessage: extractErrorMessage(cause),
      filePath: extractFilePath(cause)
    }
  };
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
      source: 'betterstack',
      timestamp: new Date().toISOString()
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'BetterStack-Webhook-Handler'
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
    console.log('[BetterStack Webhook] Received webhook call');
    console.log('[BetterStack Webhook] Payload:', JSON.stringify(args, null, 2));

    // Extract payload from args
    const payload = args;

    // Validate webhook signature (BetterStack uses different signature header)
    const signature = args.__ow_headers?.['x-betterstack-signature'];
    if (!validateWebhookSignature(payload, signature)) {
      return {
        statusCode: 401,
        body: { error: 'Invalid webhook signature' }
      };
    }

    // Parse error data from BetterStack incident
    const errorData = parseBetterStackError(payload);
    console.log('[BetterStack Webhook] Parsed error:', JSON.stringify(errorData, null, 2));

    // Trigger GitHub Action for Claude Code investigation
    const result = await triggerGitHubAction(errorData);
    console.log('[BetterStack Webhook] GitHub Action triggered:', JSON.stringify(result, null, 2));

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
    console.error('[BetterStack Webhook] Error:', error);

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
