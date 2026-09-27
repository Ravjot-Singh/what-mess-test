'use strict';

/**
 * Everything the sender needs: config, redaction, and the send itself.
 *
 * Sending is one authenticated form POST to Twilio's Messages endpoint. The
 * `whatsapp:` prefix on From/To is the only WhatsApp-specific part - drop it and
 * the same endpoint sends an SMS.
 *
 * Only template sends are supported. A Twilio trial account refuses free-form
 * `Body` text at account level, so a `ContentSid` naming a pre-approved template
 * is the only thing that works.
 */

const REQUIRED = [
  { key: 'TWILIO_ACCOUNT_SID', field: 'accountSid' },
  { key: 'TWILIO_AUTH_TOKEN', field: 'authToken' },
  { key: 'TWILIO_WHATSAPP_FROM', field: 'from' },
  { key: 'MY_WHATSAPP_TO', field: 'to' },
  { key: 'TWILIO_CONTENT_SID', field: 'contentSid' },
];

const PLACEHOLDERS = new Set([
  'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'your_auth_token_here',
  'whatsapp:+919876543210',
]);

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Strips identifying values out of text bound for the browser.
 *
 * Needed even though the page displays no configuration: Twilio's own error
 * messages embed the phone number or SID that was rejected, and this app is
 * deployed publicly.
 *
 * The SID pattern is deliberately looser than Twilio's real format (prefix plus
 * 32 hex). Redaction should over-match rather than under-match.
 */
const SID_PATTERN = /\b(AC|SM|MM|HX|MG|SK|IM|CH|WA)[0-9a-zA-Z]{28,36}\b/g;
const PHONE_PATTERN = /\+[\d][\d\s\-().]{6,20}\d/g;
const BARE_DIGITS_PATTERN = /\b\d{8,15}\b/g;

function redactText(text) {
  if (text === null || text === undefined) return text;
  return String(text)
    .replace(SID_PATTERN, (_m, prefix) => `${prefix}<redacted>`)
    .replace(PHONE_PATTERN, '+<redacted>')
    .replace(BARE_DIGITS_PATTERN, '<redacted>');
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * @returns {{ok: true, config: object} | {ok: false, missing: string[]}}
 *
 * Reports variable NAMES only. No value, valid or otherwise, is ever returned.
 */
function loadConfig(env = process.env) {
  const missing = [];
  const config = {};

  for (const { key, field } of REQUIRED) {
    const value = (env[key] || '').trim();
    if (!value || PLACEHOLDERS.has(value)) {
      missing.push(key);
    } else {
      config[field] = value;
    }
  }

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, config };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Plain-English notes for the failures still reachable in template-only mode. */
const ERROR_NOTES = {
  20003: 'Authentication failed — the Account SID or Auth Token is wrong.',
  21211: 'The recipient number is not a valid phone number.',
  21655: 'That Content SID does not exist on this account.',
  63007: 'No WhatsApp sender is configured for that From address.',
  63015: 'The recipient has not joined the sandbox.',
  63016: 'Outside the 24-hour messaging window.',
  63018: 'Rate limited by Twilio — one message every three seconds.',
  63024:
    'WhatsApp will not deliver to this recipient: the number is not enabled for WhatsApp, ' +
    'has not accepted WhatsApp\'s terms, or is on an unsupported client version.',
};

// Node/OS-level failures, meaning the request never reached Twilio.
const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'CERT_HAS_EXPIRED',
]);

/**
 * Sends the configured template.
 *
 * Returns a flat, already-redacted result rather than throwing, so the route
 * handler stays trivial. Deliberately omits the message SID: the page needs to
 * know the send was accepted and its status, not an account-scoped identifier.
 */
async function send(config) {
  let twilio;
  try {
    twilio = require('twilio');
  } catch (err) {
    return { ok: false, message: 'Server is missing its dependencies.' };
  }

  const client = twilio(config.accountSid, config.authToken);

  try {
    const message = await client.messages.create({
      from: config.from,
      to: config.to,
      contentSid: config.contentSid,
    });
    return { ok: true, status: message.status, dateCreated: message.dateCreated };
  } catch (err) {
    const code = err.code ?? err.cause?.code ?? null;

    if (NETWORK_CODES.has(code)) {
      return {
        ok: false,
        code,
        message: 'Could not reach Twilio — the request never left the server.',
        note: 'A network or DNS problem. Nothing was sent.',
      };
    }

    return {
      ok: false,
      code,
      message: redactText(err.message),
      note: ERROR_NOTES[code] ?? null,
    };
  }
}

module.exports = { loadConfig, send, redactText, ERROR_NOTES };
