"""
app.py — Flask REST API for the Fault-to-Recovery grid simulator (BESCOM Theme 9).

Endpoints:
  POST /api/login            {email, password}  → {ok, token, user}  (open)
  GET  /api/network/state    full grid snapshot (also advances live telemetry)
  POST /api/simulate/fault   {scenario:"S1"|"S2"} or {edge_id:"..."}
  POST /api/simulate/restore apply recommended switching actions
  POST /api/simulate/reset   restore default healthy topology
  GET  /api/events           ?type=fault&q=...  filterable audit log

Every endpoint EXCEPT /api/login and / (the frontend) requires a valid Bearer
token issued by /api/login. Tokens are signed (itsdangerous) and expire after 8h.
Passwords are stored as PBKDF2 hashes (werkzeug.security), never plaintext.

The app also serves the compiled frontend at GET / (same origin → no CORS issues).
CORS is enabled with an Authorization allow-header so the file:// dev frontend works.

Run:  python app.py   →  http://localhost:5000
"""
import os
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, g
from flask_cors import CORS
from werkzeug.security import check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

import db
import engine

app = Flask(__name__)
# Secret key signs auth tokens. Override in production via SECRET_KEY env var.
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-secret-change-in-prod")
# Signed-token serializer (itsdangerous); the salt namespaces the signature.
_auth_serializer = URLSafeTimedSerializer(app.secret_key, salt="ftr-auth")
TOKEN_MAX_AGE = 8 * 3600  # 8 hours

# Same-origin (Flask serves the frontend) needs no CORS; the file:// dev case
# calls the API cross-origin with an Authorization header, so allow it explicitly.
CORS(app, origins="*", allow_headers=["Authorization", "Content-Type"],
     methods=["GET", "POST", "OPTIONS"])

# Frontend HTML lives one directory up (download/fault-to-recovery.html)
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_FILE = "fault-to-recovery.html"


# ---------------------------------------------------------------- auth
def _make_token(user):
    """Issue a signed, time-limited token carrying the operator's identity."""
    payload = {k: user.get(k) for k in ("email", "name", "role", "station")}
    return _auth_serializer.dumps(payload)


def _verify_token(token):
    """Return the token payload, or None if the signature is bad / expired."""
    try:
        return _auth_serializer.loads(token, max_age=TOKEN_MAX_AGE)
    except SignatureExpired:
        return None
    except BadSignature:
        return None


def require_auth(f):
    """Reject any request without a valid Bearer token. On success g.user holds
    the operator identity ({email, name, role, station})."""
    @wraps(f)
    def _wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Authentication required."}), 401
        payload = _verify_token(auth[7:].strip())
        if not payload:
            return jsonify({"error": "Invalid or expired session. Please sign in again."}), 401
        g.user = payload
        return f(*args, **kwargs)
    return _wrapped


# ---------------------------------------------------------------- boot
@app.before_request
def _ensure_booted():
    if not getattr(app, "_booted", False):
        db.init_db()
        engine.recompute()
        if db.telemetry_empty():
            engine.seed_telemetry()
        app._booted = True


# ---------------------------------------------------------------- routes
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, FRONTEND_FILE)


@app.route("/api/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    user = db.get_user_by_email(email)
    # Missing user OR bad hash both fall through to the same 401 — no user-enumeration hint.
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"ok": False, "error": "Invalid email or password."}), 401
    safe = {"email": user["email"], "name": user["name"],
            "role": user["role"], "station": user["station"]}
    return jsonify({"ok": True, "token": _make_token(safe), "user": safe})


@app.route("/api/network/state", methods=["GET"])
@require_auth
def network_state():
    engine.tick_telemetry()
    return jsonify(engine.build_state())


@app.route("/api/simulate/fault", methods=["POST"])
@require_auth
def simulate_fault():
    body = request.get_json(silent=True) or {}
    scenario = body.get("scenario")
    edge_id = body.get("edge_id")
    if not scenario and not edge_id:
        return jsonify({"error": "Provide 'scenario' (S1/S2) or 'edge_id'."}), 400
    state = engine.trigger_fault(scenario=scenario, edge_id=edge_id)
    return jsonify(state)


@app.route("/api/simulate/restore", methods=["POST"])
@require_auth
def simulate_restore():
    state = engine.apply_restoration()
    return jsonify(state)


@app.route("/api/simulate/reset", methods=["POST"])
@require_auth
def simulate_reset():
    state = engine.reset_grid()
    return jsonify(state)


@app.route("/api/events", methods=["GET"])
@require_auth
def events():
    type_filter = request.args.get("type", "all")
    q = request.args.get("q", "").strip().lower()
    evs = db.get_events(limit=500)
    out = []
    for e in evs:
        if type_filter != "all" and e["type"] != type_filter:
            continue
        if q and q not in (e["detail"] or "").lower() and q not in (e["location"] or "").lower() \
                and q not in (e["fault_id"] or "").lower():
            continue
        out.append(engine._ser_event(e))
    return jsonify(out)


@app.errorhandler(400)
@app.errorhandler(401)
def _err(e):
    return jsonify({"error": str(e.description) if hasattr(e, "description") else str(e)}), e.code


if __name__ == "__main__":
    db.init_db()
    if db.telemetry_empty():
        engine.seed_telemetry()
    engine.recompute()
    print("=" * 60)
    print(" Fault to Recovery — BESCOM Theme 9 backend")
    print(" API:      http://localhost:5000/api")
    print(" Frontend: http://localhost:5000/")
    print(" Login:    admin@bescom.sim / demo123")
    print(" Auth:     signed Bearer tokens, 8h expiry; all /api/* except /login protected")
    print("=" * 60)
    port = int(os.environ.get("PORT", 5000))  # Render/Heroku set PORT; local default 5000
    app.run(host="0.0.0.0", port=port, threaded=True, debug=False)
