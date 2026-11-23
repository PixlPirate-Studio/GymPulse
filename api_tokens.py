"""
Platform layer: everything a future phone app needs to talk to a person's
own GymPulse server.

  * Discovery:   GET  /api/v1/server          (public; "is this a GymPulse server?")
  * Tokens:      POST /api/v1/auth/token      (username+password, or a pairing code)
                 POST /api/v1/auth/pair       (signed-in device makes a short code)
                 GET/POST/DELETE /api/v1/tokens
  * Idempotency: send "Idempotency-Key: <random>" on any POST/PUT/DELETE and a
                 retry returns the first answer instead of doing it twice.
  * Invites:     admin makes a link, the friend picks their own password.
  * Docs:        GET  /api/v1/openapi.json    (generated list of every route)

Each person runs their own server, so nothing here talks to a central service.
"""

import hashlib
import json
import os
import re
import secrets
import time

from flask import g, jsonify, request, session

SCHEMA = """
CREATE TABLE IF NOT EXISTS api_tokens(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'App',
  scope TEXT NOT NULL DEFAULT 'full',
  created_at INTEGER NOT NULL,
  last_used INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pair_codes(
  code_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS idem(
  who TEXT NOT NULL, key TEXT NOT NULL,
  method TEXT NOT NULL, path TEXT NOT NULL,
  status INTEGER NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(who, key)
);
CREATE TABLE IF NOT EXISTS invites(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  note TEXT DEFAULT '',
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  used_by INTEGER, used_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0
);
"""

