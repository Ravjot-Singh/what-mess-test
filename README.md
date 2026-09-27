# WhatsApp Sender

One button. Press it, and the server sends a pre-approved WhatsApp template through the
Twilio API to a fixed number. The page shows the response and nothing else.

```bash
npm install
npm run ui        # http://localhost:3000
```

## Configuration

All five are required, and none of them ever reaches the browser:

| Variable | |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Same panel, click to reveal |
| `TWILIO_WHATSAPP_FROM` | Your account's WhatsApp sender, as `whatsapp:+…` |
| `MY_WHATSAPP_TO` | The recipient, as `whatsapp:+…`. Must have joined your sandbox |
| `TWILIO_CONTENT_SID` | The pre-approved template to send, `HX…` |

Locally: `Copy-Item .env.example .env` and fill it in. `.env` is gitignored.

### Finding your `TWILIO_CONTENT_SID`

A Twilio **trial account refuses free-form text at account level** — not per sender, and
not related to the 24-hour window — so a template `ContentSid` is the only way to send
anything. Getting hold of one is awkward, because the Console pages that list templates are
upgrade-gated and every listing API returns *"not available on a Trial account"*.

The way through: the Console's own **Try out WhatsApp** UI sends successfully, which means
it makes the same API call. Read the SID out of its request.

1. Open the Console's **Try out WhatsApp** page
2. Press **F12** → **Network**
3. Send a message from that UI
4. Click the `POST` request → **Payload**
5. Copy the `ContentSid` value

## Deploying to Vercel

Already set up:

- `server.js` exports the Express app and only calls `listen()` when run directly, because
  Vercel invokes a handler per request rather than running a long-lived process.
- `api/index.js` hands the app to Vercel; `vercel.json` routes every path to it.

Set the five variables in **Vercel → Settings → Environment Variables**, then redeploy.

> ### ⚠️ A public URL lets anyone spend your quota
>
> The button uses **your** credentials. Anyone who finds the link can trigger real messages
> and burn through the trial allowance. They cannot message anyone else — the recipient is
> fixed server-side — and they cannot read your credentials.
>
> A 3-second server-side cooldown limits the rate, but not the total. For a demo you are
> present at this is fine. If the link will sit public, put the deployment behind Vercel's
> password protection.

## Privacy

Nothing identifying is sent to the browser: no phone numbers, no Account SID, no Content
SID, and not the sent message's SID either. The response carries only `status` and a
timestamp.

Twilio's error messages can embed the number or SID that was rejected, so
`redactText()` in `lib/twilio.js` scrubs them before any error text is returned. It
deliberately over-matches — any alphanumeric run of roughly SID length after a known Twilio
prefix is replaced, not just strict hex.

## Files

| File | |
| --- | --- |
| `public/index.html` | The page: one button and a response area |
| `lib/twilio.js` | Config validation, redaction, and the send |
| `server.js` | Express app with a single `POST /api/send` route |
| `api/index.js`, `vercel.json` | Vercel wiring |
