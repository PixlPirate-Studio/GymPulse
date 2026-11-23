import csv
import os
import sqlite3
import sys

import pytest

os.environ["GYMPULSE_NO_THREADS"] = "1"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

H = {"X-GymPulse": "1"}


@pytest.fixture()
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("GYMPULSE_DATA", str(tmp_path))
    import importlib
    import app as mod
    importlib.reload(mod)
    mod.app.config["TESTING"] = True
    return mod.app


def client(app):
    return app.test_client()


def setup_admin(c):
    r = c.post("/api/setup", json={"username": "admin", "password": "password1"}, headers=H)
    assert r.status_code == 200


def add_user(admin, name):
    r = admin.post("/api/admin/users", json={"username": name, "password": "password1"}, headers=H)
    assert r.status_code == 200
    c = admin.application.test_client()
    assert c.post("/api/login", json={"username": name, "password": "password1"}, headers=H).status_code == 200
    return c


def test_setup_once_and_login(app):
    c = client(app)
    assert c.get("/api/me").get_json()["needs_setup"] is True
    setup_admin(c)
    assert c.post("/api/setup", json={"username": "x", "password": "password1"}, headers=H).status_code == 403
    me = c.get("/api/me").get_json()
    assert me["user"]["role"] == "admin"
    c2 = client(app)
    assert c2.post("/api/login", json={"username": "admin", "password": "wrong"}, headers=H).status_code == 401
    assert c2.post("/api/login", json={"username": "ADMIN", "password": "password1"}, headers=H).status_code == 200


def test_csrf_header_required(app):
    c = client(app)
    assert c.post("/api/setup", json={"username": "admin", "password": "password1"}).status_code == 403


def test_login_rate_limit(app):
    c = client(app)
    setup_admin(c)
    c2 = client(app)
    for _ in range(8):
        c2.post("/api/login", json={"username": "admin", "password": "nope"}, headers=H)
    assert c2.post("/api/login", json={"username": "admin", "password": "password1"}, headers=H).status_code == 429


def test_requires_login(app):
    c = client(app)
    assert c.get("/api/profile").status_code == 401


def test_roles_and_last_admin(app):
    a = client(app)
    setup_admin(a)
    u = add_user(a, "sam")
    assert u.get("/api/admin/users").status_code == 403
    users = a.get("/api/admin/users").get_json()["users"]
    admin_id = [x for x in users if x["username"] == "admin"][0]["id"]
    r = a.put("/api/admin/users/%d" % admin_id, json={"role": "user"}, headers=H)
    assert r.status_code == 400
    r = a.put("/api/admin/users/%d" % admin_id, json={"disabled": True}, headers=H)
    assert r.status_code == 400


def test_profile_stats(app):
    c = client(app)
    setup_admin(c)
    c.put("/api/profile", json={"age": 40, "sex": "female", "height_in": 65, "goal_weight_lb": 140,
                                "activity": "light"}, headers=H)
    r = c.post("/api/weight", json={"weight_lb": 170, "date": "2026-01-01"}, headers=H).get_json()
    st = r["stats"]
    assert st["bmi"] == round(170 * 703 / 65 ** 2, 1)
    assert st["healthy_min"] == round(18.5 * 65 * 65 / 703, 1)
    assert st["personalized"] and st["goal_cal"] < st["stay_cal"]
    assert st["lbs_to_goal"] == 30
    assert c.post("/api/weight", json={"weight_lb": 5}, headers=H).status_code == 400


def test_workout_flow_and_progress(app):
    c = client(app)
    setup_admin(c)
    routine = c.get("/api/routine").get_json()["routine"]
    assert len(routine) == 8
    s = c.post("/api/session/start", json={"date": "2026-03-04"}, headers=H).get_json()
    sid = s["session"]["id"]
    assert len(s["exercises"]) == 8
    # starting again returns the same session
    assert c.post("/api/session/start", json={}, headers=H).get_json()["session"]["id"] == sid
    leg = [e for e in s["exercises"] if e["kind"] == "sets"][0]
    r = c.post("/api/session/%d/exercise/%d" % (sid, leg["id"]), json={"sets_done": 3}, headers=H).get_json()
    assert [e for e in r["exercises"] if e["id"] == leg["id"]][0]["completed"] == 1
    timed = [e for e in s["exercises"] if e["kind"] == "timed"][0]
    c.post("/api/session/%d/exercise/%d" % (sid, timed["id"]), json={"completed": True}, headers=H)
    assert c.post("/api/session/%d/finish" % sid, headers=H).status_code == 200
    assert c.get("/api/session/active").get_json()["session"] is None
    p = c.get("/api/progress?today=2026-03-04").get_json()
    assert p["streak"] == 1 and p["total_sessions"] == 1
    assert p["week"]["workouts"] == 1 and p["week"]["strength_days"] == 1
    h = c.get("/api/history?month=2026-03").get_json()
    assert h["days"] == ["2026-03-04"]
    feed = c.get("/api/feed").get_json()["events"]
    assert feed and feed[0]["type"] == "workout"


