import datetime as dt
import os
import sys

os.environ["GYMPULSE_NO_THREADS"] = "1"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from test_app import app, client, setup_admin, add_user, H  # noqa: F401,E402


def befriend(a, b, aname):
    """b asks to be friends with a (login name aname); a accepts."""
    b.post("/api/friends/request", json={"username": aname}, headers=H)
    fid = a.get("/api/friends").get_json()["incoming"][0]["id"]
    a.post("/api/friends/%d/accept" % fid, headers=H)


def do_workout(c):
    s = c.post("/api/session/start", json={}, headers=H).get_json()
    ex = [e for e in s["exercises"] if e["kind"] == "sets"][0]
    c.post("/api/session/%d/exercise/%d" % (s["session"]["id"], ex["id"]), json={"sets_done": 1}, headers=H)
    return c.post("/api/session/%d/finish" % s["session"]["id"], json={}, headers=H)


def test_reactions_and_notifications(app):
    a = client(app); setup_admin(a)
    b = add_user(a, "sam"); befriend(a, b, "admin")
    do_workout(a)
    ev = [e for e in b.get("/api/feed").get_json()["events"] if e["type"] == "workout"][0]
    assert b.post("/api/feed/%d/react" % ev["id"], json={"emoji": "\U0001F525"}, headers=H).status_code == 200
    assert b.post("/api/feed/%d/react" % ev["id"], json={"emoji": "x"}, headers=H).status_code == 404
    ev2 = [e for e in a.get("/api/feed").get_json()["events"] if e["id"] == ev["id"]][0]
    assert ev2["reactions"] == [{"emoji": "\U0001F525", "count": 1}]
    notes = a.get("/api/notifications").get_json()
    assert any(n["kind"] == "reaction" for n in notes["items"]) and notes["unread"] >= 1
    a.post("/api/notifications/read", headers=H)
    assert a.get("/api/notifications").get_json()["unread"] == 0
    # same emoji again removes it; legacy cheer maps to the clap
    b.post("/api/feed/%d/react" % ev["id"], json={"emoji": "\U0001F525"}, headers=H)
    b.post("/api/feed/%d/cheer" % ev["id"], headers=H)
    ev3 = [e for e in b.get("/api/feed").get_json()["events"] if e["id"] == ev["id"]][0]
    assert ev3["cheered"] == 1 and ev3["mine"] == "\U0001F44F"
    # cannot react to a stranger
    c = add_user(a, "zed")
    assert c.post("/api/feed/%d/react" % ev["id"], json={"emoji": "\U0001F525"}, headers=H).status_code == 404


def test_nudge_once_a_day_friends_only(app):
    a = client(app); setup_admin(a)
    b = add_user(a, "sam"); stranger = add_user(a, "zed")
    befriend(a, b, "admin")
    sam_id = [f for f in a.get("/api/friends").get_json()["friends"]][0]["id"]
    assert a.post("/api/friends/%d/nudge" % sam_id, headers=H).status_code == 200
    assert a.post("/api/friends/%d/nudge" % sam_id, headers=H).status_code == 400
    zed = [u for u in a.get("/api/admin/users").get_json()["users"] if u["username"] == "zed"][0]["id"]
    assert a.post("/api/friends/%d/nudge" % zed, headers=H).status_code == 404
    assert any(n["kind"] == "nudge" for n in b.get("/api/notifications").get_json()["items"])
    import sqlite3
    db = sqlite3.connect(os.path.join(os.environ["GYMPULSE_DATA"], "gympulse.db"))
    assert db.execute("SELECT COUNT(*) FROM alerts WHERE title LIKE '%nudged%'").fetchone()[0] == 1


def test_badges_awarded(app):
    a = client(app); setup_admin(a)
    do_workout(a)
    import time
    time.sleep(1.1)
    a.post("/api/weight", json={"weight_lb": 180}, headers=H)
    got = {b["code"] for b in a.get("/api/badges").get_json()["badges"] if b["earned_at"]}
    assert {"first_workout", "first_weighin"} <= got
    assert any(n["kind"] == "badge" for n in a.get("/api/notifications").get_json()["items"])
    assert any(e["type"] == "badge" for e in a.get("/api/feed").get_json()["events"])
    assert len(a.get("/api/badges").get_json()["badges"]) == 20


def test_challenge_team_and_race(app):
    a = client(app); setup_admin(a)
    b = add_user(a, "sam"); befriend(a, b, "admin")
    sam_id = a.get("/api/friends").get_json()["friends"][0]["id"]
    r = a.post("/api/challenges", json={"title": "Team 2", "kind": "team", "metric": "workouts", "target": 1,
                                        "days": 7, "invite_ids": [sam_id, 9999]}, headers=H).get_json()
    ch = r["challenges"][0]
    assert [m["status"] for m in ch["members"]].count("invited") == 1
    assert b.get("/api/challenges").get_json()["challenges"][0]["status"] == "invited"
    assert any(n["kind"] == "challenge" for n in b.get("/api/notifications").get_json()["items"])
    b.post("/api/challenges/%d/join" % ch["id"], headers=H)
    do_workout(b)
    done = a.get("/api/challenges").get_json()["challenges"][0]
    assert done["state"] == "done" and done["total"] == 1
    assert any("Your team finished" in n["text"] for n in a.get("/api/notifications").get_json()["items"])
    # only creator can delete
    assert b.delete("/api/challenges/%d" % ch["id"], headers=H).get_json()["challenges"]
    a.delete("/api/challenges/%d" % ch["id"], headers=H)
    assert a.get("/api/challenges").get_json()["challenges"] == []
    assert a.post("/api/challenges", json={"title": "", "target": 3}, headers=H).status_code == 400


def test_reminders_fire_once_and_skip_after_workout(app):
    a = client(app); setup_admin(a)
    r = a.post("/api/reminders", json={"days": [0, 1, 2, 3, 4, 5, 6], "at": "17:30", "tz": "America/New_York",
                                       "label": "Leg day"}, headers=H).get_json()
    assert r["reminders"][0]["at"] == "17:30"
    assert a.post("/api/reminders", json={"days": [], "at": "17:30"}, headers=H).status_code == 400
    assert a.post("/api/reminders", json={"days": [1], "at": "25:00"}, headers=H).status_code == 400
    utc = dt.timezone.utc
    early = dt.datetime(2026, 3, 3, 21, 0, tzinfo=utc)     # 4:00pm New York (EST)
    due = dt.datetime(2026, 3, 3, 22, 40, tzinfo=utc)      # 5:40pm New York
    assert app.process_reminders(early) == 0
    assert app.process_reminders(due) == 1
    assert app.process_reminders(due) == 0                 # not twice the same day
    assert any(n["kind"] == "reminder" for n in a.get("/api/notifications").get_json()["items"])
    rid = r["reminders"][0]["id"]
    a.put("/api/reminders/%d" % rid, json={"days": [0, 1, 2, 3, 4, 5, 6], "at": "17:30", "tz": "America/New_York"}, headers=H)
    # a person who already worked out that day is not nagged
    import sqlite3
    db = sqlite3.connect(os.path.join(os.environ["GYMPULSE_DATA"], "gympulse.db"))
    db.execute("INSERT INTO sessions(user_id,date,started_at,ended_at) VALUES(1,'2026-03-03',1,2)")
    db.execute("INSERT INTO session_exercises(session_id,name,kind,sets_done) VALUES(last_insert_rowid(),'x','sets',1)")
    db.commit()
    assert app.process_reminders(due) == 0
