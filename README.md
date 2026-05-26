# DeptAgent POC

AI-powered HR department chatbot with web UI + Slack integration.

## Running with Slack Integration

Two terminals needed:

```bash
# Terminal 1
pnpm dev

# Terminal 2
ngrok http 3000
```

**ngrok free plan generates a new URL every restart.** After restarting ngrok, update both URLs in Slack App settings:

1. https://api.slack.com/apps -> select your app
2. **Event Subscriptions** -> Request URL: `https://{new-ngrok-url}/api/slack/events`
3. **Interactivity & Shortcuts** -> Request URL: `https://{new-ngrok-url}/api/slack/interactions`

## Slack App Setup (one-time)

1. Create app at https://api.slack.com/apps -> "Create New App" -> "From scratch"
2. **OAuth & Permissions** -> Bot Token Scopes: `chat:write`, `im:history`, `im:read` -> Install to Workspace
3. **App Home** -> Enable "Messages Tab" + "Allow users to send Slash commands and messages"
4. **Event Subscriptions** -> Enable -> set Request URL -> Subscribe to `message.im`
5. **Interactivity & Shortcuts** -> Enable -> set Request URL
6. In Slack, create an admin channel and invite the bot: `/invite @DeptAgent`
7. Copy channel ID (click channel name -> bottom of popup) -> set as `SLACK_ADMIN_CHANNEL_ID` in `.env.local`

<!-- paths-filter validation: this non-docs edit should NOT trigger the Deploy Documentation workflow -->