def test_empty_session_not_counted(app):
    c = client(app)
    setup_admin(c)
    sid = c.post("/api/session/start", json={"date": "2026-03-04"}, headers=H).get_json()["session"]["id"]
    c.post("/api/session/%d/finish" % sid, headers=H)
    assert c.get("/api/progress?today=2026-03-04").get_json()["streak"] == 0


def test_routine_edit(app):
    c = client(app)
    setup_admin(c)
    r = c.post("/api/routine", json={"name": "Leg Curl", "kind": "sets", "sets_total": 4, "seconds": 90}, headers=H).get_json()
    assert r["routine"][-1]["name"] == "Leg Curl"
    rid = r["routine"][-1]["id"]
    r = c.post("/api/routine/%d/move" % rid, json={"direction": "up"}, headers=H).get_json()
    assert r["routine"][-2]["id"] == rid
    r = c.delete("/api/routine/%d" % rid, headers=H).get_json()
    assert all(x["id"] != rid for x in r["routine"])
    assert c.post("/api/routine", json={"name": ""}, headers=H).status_code == 400


def test_food_diary(app):
    c = client(app)
    setup_admin(c)
    foods = c.get("/api/foods/search?q=banana").get_json()["foods"]
    assert foods and foods[0]["name"] == "Banana"
    assert c.post("/api/diary", json={"food_id": foods[0]["id"], "meal": "breakfast", "servings": 2, "date": "2026-03-04"}, headers=H).status_code == 200
    d = c.get("/api/diary?date=2026-03-04").get_json()
    assert d["totals"]["calories"] == 210
    custom = c.post("/api/foods", json={"name": "Mom's soup", "serving": "1 bowl", "calories": 250}, headers=H).get_json()["food"]
    u = add_user(c, "sam")  # another user must not see my custom food
    names = [f["name"] for f in u.get("/api/foods/search?q=soup").get_json()["foods"]]
    assert "Mom's soup" not in names
    assert u.post("/api/diary", json={"food_id": custom["id"], "meal": "lunch", "servings": 1}, headers=H).status_code == 400
    eid = d["entries"][0]["id"]
    assert c.delete("/api/diary/%d" % eid, headers=H).status_code == 200
    assert c.get("/api/diary?date=2026-03-04").get_json()["entries"] == []


def test_barcode_lookup_fake(app):
    c = client(app)
    setup_admin(c)
    app.fetch_off = lambda code: {"name": "Test Bar", "brand": "Acme", "serving": "1 bar (40 g)", "calories": 180, "protein": 10, "carbs": 20, "fat": 6}
    f = c.get("/api/foods/barcode/012345678905").get_json()["food"]
    assert f["name"] == "Test Bar"
    app.fetch_off = lambda code: (_ for _ in ()).throw(AssertionError("should hit the saved copy"))
    assert c.get("/api/foods/barcode/012345678905").get_json()["food"]["id"] == f["id"]
    assert c.get("/api/foods/barcode/abc").status_code == 400
    app.fetch_off = lambda code: None
    assert c.get("/api/foods/barcode/999999999999").status_code == 404


