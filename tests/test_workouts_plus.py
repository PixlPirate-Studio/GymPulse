import os
import sys

os.environ["GYMPULSE_NO_THREADS"] = "1"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from test_app import app, client, setup_admin, H  # noqa: F401,E402


def first_sets(s):
    return [e for e in s["exercises"] if e["kind"] == "sets"][0]


def run_session(c, weight, reps):
    s = c.post("/api/session/start", json={}, headers=H).get_json()
    ex = first_sets(s)
    sid, seid = s["session"]["id"], ex["id"]
    c.put("/api/session/%d/exercise/%d/set/1" % (sid, seid), json={"weight_lb": weight, "reps": reps}, headers=H)
    c.post("/api/session/%d/exercise/%d" % (sid, seid), json={"sets_done": 1}, headers=H)
    return sid, ex["name"], c.post("/api/session/%d/finish" % sid, json={}, headers=H).get_json()


def test_set_logs_last_time_and_pr(app):
    c = client(app)
    setup_admin(c)
    sid1, name, fin1 = run_session(c, 100, 10)
    assert fin1["extras"]["prs"] == 0          # first time is a baseline, not a record
    s = c.post("/api/session/start", json={}, headers=H).get_json()
    ex = first_sets(s)
    assert ex["last"]["sets"][0]["weight_lb"] == 100 and ex["last"]["sets"][0]["reps"] == 10
    sid2 = s["session"]["id"]
    c.put("/api/session/%d/exercise/%d/set/1" % (sid2, ex["id"]), json={"weight_lb": 110, "reps": 10}, headers=H)
    j = c.put("/api/session/%d/exercise/%d/set/2" % (sid2, ex["id"]), json={"weight_lb": 90, "reps": 5}, headers=H).get_json()
    logs = [e for e in j["exercises"] if e["id"] == ex["id"]][0]["logs"]
    assert logs[0]["is_pr"] == 1 and logs[1]["is_pr"] == 0
    fin = c.post("/api/session/%d/finish" % sid2, json={}, headers=H).get_json()
    assert fin["extras"]["prs"] == 1
    feed = c.get("/api/feed").get_json()
    assert any(e["type"] == "pr" for e in feed["events"])
    rec = c.get("/api/records").get_json()["records"]
    assert rec[0]["weight_lb"] == 110
    hist = c.get("/api/exercise-history", query_string={"name": name.upper()}).get_json()
    assert hist["last"]["sets"][0]["weight_lb"] == 110


def test_set_log_privacy_and_validation(app):
    c = client(app)
    setup_admin(c)
    c.post("/api/admin/users", json={"username": "sam", "password": "password1"}, headers=H)
    sam = client(app)
    sam.post("/api/login", json={"username": "sam", "password": "password1"}, headers=H)
    s = c.post("/api/session/start", json={}, headers=H).get_json()
    sid, seid = s["session"]["id"], first_sets(s)["id"]
    assert sam.put("/api/session/%d/exercise/%d/set/1" % (sid, seid), json={"weight_lb": 5, "reps": 5}, headers=H).status_code == 404
    assert c.put("/api/session/%d/exercise/%d/set/99" % (sid, seid), json={}, headers=H).status_code == 400
    j = c.put("/api/session/%d/exercise/%d/set/1" % (sid, seid), json={"weight_lb": -5, "reps": "x"}, headers=H).get_json()
    assert [e for e in j["exercises"] if e["id"] == seid][0]["logs"][0]["weight_lb"] == 0


def test_sync_is_idempotent_and_finishes_once(app):
    c = client(app)
    setup_admin(c)
    payload = {"cid": "w-1", "plan": "Beginner routine", "date": "2026-01-05", "started_at": 1767600000,
               "ended_at": 1767603600, "paused_sec": 600,
               "exercises": [
                   {"cid": "e1", "name": "Leg Press", "kind": "sets", "sets_total": 2, "sets_done": 2,
                    "sets": [{"set_no": 1, "weight_lb": 100, "reps": 10}, {"set_no": 2, "weight_lb": 100, "reps": 8}]},
                   {"cid": "e2", "name": "Treadmill", "kind": "timed", "seconds": 600, "completed": True}]}
    r1 = c.post("/api/v1/sync/workout", json=payload, headers=H).get_json()
    r2 = c.post("/api/v1/sync/workout", json=payload, headers=H).get_json()
    assert r1["ok"] and r2["already_finished"]
    hist = c.get("/api/history", query_string={"month": "2026-01"}).get_json()
    mine = [x for x in hist["recent"] if x["date"] == "2026-01-05"]
    assert len(mine) == 1 and mine[0]["duration_sec"] == 3000
    events = [e for e in c.get("/api/feed").get_json()["events"] if e["type"] == "workout"]
    assert len(events) == 1
    # an unfinished sync can be updated in place
    p2 = dict(payload, cid="w-2", ended_at=None)
    a = c.post("/api/sync/workout", json=p2, headers=H).get_json()
    p2["exercises"] = p2["exercises"][:1]
    b = c.post("/api/sync/workout", json=p2, headers=H).get_json()
    assert len(a["exercises"]) == 2 and len(b["exercises"]) == 1
    assert b["exercises"][0]["logs"][1]["reps"] == 8
    assert c.post("/api/sync/workout", json={"exercises": []}, headers=H).status_code == 400


def test_sync_adopts_server_started_session(app):
    c = client(app)
    setup_admin(c)
    s = c.post("/api/session/start", json={}, headers=H).get_json()
    n = len(s["exercises"])
    ex = first_sets(s)
    doc = {"cid": "local-1", "session_id": s["session"]["id"], "started_at": s["session"]["started_at"],
           "exercises": [dict(e, cid="x%d" % i) for i, e in enumerate(s["exercises"])]}
    doc["exercises"][[e["id"] for e in s["exercises"]].index(ex["id"])].update(
        sets_done=1, sets=[{"set_no": 1, "weight_lb": 50, "reps": 10}])
    r = c.post("/api/sync/workout", json=doc, headers=H).get_json()
    assert r["session"]["id"] == s["session"]["id"] and len(r["exercises"]) == n
    got = [e for e in r["exercises"] if e["id"] == ex["id"]][0]
    assert got["sets_done"] == 1 and got["logs"][0]["weight_lb"] == 50
