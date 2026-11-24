import os
import sys

os.environ["GYMPULSE_NO_THREADS"] = "1"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from test_app import app, client, setup_admin, add_user, H  # noqa: F401,E402


def log_food(c, date, meal="breakfast", n=1):
    fid = c.get("/api/foods/search", query_string={"q": "egg"}).get_json()["foods"][0]["id"]
    for _ in range(n):
        assert c.post("/api/diary", json={"food_id": fid, "meal": meal, "servings": 2, "date": date}, headers=H).status_code == 200


def test_saved_meals_and_copy_day(app):
    c = client(app); setup_admin(c)
    log_food(c, "2026-02-01", "breakfast", 2)
    assert c.post("/api/meals", json={"name": "", "meal": "breakfast", "date": "2026-02-01"}, headers=H).status_code == 400
    assert c.post("/api/meals", json={"name": "Usual", "meal": "lunch", "date": "2026-02-01"}, headers=H).status_code == 400
    m = c.post("/api/meals", json={"name": "Usual", "meal": "breakfast", "date": "2026-02-01"}, headers=H).get_json()["meals"][0]
    assert len(m["items"]) == 2 and m["calories"] > 0
    assert c.post("/api/meals/%d/log" % m["id"], json={"meal": "dinner", "date": "2026-02-02"}, headers=H).get_json()["added"] == 2
    d = c.get("/api/diary", query_string={"date": "2026-02-02"}).get_json()
    assert len(d["entries"]) == 2 and d["entries"][0]["meal"] == "dinner"
    assert c.post("/api/diary/copy", json={"from": "2026-02-01", "to": "2026-02-03"}, headers=H).get_json()["added"] == 2
    assert c.post("/api/diary/copy", json={"from": "2026-02-01", "to": "2026-02-01"}, headers=H).status_code == 400
    other = add_user(c, "sam")
    assert other.post("/api/meals/%d/log" % m["id"], json={"meal": "lunch"}, headers=H).status_code == 404
    assert other.get("/api/meals").get_json()["meals"] == []
    c.delete("/api/meals/%d" % m["id"], headers=H)
    assert c.get("/api/meals").get_json()["meals"] == []


def test_grocery_from_recipe(app):
    c = client(app); setup_admin(c)
    r = c.post("/api/recipes", json={"title": "Omelet", "ingredients": "3 eggs\n- 1 cup spinach\n\n1/2 cup cheese",
                                     "shared": True}, headers=H).get_json()
    rid = r.get("id") or c.get("/api/recipes").get_json()["recipes"][0]["id"]
    j = c.post("/api/recipes/%d/grocery" % rid, headers=H).get_json()
    assert j["added"] == 3 and [i["text"] for i in j["items"]] == ["3 eggs", "1 cup spinach", "1/2 cup cheese"]
    assert c.post("/api/recipes/%d/grocery" % rid, headers=H).get_json()["added"] == 0
    gid = j["items"][0]["id"]
    c.put("/api/grocery/%d" % gid, json={"done": True}, headers=H)
    assert c.get("/api/grocery").get_json()["items"][-1]["done"] == 1
    assert len(c.delete("/api/grocery", headers=H).get_json()["items"]) == 2
    stranger = add_user(c, "zed")
    assert stranger.post("/api/recipes/%d/grocery" % rid, headers=H).status_code == 404
    assert c.post("/api/grocery", json={"text": "milk"}, headers=H).get_json()["items"][-1]["text"] == "milk"


def test_water_and_measurements(app):
    c = client(app); setup_admin(c)
    assert c.post("/api/water", json={"date": "2026-02-01", "add_oz": 8}, headers=H).get_json()["oz"] == 8
    assert c.post("/api/water", json={"date": "2026-02-01", "add_oz": 12}, headers=H).get_json()["oz"] == 20
    assert c.post("/api/water", json={"date": "2026-02-01", "add_oz": -100}, headers=H).get_json()["oz"] == 0
    assert c.post("/api/water", json={"date": "2026-02-01", "set_oz": 40}, headers=H).get_json()["oz"] == 40
    assert c.post("/api/water", json={"add_oz": "lots"}, headers=H).status_code == 400
    assert c.put("/api/water/goal", json={"goal_oz": 80}, headers=H).get_json()["goal_oz"] == 80
    m = c.post("/api/measurements", json={"date": "2026-02-01", "waist_in": 34}, headers=H).get_json()["measurements"]
    m = c.post("/api/measurements", json={"date": "2026-02-01", "hips_in": 40}, headers=H).get_json()["measurements"]
    assert len(m) == 1 and m[0]["waist_in"] == 34 and m[0]["hips_in"] == 40
    assert c.post("/api/measurements", json={"waist_in": 1000}, headers=H).status_code == 400