API_VERSION = 1
PAIR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I mix-ups


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def register(app, h):
    db, rows, one, err, body, text = h.db, h.rows, h.one, h.err, h.body, h.text
    login_required = h.login_required
    now = h.now

    # ---------------- discovery ----------------
    @app.get("/api/server")
    def api_server():
        """Public. Lets an app confirm an address is a GymPulse server."""
        count = one("SELECT COUNT(*) AS c FROM users")["c"]
        return jsonify({
            "app": "gympulse",
            "name": os.environ.get("GYMPULSE_SERVER_NAME", "GymPulse"),
            "api_version": API_VERSION,
            "app_version": h.APP_VERSION,
            "features": sorted(set(h.features)),
            "auth": ["password", "pairing_code", "invite"],
            "needs_setup": count == 0,
            "push": {"web_push": True, "apns": False},
        })

    # ---------------- tokens ----------------
    def token_json(t):
        return {"id": t["id"], "name": t["name"], "scope": t["scope"],
                "created_at": t["created_at"], "last_used": t["last_used"],
                "current": bool(getattr(g, "token", None) and g.token["id"] == t["id"])}

    @app.post("/api/auth/token")
    def api_auth_token():
        """Trade a username+password (or a pairing code) for an API token."""
        b = body()
        device = text(b.get("device_name"), 60) or "App"
        code = re.sub(r"[^A-Z0-9]", "", (b.get("code") or "").upper())
        key = (request.remote_addr or "") + "|" + (text(b.get("username"), 24).lower() or "code")
        if h.too_many(key):
            return err("Too many tries. Please wait 15 minutes and try again.", 429)
        uid = None
        if code:
            row = one("SELECT * FROM pair_codes WHERE code_hash=? AND expires_at>=?", (sha(code), now()))
            if row:
                db().execute("DELETE FROM pair_codes WHERE code_hash=?", (sha(code),))
                uid = row["user_id"]
        else:
            from werkzeug.security import check_password_hash
            u = one("SELECT * FROM users WHERE username=?", (text(b.get("username"), 24),))
            if u and not u["disabled"] and check_password_hash(u["pw_hash"], b.get("password") or ""):
                uid = u["id"]
        user = one("SELECT * FROM users WHERE id=? AND disabled=0", (uid,)) if uid else None
        if not user:
            h.attempts.setdefault(key, []).append(time.time())
            return err("That did not work. Check the username and password, or the code.", 401)
        h.attempts.pop(key, None)
        raw, tid = h.issue_token(user["id"], device)
        return jsonify({"token": raw, "token_id": tid, "user": h.public_user(user)})

    @app.post("/api/auth/pair")
    @login_required()
    def api_auth_pair():
        """A signed-in device shows this short code; the app types it in."""
        db().execute("DELETE FROM pair_codes WHERE expires_at<?", (now(),))
        db().execute("DELETE FROM pair_codes WHERE user_id=?", (g.user["id"],))
        code = "".join(secrets.choice(PAIR_ALPHABET) for _ in range(8))
        db().execute("INSERT INTO pair_codes(code_hash,user_id,expires_at) VALUES(?,?,?)",
                     (sha(code), g.user["id"], now() + 300))
        db().commit()
        return jsonify({"code": code[:4] + "-" + code[4:], "expires_in": 300})

    @app.post("/api/auth/revoke")
    @login_required()
    def api_auth_revoke():
        """Sign out the app that is calling (turns its token off)."""
        if g.token:
            db().execute("UPDATE api_tokens SET revoked=1 WHERE id=?", (g.token["id"],))
            db().commit()
        return jsonify({"ok": True})

    @app.get("/api/tokens")
    @login_required()
    def api_tokens_list():
        return jsonify({"tokens": [token_json(t) for t in rows(
            "SELECT * FROM api_tokens WHERE user_id=? AND revoked=0 ORDER BY id DESC", (g.user["id"],))]})

    @app.post("/api/tokens")
    @login_required()
    def api_tokens_create():
        """Make a token by hand, e.g. a 'health' one for an iPhone Shortcut."""
        b = body()
        scope = b.get("scope") if b.get("scope") in ("full", "health") else "health"
        raw, tid = h.issue_token(g.user["id"], b.get("name") or "Shortcut", scope)
        return jsonify({"token": raw, "id": tid, "scope": scope})

    @app.delete("/api/tokens/<int:tid>")
    @login_required()
    def api_tokens_delete(tid):
        db().execute("UPDATE api_tokens SET revoked=1 WHERE id=? AND user_id=?", (tid, g.user["id"]))
        db().commit()
        return jsonify({"ok": True})

    # ---------------- idempotency ----------------
    def who():
        tok = h.bearer_token()
        if tok:
            return "t" + sha(tok)[:24]
        if session.get("uid"):
            return "s%s" % session["uid"]
        return None

    @app.before_request
    def idem_lookup():
        key = request.headers.get("Idempotency-Key")
        if not key or not request.path.startswith("/api/") or \
                request.method in ("GET", "HEAD", "OPTIONS"):
            return None
        w = who()
        if not w:
            return None
        row = one("SELECT * FROM idem WHERE who=? AND key=?", (w, key[:100]))
        if row and row["method"] == request.method and row["path"] == request.path:
            resp = app.response_class(row["body"], status=row["status"], mimetype="application/json")
            resp.headers["Idempotent-Replay"] = "true"
            return resp
        g.idem = (w, key[:100])
        return None

    @app.after_request
    def idem_store(resp):
        info = g.get("idem")
        if info and resp.status_code < 500 and not resp.direct_passthrough \
                and resp.mimetype == "application/json":
            data = resp.get_data(as_text=True)
            if len(data) < 262144:
                db().execute("INSERT OR IGNORE INTO idem VALUES(?,?,?,?,?,?,?)",
                             (info[0], info[1], request.method, request.path,
                              resp.status_code, data, now()))
                db().execute("DELETE FROM idem WHERE created_at<?", (now() - 7 * 86400,))
                db().commit()
        return resp

    # ---------------- invites ----------------
    def invite_state(row):
        if not row:
            return "missing"
        if row["revoked"]:
            return "revoked"
        if row["used_at"]:
            return "used"
        if row["expires_at"] < now():
            return "expired"
        return "ok"

    @app.get("/api/admin/invites")
    @login_required(admin=True)
    def api_invites_list():
        out = []
        for r in rows("SELECT * FROM invites ORDER BY id DESC LIMIT 50"):
            out.append({"id": r["id"], "role": r["role"], "note": r["note"],
                        "state": invite_state(r), "created_at": r["created_at"],
                        "expires_at": r["expires_at"]})
        return jsonify({"invites": out})

    @app.post("/api/admin/invites")
    @login_required(admin=True)
    def api_invites_create():
        b = body()
        role = "admin" if b.get("role") == "admin" else "user"
        days = int(h.num(b.get("days"), 1, 30, 7))
        raw = secrets.token_urlsafe(18)
        db().execute(
            "INSERT INTO invites(token_hash,created_by,role,note,created_at,expires_at) VALUES(?,?,?,?,?,?)",
            (sha(raw), g.user["id"], role, text(b.get("note"), 60), now(), now() + days * 86400))
        db().commit()
        return jsonify({"token": raw, "path": "/?invite=" + raw, "expires_in_days": days})

    @app.delete("/api/admin/invites/<int:iid>")
    @login_required(admin=True)
    def api_invites_revoke(iid):
        db().execute("UPDATE invites SET revoked=1 WHERE id=?", (iid,))
        db().commit()
        return jsonify({"ok": True})

    @app.get("/api/invite/<token>")
    def api_invite_info(token):
        """Public: the sign-up page asks this before showing the form."""
        row = one("SELECT * FROM invites WHERE token_hash=?", (sha(token),))
        state = invite_state(row)
        if state != "ok":
            return jsonify({"valid": False, "state": state}), 404
        inviter = one("SELECT username, display_name FROM users WHERE id=?", (row["created_by"],)) or {}
        return jsonify({"valid": True, "role": row["role"],
                        "server": os.environ.get("GYMPULSE_SERVER_NAME", "GymPulse"),
                        "invited_by": inviter.get("display_name") or inviter.get("username") or ""})

    @app.post("/api/invite/<token>/accept")
    def api_invite_accept(token):
        row = one("SELECT * FROM invites WHERE token_hash=?", (sha(token),))
        if invite_state(row) != "ok":
            return err("This invite link is no longer valid. Ask for a new one.", 404)
        b = body()
        uid, problem = h.make_user(text(b.get("username"), 24), b.get("password") or "", row["role"])
        if problem:
            return err(problem)
        name = text(b.get("display_name"), 30)
        if name:
            db().execute("UPDATE users SET display_name=? WHERE id=?", (name, uid))
        db().execute("UPDATE invites SET used_by=?, used_at=? WHERE id=?", (uid, now(), row["id"]))
        # Make the inviter and the new person friends right away.
        db().execute("INSERT OR IGNORE INTO friendships(requester_id,addressee_id,status,created_at) "
                     "VALUES(?,?,'accepted',?)", (row["created_by"], uid, now()))
        db().commit()
        out = {"ok": True}
        if b.get("device_name"):
            out["token"] = h.issue_token(uid, b.get("device_name"))[0]
        else:
            session.clear()
            session["uid"] = uid
            session.permanent = True
        return jsonify(out)

    # ---------------- generated API list ----------------
    @app.get("/api/openapi.json")
    def api_openapi():
        paths = {}
        for rule in app.url_map.iter_rules():
            if not rule.rule.startswith("/api/") or rule.rule.startswith("/api/openapi"):
                continue
            fn = app.view_functions[rule.endpoint]
            path = re.sub(r"<(?:\w+:)?(\w+)>", r"{\1}", "/api/v1/" + rule.rule[5:])
            for m in sorted(rule.methods - {"HEAD", "OPTIONS"}):
                doc = (fn.__doc__ or "").strip().split("\n")[0]
                paths.setdefault(path, {})[m.lower()] = {
                    "summary": doc or fn.__name__.replace("api_", "").replace("_", " "),
                    "x-auth": getattr(fn, "gp_auth", "public"),
                }
        return jsonify({"openapi": "3.0.3",
                        "info": {"title": "GymPulse API", "version": str(API_VERSION)},
                        "paths": dict(sorted(paths.items()))})

    h.features.extend(["api_tokens", "invites", "idempotency"])
