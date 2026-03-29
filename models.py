import json
from datetime import date, datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Batch(db.Model):
    __tablename__ = "batch"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    made_date = db.Column(db.Date, nullable=False)
    size_inches = db.Column(db.Integer, nullable=False)
    count = db.Column(db.Integer, nullable=False)
    thickness = db.Column(db.Text, nullable=False)
    gluten_free = db.Column(db.Boolean, default=False, nullable=False)
    notes = db.Column(db.Text, nullable=True)

    bakes = db.relationship("Bake", back_populates="batch", cascade="all, delete-orphan",
                            order_by="Bake.baked_date.desc()")
    reminders = db.relationship("Reminder", back_populates="batch", cascade="all, delete-orphan",
                                order_by="Reminder.remind_at")

    @property
    def baked_count(self):
        return sum(b.quantity for b in self.bakes)

    @property
    def remaining(self):
        return self.count - self.baked_count

    @property
    def days_since_made(self):
        return (date.today() - self.made_date).days if self.made_date else None

    @property
    def last_baked_date(self):
        if self.bakes:
            return max(b.baked_date for b in self.bakes)
        return None

    @property
    def fully_baked(self):
        return self.baked_count >= self.count

    def to_dict(self):
        return {
            "id": self.id,
            "made_date": self.made_date.isoformat() if self.made_date else None,
            "days_since_made": self.days_since_made,
            "size_inches": self.size_inches,
            "count": self.count,
            "thickness": self.thickness,
            "gluten_free": self.gluten_free,
            "notes": self.notes,
            "baked_count": self.baked_count,
            "remaining": self.remaining,
            "fully_baked": self.fully_baked,
            "last_baked_date": self.last_baked_date.isoformat() if self.last_baked_date else None,
            "bakes": [b.to_dict() for b in self.bakes],
            "reminders": [r.to_dict() for r in self.reminders],
        }


class Bake(db.Model):
    __tablename__ = "bake"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    batch_id = db.Column(db.Integer, db.ForeignKey("batch.id"), nullable=False)
    baked_date = db.Column(db.Date, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text, nullable=True)

    batch = db.relationship("Batch", back_populates="bakes")

    def to_dict(self):
        return {
            "id": self.id,
            "baked_date": self.baked_date.isoformat(),
            "quantity": self.quantity,
            "notes": self.notes,
        }


class NotificationChannel(db.Model):
    __tablename__ = "notification_channel"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    platform = db.Column(db.Text, nullable=False)
    label = db.Column(db.Text, nullable=False)
    config_json = db.Column(db.Text, nullable=False)
    enabled = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    reminders = db.relationship("Reminder", back_populates="channel", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "platform": self.platform,
            "label": self.label,
            "config": json.loads(self.config_json),
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Reminder(db.Model):
    __tablename__ = "reminder"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    batch_id = db.Column(db.Integer, db.ForeignKey("batch.id"), nullable=False)
    channel_id = db.Column(db.Integer, db.ForeignKey("notification_channel.id"), nullable=False)
    remind_at = db.Column(db.DateTime, nullable=False)
    message = db.Column(db.Text, nullable=False)
    sent = db.Column(db.Boolean, nullable=False, default=False)
    sent_at = db.Column(db.DateTime, nullable=True)
    error = db.Column(db.Text, nullable=True)

    batch = db.relationship("Batch", back_populates="reminders")
    channel = db.relationship("NotificationChannel", back_populates="reminders")

    def to_dict(self):
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "channel_id": self.channel_id,
            "remind_at": self.remind_at.isoformat() if self.remind_at else None,
            "message": self.message,
            "sent": self.sent,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "error": self.error,
        }