def test_friends_feed_and_privacy(app):
    a = client(app)
    setup_admin(a)
    b = add_user(a, "sam")
    assert b.post("/api/friends/request", json={"username": "nobody"}, headers=H).status_code == 404
    assert b.post("/api/friends/request", json={"username": "admin"}, headers=H).status_code == 200
    inc = a.get("/api/friends").get_json()["incoming"]
    assert inc[0]["username"] == "sam"
    a.post("/api/friends/%d/accept" % inc[0]["id"], headers=H)
    assert [f["username"] for f in a.get("/api/friends").get_json()["friends"]] == ["sam"]
    # sam finishes a workout, admin sees and cheers it
    sid = b.post("/api/session/start", json={"date": "2026-03-04"}, headers=H).get_json()
    ex = sid["exercises"][0]
    b.post("/api/session/%d/exercise/%d" % (sid["session"]["id"], ex["id"]), json={"completed": True}, headers=H)
    b.post("/api/session/%d/finish" % sid["session"]["id"], headers=H)
    ev = a.get("/api/feed").get_json()["events"]
    assert ev and ev[0]["username"] == "sam"
    assert a.post("/api/feed/%d/cheer" % ev[0]["id"], headers=H).status_code == 200
    assert b.get("/api/feed").get_json()["events"][0]["cheers"] == 1
    lb = a.get("/api/leaderboard?today=2026-03-04").get_json()["leaders"]
    assert {x["username"] for x in lb} == {"admin", "sam"}
    # a stranger cannot cheer
    c3 = add_user(a, "zed")
    assert c3.post("/api/feed/%d/cheer" % ev[0]["id"], headers=H).status_code == 404


def test_recipes_sharing(app):
    a = client(app)
    setup_admin(a)
    b = add_user(a, "sam")
    rid = b.post("/api/recipes", json={"title": "Egg bowl", "calories": 300, "servings": 2, "shared": True}, headers=H).get_json()["id"]
    priv = b.post("/api/recipes", json={"title": "Secret", "calories": 1, "shared": False}, headers=H).get_json()["id"]
    # not friends yet -> invisible
    assert a.get("/api/recipes/%d" % rid).status_code == 404
    b.post("/api/friends/request", json={"username": "admin"}, headers=H)
    fid = a.get("/api/friends").get_json()["incoming"][0]["id"]
    a.post("/api/friends/%d/accept" % fid, headers=H)
    assert a.get("/api/recipes/%d" % rid).status_code == 200
    assert a.get("/api/recipes/%d" % priv).status_code == 404
    titles = [r["title"] for r in a.get("/api/recipes").get_json()["recipes"]]
    assert titles == ["Egg bowl"]
    assert a.post("/api/recipes/%d/tips" % rid, json={"text": "Add salsa"}, headers=H).status_code == 200
    assert a.post("/api/recipes/%d/cheer" % rid, headers=H).status_code == 200
    d = a.get("/api/recipes/%d" % rid).get_json()
    assert d["tips"][0]["text"] == "Add salsa" and d["recipe"]["cheers"] == 1
    assert a.post("/api/recipes/%d/log" % rid, json={"meal": "dinner", "servings": 1, "date": "2026-03-04"}, headers=H).status_code == 200
    assert a.get("/api/diary?date=2026-03-04").get_json()["totals"]["calories"] == 300
    # only the owner can delete
    a.delete("/api/recipes/%d" % rid, headers=H)
    assert b.get("/api/recipes/%d" % rid).status_code == 200


def test_xss_stays_data(app):
    c = client(app)
    setup_admin(c)
    r = c.post("/api/recipes", json={"title": "<script>alert(1)</script>"}, headers=H).get_json()
    got = c.get("/api/recipes/%d" % r["id"]).get_json()["recipe"]["title"]
    assert got == "<script>alert(1)</script>"  # stored as text; the front end escapes it


def test_alerts_sent_and_nudged(app):
    c = client(app)
    setup_admin(c)
    sent = []
    app.send_push = lambda sub, title, body: sent.append((title, body))
    c.post("/api/push/subscribe", json={"subscription": {"endpoint": "https://push.example/abc", "keys": {}}}, headers=H)
    c.post("/api/timer", json={"seconds": 3, "title": "Rest is over"}, headers=H)
    conn = sqlite3.connect(os.path.join(os.environ["GYMPULSE_DATA"], "gympulse.db"))
    conn.execute("UPDATE alerts SET due_at=0")
    conn.commit()
    app.process_alerts()
    assert sent == [("Rest is over", "Your timer is done.")]
    left = conn.execute("SELECT COUNT(*), MAX(nudges_left) FROM alerts").fetchone()
    assert left == (1, 1)  # a gentle repeat is queued
    c.delete("/api/timer", headers=H)
    assert conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0] == 0


