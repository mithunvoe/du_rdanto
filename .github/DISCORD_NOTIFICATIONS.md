# Discord Notifications Setup Guide

This guide explains how to set up Discord notifications for your CI/CD pipeline to receive real-time updates on builds, deployments, and security scans.

## Overview

The project includes Discord webhook integration for the following workflows:

| Workflow              | Notification Type                         | When it Notifies                     |
| --------------------- | ----------------------------------------- | ------------------------------------ |
| **CI/CD Pipeline**    | Build status with detailed job results    | On every push/PR (always)            |
| **VPS Deployment**    | Deployment success/failure with URLs      | After deployment completes           |
| **CodeQL Security**   | Security analysis results                 | On failure or weekly scheduled scans |
| **Manual Deployment** | Manual deployment status with environment | After manual deployment completes    |

## Setup Instructions

### Step 1: Create a Discord Webhook

1. **Open Discord Server Settings**
   - Navigate to your Discord server
   - Click on **Server Settings** (gear icon)
   - Select **Integrations** from the left sidebar

2. **Create a Webhook**
   - Click **Webhooks** or **Create Webhook**
   - Click **New Webhook**
   - Give it a name (e.g., "CI/CD Bot" or "Deployment Bot")
   - Select the channel where notifications should appear (e.g., `#deployments`, `#ci-cd`, `#builds`)
   - Click **Copy Webhook URL**

3. **Save the Webhook URL**
   - Keep this URL secure - it allows posting messages to your Discord channel

### Step 2: Add Webhook to GitHub Secrets

1. **Navigate to Repository Settings**
   - Go to your GitHub repository: https://github.com/mithunvoe/du_rdanto
   - Click **Settings** (top menu)

2. **Add Secret**
   - In the left sidebar, click **Secrets and variables** → **Actions**
   - Click **New repository secret**

3. **Create the Secret**
   - **Name:** `DISCORD_WEBHOOK`
   - **Value:** Paste the webhook URL you copied from Discord
   - Click **Add secret**

### Step 3: Test the Integration

Push a commit to the main branch or trigger a workflow manually to test:

```bash
# Push a commit
git commit --allow-empty -m "test: trigger Discord notification"
git push origin main
```

Or trigger manually:

1. Go to **Actions** tab in GitHub
2. Select **CI/CD Pipeline** workflow
3. Click **Run workflow**
4. Check your Discord channel for the notification

## Notification Examples

### CI/CD Pipeline Notification

```
🚀 CI/CD Pipeline [Success/Failure]

Repository: mithunvoe/du_rdanto
Branch: main
Commit: [abc1234] - "Add new feature"
Author: username

Job Status:
✅ Lint & Format
✅ E2E Tests
✅ Docker Build
✅ Security Scan

[View Workflow Run] (clickable link)
```

**Color Coding:**

- 🟢 Green: All jobs succeeded
- 🔴 Red: One or more jobs failed

### VPS Deployment Notification

```
🚢 VPS Deployment [Success/Failure]

Environment: Production VPS
Host: http://36.255.70.236:3000
Commit: [abc1234] - "Deploy new version"
Triggered by: username

🔗 View API
📚 API Documentation

[View Deployment] (clickable link)
```

**Color Coding:**

- 🟢 Green: Deployment successful
- 🔴 Red: Deployment failed

### CodeQL Security Analysis Notification

```
🔒 CodeQL Security Analysis [Success/Warning]

Repository: mithunvoe/du_rdanto
Branch: main
Trigger: Scheduled Weekly Scan / Push Event
Analysis Status: ✅ No Issues Found / ⚠️ Security Issues Detected

🔍 View Security Findings (if issues found)

[View Analysis Results] (clickable link)
```

**Color Coding:**

- 🟢 Green: No security issues
- 🟠 Orange: Security issues detected

**When it Notifies:**

- On failures (security issues detected)
- On scheduled weekly scans (Mondays at 00:00 UTC)
- NOT on successful push/PR (to reduce noise)

### Manual Deployment Notification

```
🎯 Manual Deployment [Success/Failure]

Environment: production / staging / development
Repository: mithunvoe/du_rdanto
Commit: [abc1234] - "Manual deploy"
Triggered by: username
Tests: Passed / Skipped

Status: Deployment to production succeeded

[View Deployment] (clickable link)
```

## Advanced Configuration

### Multiple Webhooks (Optional)

If you want different channels for different types of notifications:

1. Create multiple webhooks in Discord for different channels
2. Add multiple secrets in GitHub:
   - `DISCORD_WEBHOOK` - Default webhook (all notifications)
   - `DISCORD_WEBHOOK_CI` - CI/CD pipeline only
   - `DISCORD_WEBHOOK_DEPLOY` - Deployments only
   - `DISCORD_WEBHOOK_SECURITY` - Security scans only

3. Modify workflows to use specific webhooks (if needed)

### Customizing Notifications

To customize notification appearance, edit the workflow files:

**Color Codes:**

- `0x00FF00` - Green (success)
- `0xFF0000` - Red (failure)
- `0xFFA500` - Orange (warning)
- `0xFFFF00` - Yellow (info)
- `0x0099FF` - Blue (info)

**Username and Avatar:**

```yaml
username: "Your Bot Name"
avatar_url: "https://your-avatar-url.png"
```

### Disabling Notifications

To temporarily disable notifications without removing the secret:

1. Comment out the Discord notification step in the workflow
2. Or remove the `DISCORD_WEBHOOK` secret from GitHub

## Troubleshooting

### Notifications Not Appearing

**Check 1: Webhook URL is Correct**

- Verify the webhook URL in GitHub Secrets
- Test the webhook manually using curl:
  ```bash
  curl -X POST -H "Content-Type: application/json" \
    -d '{"content":"Test message"}' \
    YOUR_WEBHOOK_URL
  ```

**Check 2: Workflow Permissions**

- Ensure GitHub Actions has permission to access secrets
- Check workflow logs for authentication errors

**Check 3: Discord Channel Permissions**

- Ensure the webhook has permission to post in the channel
- Check Discord server settings

### Notifications are Truncated

Discord has a 2000 character limit for embeds. If notifications are cut off:

- Reduce the description length in workflow files
- Remove unnecessary details
- Use links instead of full text

### Too Many Notifications

**Reduce CodeQL Notifications:**

- The CodeQL workflow only notifies on failures or scheduled scans
- To reduce further, modify the condition in `.github/workflows/codeql.yml`

**Rate Limiting:**

- Discord webhooks are limited to 30 requests per minute
- If you hit this limit, consider batching notifications or reducing frequency

## Security Best Practices

1. **Never commit webhook URLs** - Always use GitHub Secrets
2. **Rotate webhooks regularly** - Generate new webhooks periodically
3. **Limit webhook scope** - Use different webhooks for different channels
4. **Monitor webhook usage** - Check Discord audit logs for unauthorized usage

## Notification Features

### Rich Embeds

- Color-coded status indicators
- Clickable links to workflows, commits, and deployments
- Formatted markdown for readability

### Contextual Information

- Commit SHA and message
- Branch name
- Author/trigger person
- Timestamp (UTC)
- Job-specific status

### Action Links

- Direct links to workflow runs
- Links to deployment URLs
- Links to security findings
- Links to API documentation

## Support

For issues or questions:

- Check GitHub Actions logs for errors
- Review Discord webhook settings
- Consult GitHub Actions documentation
- Test webhook URLs manually with curl

## Additional Resources

- [Discord Webhooks Documentation](https://discord.com/developers/docs/resources/webhook)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [sarisia/actions-status-discord](https://github.com/sarisia/actions-status-discord) - The action used for notifications
