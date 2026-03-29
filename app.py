import json
import os
import urllib.request
import urllib.error
from datetime import date, datetime
from flask import Flask, jsonify, render_template, request
from flask_apscheduler import APScheduler
from models import db, Batch, Bake, NotificationChannel, Reminder
from dough import calculate
from notifications import send_to_channel

app = Flask(__name__)

db_path = os.path.join(app.instance_path, "pizzadough.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
app.config["SCHEDULER_API_ENABLED"] = False

with app.app_context():
    os.makedirs(app.instance_path, exist_ok=True)
    db.create_all()

    # Migrate: add notes column to bake table if missing
    with db.engine.connect() as conn:
        cols = [row[1] for row in conn.execute(db.text("PRAGMA table_info(bake)"))]
        if "notes" not in cols:
            conn.execute(db.text("ALTER TABLE bake ADD COLUMN notes TEXT"))
            conn.commit()

    # Auto-create notification channels from environment variables
    tg_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    tg_chat = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if tg_token and tg_chat:
        existing = NotificationChannel.query.filter_by(platform="telegram").first()
        if not existing:
            ch = NotificationChannel(
                platform="telegram",
                label="Telegram",
                config_json=json.dumps({"bot_token": tg_token, "chat_id": tg_chat}),
            )
            db.session.add(ch)
            db.session.commit()

    dc_url = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    if dc_url:
        existing = NotificationChannel.query.filter_by(platform="discord").first()
        if not existing:
            ch = NotificationChannel(
                platform="discord",
                label="Discord",
                config_json=json.dumps({"webhook_url": dc_url}),
            )
            db.session.add(ch)
            db.session.commit()


scheduler = APScheduler()


def check_reminders():
    """Find due unsent reminders and send them."""
    with app.app_context():
        now = datetime.now()
        due = Reminder.query.filter(
            Reminder.sent == False,
            Reminder.remind_at <= now,
        ).all()
        for r in due:
            channel = db.session.get(NotificationChannel, r.channel_id)
            if channel is None or not channel.enabled:
                r.sent = True
                r.error = "Channel deleted or disabled"
                r.sent_at = now
                continue
            result = send_to_channel(channel, r.message)
            r.sent = True
            r.sent_at = now
            if not result["ok"]:
                r.error = result["error"]
        db.session.commit()


if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
    scheduler.init_app(app)
    scheduler.add_job(
        id="check_reminders",
        func=check_reminders,
        trigger="interval",
        seconds=60,
        replace_existing=True,
    )
    scheduler.start()


# --- Page routes ---

@app.route("/")
def calculator_page():
    return render_template("calculator.html")


@app.route("/batches")
def batches_page():
    return render_template("batches.html")


@app.route("/settings")
def settings_page():
    return render_template("settings.html")


# --- API routes ---

@app.route("/api/calculate")
def api_calculate():
    try:
        size = float(request.args.get("size", 0))
        count = int(request.args.get("count", 0))
        thickness = request.args.get("thickness", "regular")
        gluten_free_raw = request.args.get("gluten_free", "false")
        gluten_free = gluten_free_raw.lower() in ("true", "1", "yes")
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid parameters"}), 400

    if size <= 0 or count <= 0:
        return jsonify({"error": "size and count must be greater than 0"}), 400

    if thickness not in ("thin", "regular", "thick"):
        return jsonify({"error": "thickness must be thin, regular, or thick"}), 400

    result = calculate(size_inches=size, count=count, thickness=thickness, gluten_free=gluten_free)
    return jsonify(result)


@app.route("/api/batches", methods=["GET"])
def api_batches_list():
    batches = Batch.query.order_by(Batch.made_date.desc(), Batch.id.desc()).all()
    return jsonify([b.to_dict() for b in batches])


@app.route("/api/batches", methods=["POST"])
def api_batches_create():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    try:
        size = int(data.get("size_inches", 0))
        count = int(data.get("count", 0))
        thickness = data.get("thickness", "regular")
        gluten_free = bool(data.get("gluten_free", False))
        notes = data.get("notes") or None
        made_date_str = data.get("made_date")
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid field values"}), 400

    if size <= 0 or count <= 0:
        return jsonify({"error": "size_inches and count must be greater than 0"}), 400

    if thickness not in ("thin", "regular", "thick"):
        return jsonify({"error": "thickness must be thin, regular, or thick"}), 400

    made_date = date.fromisoformat(made_date_str) if made_date_str else date.today()

    batch = Batch(
        made_date=made_date,
        size_inches=size,
        count=count,
        thickness=thickness,
        gluten_free=gluten_free,
        notes=notes,
    )
    db.session.add(batch)
    db.session.commit()
    return jsonify(batch.to_dict()), 201


@app.route("/api/batches/<int:batch_id>", methods=["PATCH"])
def api_batches_update(batch_id):
    batch = db.session.get(Batch, batch_id)
    if batch is None:
        return jsonify({"error": "Batch not found"}), 404

    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    if "notes" in data:
        batch.notes = data["notes"] or None

    db.session.commit()
    return jsonify(batch.to_dict())


@app.route("/api/batches/<int:batch_id>", methods=["DELETE"])
def api_batches_delete(batch_id):
    batch = db.session.get(Batch, batch_id)
    if batch is None:
        return jsonify({"error": "Batch not found"}), 404
    db.session.delete(batch)
    db.session.commit()
    return "", 204


# --- Bake events ---

@app.route("/api/batches/<int:batch_id>/bakes", methods=["POST"])
def api_bake_create(batch_id):
    batch = db.session.get(Batch, batch_id)
    if batch is None:
        return jsonify({"error": "Batch not found"}), 404

    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    try:
        quantity = int(data.get("quantity", 0))
        baked_date_str = data.get("baked_date")
        notes = data.get("notes") or None
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid field values"}), 400

    if quantity <= 0:
        return jsonify({"error": "quantity must be greater than 0"}), 400

    if quantity > batch.remaining:
        return jsonify({"error": f"Only {batch.remaining} pizzas remaining in this batch"}), 400

    baked_date = date.fromisoformat(baked_date_str) if baked_date_str else date.today()

    bake = Bake(batch_id=batch_id, baked_date=baked_date, quantity=quantity, notes=notes)
    db.session.add(bake)
    db.session.commit()
    return jsonify(batch.to_dict()), 201


@app.route("/api/bakes/<int:bake_id>", methods=["PATCH"])
def api_bake_update(bake_id):
    bake = db.session.get(Bake, bake_id)
    if bake is None:
        return jsonify({"error": "Bake not found"}), 404

    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    if "notes" in data:
        bake.notes = data["notes"] or None

    db.session.commit()
    return jsonify(bake.batch.to_dict())


@app.route("/api/bakes/<int:bake_id>", methods=["DELETE"])
def api_bake_delete(bake_id):
    bake = db.session.get(Bake, bake_id)
    if bake is None:
        return jsonify({"error": "Bake not found"}), 404
    batch = bake.batch
    db.session.delete(bake)
    db.session.commit()
    return jsonify(batch.to_dict())


@app.route("/api/batches/stats")
def api_batches_stats():
    total = Batch.query.count()
    last_made = Batch.query.order_by(Batch.made_date.desc()).first()
    last_bake = Bake.query.order_by(Bake.baked_date.desc()).first()
    total_baked = db.session.query(db.func.sum(Bake.quantity)).scalar() or 0
    return jsonify({
        "total_batches": total,
        "total_pizzas_baked": total_baked,
        "last_made_date": last_made.made_date.isoformat() if last_made else None,
        "last_baked_date": last_bake.baked_date.isoformat() if last_bake else None,
    })


@app.route("/api/channels")
def api_channels():
    channels = NotificationChannel.query.order_by(NotificationChannel.created_at.desc()).all()
    return jsonify([c.to_dict() for c in channels])


@app.route("/api/channels", methods=["POST"])
def api_channels_create():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    platform = data.get("platform")
    if platform not in ("telegram", "discord"):
        return jsonify({"error": "platform must be 'telegram' or 'discord'"}), 400

    label = data.get("label")
    if not label or not isinstance(label, str) or not label.strip():
        return jsonify({"error": "label is required"}), 400

    config = data.get("config")
    if not isinstance(config, dict):
        return jsonify({"error": "config is required"}), 400

    if platform == "telegram":
        if not isinstance(config.get("bot_token"), str) or not config["bot_token"].strip() \
                or not isinstance(config.get("chat_id"), str) or not config["chat_id"].strip():
            return jsonify({"error": "Telegram config requires bot_token and chat_id"}), 400
    elif platform == "discord":
        if not isinstance(config.get("webhook_url"), str) or not config["webhook_url"].strip():
            return jsonify({"error": "Discord config requires webhook_url"}), 400

    channel = NotificationChannel(
        platform=platform,
        label=label,
        config_json=json.dumps(config),
    )
    db.session.add(channel)
    db.session.commit()
    return jsonify(channel.to_dict()), 201


@app.route("/api/channels/<int:channel_id>", methods=["DELETE"])
def api_channels_delete(channel_id):
    channel = db.session.get(NotificationChannel, channel_id)
    if channel is None:
        return jsonify({"error": "Channel not found"}), 404
    db.session.delete(channel)
    db.session.commit()
    return "", 204


@app.route("/api/channels/<int:channel_id>/test", methods=["POST"])
def api_channel_test(channel_id):
    channel = db.session.get(NotificationChannel, channel_id)
    if not channel:
        return jsonify({"error": "Channel not found"}), 404
    result = send_to_channel(channel, "Pizza Dough reminder test -- your notifications are working!")
    if result["ok"]:
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": result["error"]}), 502


@app.route("/api/telegram/updates")
def api_telegram_updates():
    bot_token = request.args.get("bot_token")
    if not bot_token:
        return jsonify({"error": "bot_token is required"}), 400
    try:
        url = f"https://api.telegram.org/bot{bot_token}/getUpdates?limit=10"
        with urllib.request.urlopen(url, timeout=10) as resp:
            body = json.loads(resp.read().decode())
        return jsonify(body), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 502


@app.route("/api/reminders")
def api_reminders():
    reminders = Reminder.query.filter_by(sent=False).order_by(Reminder.remind_at.asc()).all()
    return jsonify([r.to_dict() for r in reminders])


@app.route("/api/reminders", methods=["POST"])
def api_reminders_create():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    try:
        batch_id = int(data["batch_id"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "batch_id is required"}), 400

    batch = db.session.get(Batch, batch_id)
    if batch is None:
        return jsonify({"error": "Batch not found"}), 404

    try:
        channel_id = int(data["channel_id"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "channel_id is required"}), 400

    channel = db.session.get(NotificationChannel, channel_id)
    if channel is None:
        return jsonify({"error": "Channel not found"}), 404

    remind_at_raw = data.get("remind_at")
    if not isinstance(remind_at_raw, str):
        return jsonify({"error": "remind_at is required"}), 400
    try:
        remind_at = datetime.fromisoformat(remind_at_raw)
    except ValueError:
        return jsonify({"error": "Invalid remind_at format"}), 400

    message = data.get("message")
    if not message or not isinstance(message, str) or not message.strip():
        return jsonify({"error": "message is required"}), 400

    reminder = Reminder(
        batch_id=batch_id,
        channel_id=channel_id,
        remind_at=remind_at,
        message=message,
    )
    db.session.add(reminder)
    db.session.commit()
    return jsonify(reminder.to_dict()), 201


@app.route("/api/reminders/<int:reminder_id>", methods=["DELETE"])
def api_reminders_delete(reminder_id):
    reminder = db.session.get(Reminder, reminder_id)
    if reminder is None:
        return jsonify({"error": "Reminder not found"}), 404
    db.session.delete(reminder)
    db.session.commit()
    return "", 204


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5099, debug=False)
