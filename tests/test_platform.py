import os
import sys

import pytest

os.environ["GYMPULSE_NO_THREADS"] = "1"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from test_app import app, client, setup_admin, H  # noqa: F401,E402


def bearer(tok):
    return {"Authorization": "Bearer " + tok}


def test_discovery_public_and_v1_alias(app):
    c = client(app)
    r = c.get("/api/v1/server")
    j = r.get_json()
    assert r.status_code == 200 and j["app"] == "gympulse" and j["needs_setup"] is True
    assert j["api_version"] == 1 and "api_tokens" in j["features"]
    setup_admin(c)
    assert client(app).get("/api/server").get_json()["needs_setup"] is False
    # versioned alias reaches normal routes
    assert c.get("/api/v1/me").get_json()["user"]["username"] == "admin"


def test_token_login_no_csrf_header_and_revoke(app):
    c = client(app)
    setup_admin(c)
    app_client = client(app)
    r = app_client.post("/api/v1/auth/token", json={"username": "admin", "password": "password1",
                                                    "device_name": "iPhone"})
    assert r.status_code == 200, r.get_json()
    tok = r.get_json()["token"]
    assert tok.startswith("gp_")
    # token only stored hashed
    import sqlite3
    path = os.path.join(os.environ["GYMPULSE_DATA"], "gympulse.db")
    stored = sqlite3.connect(path).execute("SELECT token_hash FROM api_tokens").fetchone()[0]
    assert stored != tok and tok not in stored
    anon = client(app)
    assert anon.get("/api/v1/me", headers=bearer(tok)).get_json()["user"]["username"] == "admin"
    # writes work with bearer and no X-GymPulse header
    assert anon.post("/api/v1/weight", json={"weight_lb": 180}, headers=bearer(tok)).status_code == 200
    assert anon.get("/api/v1/tokens", headers=bearer(tok)).get_json()["tokens"][0]["current"] is True
    assert anon.post("/api/v1/auth/revoke", headers=bearer(tok)).status_code == 200
    assert anon.get("/api/v1/progress", headers=bearer(tok)).status_code == 401
    # bad token is refused
    assert anon.get("/api/v1/progress", headers=bearer("gp_nope")).status_code == 401
    # wrong password refused
    assert anon.post("/api/v1/auth/token", json={"username": "admin", "password": "bad"}).status_code == 401


def test_pairing_code_once_only(app):
    c = client(app)
    setup_admin(c)
    code = c.post("/api/auth/pair", headers=H).get_json()["code"]
    assert len(code) == 9 and "-" in code
    phone = client(app)
    r = phone.post("/api/auth/token", json={"code": code.lower(), "device_name": "Pixel"})
    assert r.status_code == 200
    assert phone.post("/api/auth/token", json={"code": code}).status_code == 401


def test_health_scope_is_limited(app):
    c = client(app)
    setup_admin(c)
    t = c.post("/api/tokens", json={"name": "Shortcut"}, headers=H).get_json()
    assert t["scope"] == "health"
    anon = client(app)
    assert anon.get("/api/me", headers=bearer(t["token"])).get_json()["user"]
    assert anon.get("/api/v1/progress", headers=bearer(t["token"])).status_code == 401
    assert anon.post("/api/v1/weight", json={"weight_lb": 150}, headers=bearer(t["token"])).status_code == 401


def test_disabled_user_token_dies(app):
    c = client(app)
    setup_admin(c)
    c.post("/api/admin/users", json={"username": "sam", "password": "password1"}, headers=H)
    sam = client(app)
    tok = sam.post("/api/auth/token", json={"username": "sam", "password": "password1"}).get_json()["token"]
    users = c.get("/api/admin/users").get_json()["users"]
    sid = [u["id"] for u in users if u["username"] == "sam"][0]
    c.put("/api/admin/users/%d" % sid, json={"disabled": True}, headers=H)
    assert client(app).get("/api/progress", headers=bearer(tok)).status_code == 401


def test_idempotency_key_replays(app):
    c = client(app)
    setup_admin(c)
    hd = dict(H, **{"Idempotency-Key": "abc-1"})
    r1 = c.post("/api/routine", json={"name": "Row", "kind": "sets", "sets_total": 3}, headers=hd)
    r2 = c.post("/api/routine", json={"name": "Row", "kind": "sets", "sets_total": 3}, headers=hd)
    assert r1.status_code == r2.status_code
    assert r2.headers.get("Idempotent-Replay") == "true"
    names = [r["name"] for r in c.get("/api/routine").get_json()["routine"]]
    assert names.count("Row") == 1


def test_invites(app):
    c = client(app)
    setup_admin(c)
    c.post("/api/admin/users", json={"username": "sam", "password": "password1"}, headers=H)
    sam = client(app)
    sam.post("/api/login", json={"username": "sam", "password": "password1"}, headers=H)
    assert sam.post("/api/admin/invites", json={}, headers=H).status_code == 403
    inv = c.post("/api/admin/invites", json={"note": "for Mom"}, headers=H).get_json()
    tok = inv["token"]
    anon = client(app)
    info = anon.get("/api/invite/" + tok).get_json()
    assert info["valid"] is True and info["invited_by"] == "admin"
    assert anon.get("/api/invite/wrong").status_code == 404
    bad = anon.post("/api/invite/%s/accept" % tok, json={"username": "mom", "password": "short"}, headers=H)
    assert bad.status_code == 400
    ok = anon.post("/api/invite/%s/accept" % tok,
                   json={"username": "mom", "password": "password1", "display_name": "Mom"}, headers=H)
    assert ok.status_code == 200
    me = anon.get("/api/me").get_json()["user"]
    assert me["name"] == "Mom" and me["role"] == "user"
    assert anon.post("/api/invite/%s/accept" % tok, json={"username": "x2x", "password": "password1"},
                     headers=H).status_code == 404
    # inviter and invitee are friends already
    assert any(f["username"] == "Mom" for f in c.get("/api/friends").get_json()["friends"])
    # revoke
    inv2 = c.post("/api/admin/invites", json={}, headers=H).get_json()
    iid = [i["id"] for i in c.get("/api/admin/invites").get_json()["invites"] if i["state"] == "ok"][0]
    c.delete("/api/admin/invites/%d" % iid, headers=H)
    assert client(app).get("/api/invite/" + inv2["token"]).status_code == 404


def test_openapi_lists_routes(app):
    j = client(app).get("/api/v1/openapi.json").get_json()
    assert "/api/v1/auth/token" in j["paths"] and "/api/v1/server" in j["paths"]
    assert j["paths"]["/api/v1/admin/invites"]["post"]["x-auth"] == "admin"
