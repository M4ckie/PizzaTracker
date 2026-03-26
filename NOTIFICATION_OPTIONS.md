# Notification Options for PizzaDoughWeb

A reference guide for all the ways to add dough fermentation reminders.

---

## 1. Telegram Bot

- **Cost**: Free, unlimited messages
- **Setup time**: ~5 minutes
- **How it works**: Create a bot via @BotFather in Telegram. Your app sends messages to the bot, which forwards them to your chat.
- **Steps to get started**:
  1. Open Telegram, search for `@BotFather`
  2. Send `/newbot`, follow the prompts to name it
  3. Copy the API token it gives you
  4. Message your new bot so it can discover your chat ID
  5. Your app uses the token + chat ID to send notifications
- **Python approach**: `python-telegram-bot` library, or plain HTTP POST to `https://api.telegram.org/bot<TOKEN>/sendMessage`
- **Docs**: https://core.telegram.org/bots/tutorial

---

## 2. Discord Webhook

- **Cost**: Free, no rate limits for personal use
- **Setup time**: ~3 minutes
- **How it works**: Create a webhook URL for a Discord channel. Your app POSTs a JSON payload to that URL and the message appears in the channel.
- **Steps to get started**:
  1. Create a Discord server (or use an existing one)
  2. Go to Server Settings > Integrations > Webhooks
  3. Create a webhook, copy the URL
  4. POST `{"content": "Your message"}` to that URL
- **Python approach**: `requests.post(webhook_url, json={"content": msg})` -- no special library needed
- **Docs**: https://discord.com/developers/docs/resources/webhook

---

## 3. Ntfy.sh (Self-Hostable Push Notifications)

- **Cost**: Free (public server or self-hosted)
- **Setup time**: ~2 minutes (public) / ~15 minutes (self-hosted)
- **How it works**: Subscribe to a topic in the Ntfy app, then POST messages to that topic. Instant push notification.
- **Steps to get started**:
  1. Install the Ntfy app on your phone (Android/iOS)
  2. Subscribe to a topic, e.g. `pizzadough-reminders`
  3. Send a notification: `curl -d "Your dough is ready" ntfy.sh/pizzadough-reminders`
  4. Optionally self-host the Ntfy server in Docker alongside your app
- **Python approach**: `requests.post("https://ntfy.sh/your-topic", data="message")` -- no library needed
- **Self-hosting**: `docker run -p 8080:80 binwiederhier/ntfy serve`
- **Docs**: https://docs.ntfy.sh/

---

## 4. Gotify (Fully Self-Hosted)

- **Cost**: Free
- **Setup time**: ~15 minutes
- **How it works**: Run a Gotify server in Docker. It provides a web UI and Android app for receiving push notifications.
- **Steps to get started**:
  1. Run: `docker run -p 8080:80 gotify/server`
  2. Log into the web UI, create an application, get an API token
  3. POST messages to `http://localhost:8080/message?token=<TOKEN>`
  4. Install the Gotify Android app, point it at your server
- **Python approach**: `requests.post(url, json={"title": "Pizza Dough", "message": msg})`
- **Limitations**: Android only (no iOS app)
- **Docs**: https://gotify.net/docs/

---

## 5. Email-to-SMS Gateway (Carrier Gateway)

- **Cost**: Free
- **Setup time**: ~5 minutes
- **How it works**: Most US carriers have email addresses that deliver as SMS. Send an email to `phonenumber@gateway` and it arrives as a text.
- **Common gateways**:
  - T-Mobile: `number@tmomail.net`
  - AT&T: `number@txt.att.net`
  - Verizon: `number@vtext.com`
  - Sprint: `number@messaging.sprintpcs.com`
- **Python approach**: Use built-in `smtplib` with a Gmail app password or any SMTP server
- **Limitations**: Unreliable, carrier-dependent, may be blocked as spam, no delivery confirmation

---

## 6. Signal CLI

- **Cost**: Free
- **Setup time**: ~30 minutes
- **How it works**: `signal-cli` is a command-line client for Signal. Register a phone number, then send messages programmatically.
- **Steps to get started**:
  1. Install signal-cli (Java required)
  2. Register or link a phone number
  3. Send: `signal-cli -u +1234567890 send -m "message" +0987654321`
- **Python approach**: Subprocess call to signal-cli, or use `signal-cli-rest-api` Docker container for HTTP access
- **Limitations**: Requires Java, needs a dedicated phone number, heavier setup
- **Docs**: https://github.com/AsamK/signal-cli

---

## 7. Twilio SMS (Paid)

- **Cost**: ~$1.50/month for a number + $0.0079/text sent
- **Setup time**: ~10 minutes
- **How it works**: Sign up for Twilio, get a phone number, send SMS via their API.
- **Steps to get started**:
  1. Create a Twilio account (free trial includes ~$15 credit)
  2. Get a phone number from the console
  3. Note your Account SID and Auth Token
  4. Use the `twilio` Python library to send messages
- **Python approach**: `pip install twilio`, then use `Client(sid, token).messages.create(...)`
- **Docs**: https://www.twilio.com/docs/sms/quickstart/python

---

## Implementation Priority

1. **Telegram Bot** -- first implementation
2. **Discord Webhook** -- second implementation
3. Remaining options -- explore as needed