def test_health_endpoint_with_shortcut_token(app):
    c = client(app); setup_admin(c)
    tok = c.post("/api/tokens", json={"name": "Health Shortcut"}, headers=H).get_json()["token"]
    anon = client(app)
    hd = {"Authorization": "Bearer " + tok}
    assert anon.post("/api/v1/health", json={"date": "2026-02-01", "steps": 4200}, headers=hd).status_code == 200
    assert anon.post("/api/v1/health", json={"date": "2026-02-01", "resting_hr": 61}, headers=hd).status_code == 200
    assert anon.post("/api/v1/health", json={"steps": "abc"}, headers=hd).status_code == 400
    day = c.get("/api/health").get_json()["days"][0]
    assert day["steps"] == 4200 and day["resting_hr"] == 61
    assert anon.get("/api/v1/health", headers=hd).status_code == 401   # shortcut token can only send


def test_cleanup_deletes(app):
    c = client(app); setup_admin(c)
    # weigh-in
    c.post("/api/weight", json={"weight_lb": 180, "date": "2026-02-01"}, headers=H)
    c.delete("/api/weight/2026-02-01", headers=H)
    assert c.get("/api/weights").get_json()["weights"] == []
    # own food, past diary entry keeps its numbers
    f = c.post("/api/foods", json={"name": "Mom's soup", "calories": 200}, headers=H).get_json()["food"]
    c.post("/api/diary", json={"food_id": f["id"], "meal": "lunch", "servings": 1, "date": "2026-02-01"}, headers=H)
    other = add_user(c, "sam")
    assert other.delete("/api/foods/%d" % f["id"], headers=H).status_code == 404
    assert c.delete("/api/foods/%d" % f["id"], headers=H).status_code == 200
    assert c.get("/api/diary", query_string={"date": "2026-02-01"}).get_json()["entries"][0]["calories"] == 200
    assert c.delete("/api/foods/1", headers=H).status_code == 404       # built-in foods are not deletable
    # tips: author or recipe owner only
    rid = c.post("/api/recipes", json={"title": "Soup", "ingredients": "water", "shared": True}, headers=H).get_json()
    rid = rid.get("id") or c.get("/api/recipes").get_json()["recipes"][0]["id"]
    c.post("/api/friends/request", json={"username": "admin"}, headers=dict(H))  # no-op for admin
    other.post("/api/friends/request", json={"username": "admin"}, headers=H)
    fid = c.get("/api/friends").get_json()["incoming"][0]["id"]
    c.post("/api/friends/%d/accept" % fid, headers=H)
    other.post("/api/recipes/%d/tips" % rid, json={"text": "Add salt"}, headers=H)
    tid = c.get("/api/recipes/%d" % rid).get_json()["tips"][0]["id"]
    third = add_user(c, "zed")
    assert third.delete("/api/recipes/%d/tips/%d" % (rid, tid), headers=H).status_code == 404
    assert c.delete("/api/recipes/%d/tips/%d" % (rid, tid), headers=H).status_code == 200   # recipe owner
    assert c.get("/api/recipes/%d" % rid).get_json()["tips"] == []
    # deleting a finished workout also removes its feed post; own feed posts can be deleted
    s = c.post("/api/session/start", json={}, headers=H).get_json()
    ex = [e for e in s["exercises"] if e["kind"] == "sets"][0]
    c.post("/api/session/%d/exercise/%d" % (s["session"]["id"], ex["id"]), json={"sets_done": 1}, headers=H)
    c.post("/api/session/%d/finish" % s["session"]["id"], json={}, headers=H)
    assert any(e["type"] == "workout" for e in c.get("/api/feed").get_json()["events"])
    c.delete("/api/session/%d" % s["session"]["id"], headers=H)
    assert not any(e["type"] == "workout" for e in c.get("/api/feed").get_json()["events"])
    ev = [e for e in c.get("/api/feed").get_json()["events"] if e["user_id"] == 1]
    if ev:
        assert other.delete("/api/feed/%d" % ev[0]["id"], headers=H).status_code == 200   # not theirs: nothing happens
        assert any(e["id"] == ev[0]["id"] for e in c.get("/api/feed").get_json()["events"])
        c.delete("/api/feed/%d" % ev[0]["id"], headers=H)
        assert not any(e["id"] == ev[0]["id"] for e in c.get("/api/feed").get_json()["events"])
