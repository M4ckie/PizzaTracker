import os
from datetime import date
from flask import Flask, jsonify, render_template, request
from models import db, Batch, Bake
from dough import calculate

app = Flask(__name__)

db_path = os.path.join(app.instance_path, "pizzadough.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    os.makedirs(app.instance_path, exist_ok=True)
    db.create_all()


# --- Page routes ---

@app.route("/")
def calculator_page():
    return render_template("calculator.html")


@app.route("/batches")
def batches_page():
    return render_template("batches.html")


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
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid field values"}), 400

    if quantity <= 0:
        return jsonify({"error": "quantity must be greater than 0"}), 400

    if quantity > batch.remaining:
        return jsonify({"error": f"Only {batch.remaining} pizzas remaining in this batch"}), 400

    baked_date = date.fromisoformat(baked_date_str) if baked_date_str else date.today()

    bake = Bake(batch_id=batch_id, baked_date=baked_date, quantity=quantity)
    db.session.add(bake)
    db.session.commit()
    return jsonify(batch.to_dict()), 201


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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5099, debug=False)
