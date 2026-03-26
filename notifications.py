from __future__ import annotations

import json
import urllib.request
import urllib.error


def send_telegram(bot_token: str, chat_id: str, message: str) -> dict:
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = json.dumps({"chat_id": chat_id, "text": message, "parse_mode": "HTML"}).encode()
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode())
            if resp.status == 200 and body.get("ok") is True:
                return {"ok": True}
            return {"ok": False, "error": f"Unexpected response: {body}"}
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode()
        except Exception:
            detail = str(exc)
        return {"ok": False, "error": f"HTTP {exc.code}: {detail}"}
    except urllib.error.URLError as exc:
        return {"ok": False, "error": f"URL error: {exc.reason}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def send_discord(webhook_url: str, message: str) -> dict:
    try:
        payload = json.dumps({"content": message}).encode()
        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "PizzaDoughWeb/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 204):
                return {"ok": True}
            return {"ok": False, "error": f"Unexpected status: {resp.status}"}
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode()
        except Exception:
            detail = str(exc)
        return {"ok": False, "error": f"HTTP {exc.code}: {detail}"}
    except urllib.error.URLError as exc:
        return {"ok": False, "error": f"URL error: {exc.reason}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def send_to_channel(channel, message: str) -> dict:
    try:
        config = json.loads(channel.config_json)
    except (json.JSONDecodeError, TypeError) as exc:
        return {"ok": False, "error": f"Invalid channel config: {exc}"}

    platform = channel.platform

    if platform == "telegram":
        try:
            bot_token = config["bot_token"]
            chat_id = config["chat_id"]
        except KeyError as exc:
            return {"ok": False, "error": f"Invalid channel config: missing key {exc}"}
        return send_telegram(bot_token, chat_id, message)

    if platform == "discord":
        try:
            webhook_url = config["webhook_url"]
        except KeyError as exc:
            return {"ok": False, "error": f"Invalid channel config: missing key {exc}"}
        return send_discord(webhook_url, message)

    return {"ok": False, "error": f"Unknown platform: {platform}"}