def test_backup_download(app):
    c = client(app)
    setup_admin(c)
    r = c.get("/api/admin/backup")
    assert r.status_code == 200 and r.data[:15] == b"SQLite format 3"


def test_usda_importer(tmp_path):
    import import_usda
    folder = tmp_path / "usda"
    folder.mkdir()
    with open(folder / "food.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["fdc_id", "data_type", "description", "publication_date"])
        w.writerow(["1", "sr_legacy_food", "Lentils, cooked", "2019-04-01"])
    with open(folder / "food_nutrient.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "fdc_id", "nutrient_id", "amount"])
        for i, (n, a) in enumerate([("1008", "116"), ("1003", "9"), ("1005", "20"), ("1004", "0.4")]):
            w.writerow([i, "1", n, a])
    db = tmp_path / "t.db"
    import app as mod
    os.environ["GYMPULSE_DATA"] = str(tmp_path)
    mod.create_app()
    import_usda.main(str(folder), str(tmp_path / "gympulse.db"))
    import_usda.main(str(folder), str(tmp_path / "gympulse.db"))  # twice: no duplicates
    conn = sqlite3.connect(str(tmp_path / "gympulse.db"))
    rows = conn.execute("SELECT name, calories FROM foods WHERE source='usda'").fetchall()
    assert rows == [("Lentils, cooked", 116.0)]


def test_custom_exercises_and_plans(app):
    c = client(app)
    setup_admin(c)
    r = c.get("/api/routine").get_json()
    assert r["plans"] == ["Beginner routine"] and len(r["routine"]) == 8
    # new named workout, with a custom timed exercise and a custom sets exercise
    assert c.post("/api/plans", json={"name": "Leg Day"}, headers=H).status_code == 200
    assert c.post("/api/plans", json={"name": "Leg Day"}, headers=H).status_code == 400
    c.post("/api/routine", json={"plan": "Leg Day", "name": "Bike", "kind": "timed", "seconds": 1500}, headers=H)
    r = c.post("/api/routine", json={"plan": "Leg Day", "name": "Leg Curl", "kind": "sets", "sets_total": 4,
                                     "reps": "12", "seconds": 45, "category": "Legs"}, headers=H).get_json()
    leg = [x for x in r["routine"] if x["plan"] == "Leg Day"]
    assert [x["name"] for x in leg] == ["Bike", "Leg Curl"]
    assert leg[1]["reps"] == "12" and leg[1]["seconds"] == 45
    assert c.post("/api/routine", json={"plan": "Leg Day", "name": "Bad", "seconds": 1}, headers=H).status_code == 400
    # moving stays inside the plan
    r = c.post("/api/routine/%d/move" % leg[1]["id"], json={"direction": "up"}, headers=H).get_json()
    assert [x["name"] for x in r["routine"] if x["plan"] == "Leg Day"] == ["Leg Curl", "Bike"]
    # edit
    r = c.put("/api/routine/%d" % leg[0]["id"], json={"seconds": 1800, "name": "Spin Bike"}, headers=H).get_json()
    assert [x for x in r["routine"] if x["id"] == leg[0]["id"]][0]["seconds"] == 1800
    # start a session from that plan only
    s = c.post("/api/session/start", json={"plan": "Leg Day", "date": "2026-03-04"}, headers=H).get_json()
    assert [e["name"] for e in s["exercises"]] == ["Leg Curl", "Spin Bike"]
    assert s["exercises"][0]["reps"] == "12" and s["exercises"][0]["seconds"] == 45
    sid = s["session"]["id"]
    # add a one-off exercise mid-workout, then one saved to the plan
    s = c.post("/api/session/%d/exercises" % sid, json={"name": "Jump Rope", "kind": "timed", "seconds": 300}, headers=H).get_json()
    assert s["exercises"][-1]["name"] == "Jump Rope" and s["exercises"][-1]["routine_id"] is None
    s = c.post("/api/session/%d/exercises" % sid, json={"name": "Plank", "kind": "timed", "seconds": 60, "save_to_plan": True}, headers=H).get_json()
    assert s["exercises"][-1]["routine_id"] is not None
    assert any(x["name"] == "Plank" for x in c.get("/api/routine").get_json()["routine"])
    # edit and remove inside the session
    rope = [e for e in s["exercises"] if e["name"] == "Jump Rope"][0]
    s = c.put("/api/session/%d/exercise/%d" % (sid, rope["id"]), json={"seconds": 120}, headers=H).get_json()
    assert [e for e in s["exercises"] if e["id"] == rope["id"]][0]["seconds"] == 120
    s = c.delete("/api/session/%d/exercise/%d" % (sid, rope["id"]), headers=H).get_json()
    assert all(e["name"] != "Jump Rope" for e in s["exercises"])
    # sets can't be edited on someone else's session
    other = add_user(c, "sam")
    assert other.post("/api/session/%d/exercises" % sid, json={"name": "X"}, headers=H).status_code == 404
    # rename and delete plans; the last plan can't be deleted
    r = c.put("/api/plans", json={"old": "Leg Day", "new": "Legs"}, headers=H).get_json()
    assert "Legs" in r["plans"] and all(x["plan"] != "Leg Day" for x in r["routine"])
    r = c.delete("/api/plans?name=Legs", headers=H).get_json()
    assert r["plans"] == ["Beginner routine"]
    assert c.delete("/api/plans?name=Beginner%20routine", headers=H).status_code == 400
    # resetting the beginner plan leaves other workouts alone
    c.post("/api/plans", json={"name": "Keep me", "copy_from": "Beginner routine"}, headers=H)
    c.post("/api/routine/template", headers=H)
    r = c.get("/api/routine").get_json()
    assert len([x for x in r["routine"] if x["plan"] == "Keep me"]) == 8
    assert len([x for x in r["routine"] if x["plan"] == "Beginner routine"]) == 8


def test_display_names(app):
    a = client(app)
    setup_admin(a)  # logs in as "admin"
    b = add_user(a, "sam")
    assert a.get("/api/me").get_json()["user"]["name"] == "admin"
    r = a.put("/api/account", json={"display_name": "  Alex   Smith "}, headers=H)
    assert r.get_json()["user"]["display_name"] == "Alex Smith"
    me = a.get("/api/me").get_json()["user"]
    assert me["username"] == "admin" and me["name"] == "Alex Smith"
    # login still uses the real username, not the display name
    c2 = client(app)
    assert c2.post("/api/login", json={"username": "Alex Smith", "password": "password1"}, headers=H).status_code == 401
    assert c2.post("/api/login", json={"username": "admin", "password": "password1"}, headers=H).status_code == 200
    # nobody can take another person's login name or display name
    assert b.put("/api/account", json={"display_name": "admin"}, headers=H).status_code == 400
    assert b.put("/api/account", json={"display_name": "alex smith"}, headers=H).status_code == 400
    assert b.put("/api/account", json={"display_name": "x" * 31}, headers=H).status_code == 400
    # friends see the display name, never the login name
    b.post("/api/friends/request", json={"username": "Alex Smith"}, headers=H)  # found by display name
    inc = a.get("/api/friends").get_json()["incoming"]
    assert inc and inc[0]["username"] == "sam"
    a.post("/api/friends/%d/accept" % inc[0]["id"], headers=H)
    assert [f["username"] for f in b.get("/api/friends").get_json()["friends"]] == ["Alex Smith"]
    lb = b.get("/api/leaderboard?today=2026-03-04").get_json()["leaders"]
    assert {x["username"] for x in lb} == {"Alex Smith", "sam"}
    sid = a.post("/api/session/start", json={"date": "2026-03-04"}, headers=H).get_json()
    a.post("/api/session/%d/exercise/%d" % (sid["session"]["id"], sid["exercises"][0]["id"]), json={"completed": True}, headers=H)
    a.post("/api/session/%d/finish" % sid["session"]["id"], headers=H)
    assert b.get("/api/feed").get_json()["events"][0]["username"] == "Alex Smith"
    rid = a.post("/api/recipes", json={"title": "Soup"}, headers=H).get_json()["id"]
    assert b.get("/api/recipes/%d" % rid).get_json()["recipe"]["owner"] == "Alex Smith"
    # clearing it goes back to the login name
    a.put("/api/account", json={"display_name": ""}, headers=H)
    assert b.get("/api/friends").get_json()["friends"][0]["username"] == "admin"
    # admins see both names
    a.put("/api/account", json={"display_name": "Alex Smith"}, headers=H)
    u = [x for x in a.get("/api/admin/users").get_json()["users"] if x["username"] == "admin"][0]
    assert u["display_name"] == "Alex Smith"
