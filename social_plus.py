"""
Friends and motivation: emoji reactions, nudges, in-app notifications,
challenges, badges and scheduled workout reminders.
"""

import datetime as dt
import json
import time

from flask import g, jsonify, request

SCHEMA = """
CREATE TABLE IF NOT EXISTS reactions(
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(event_id, user_id)
);
INSERT OR IGNORE INTO reactions(event_id,user_id,emoji,created_at)
  SELECT event_id, user_id, '\U0001F44F', 0 FROM cheers;
DELETE FROM cheers;
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, text TEXT NOT NULL, ref_id INTEGER,
  created_at INTEGER NOT NULL, is_read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notifications(user_id, id);
CREATE TABLE IF NOT EXISTS nudges(
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  PRIMARY KEY(from_id, to_id, day)
);
CREATE TABLE IF NOT EXISTS challenges(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'team',
  metric TEXT NOT NULL DEFAULT 'workouts', target INTEGER NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER, winner_id INTEGER
);
CREATE TABLE IF NOT EXISTS challenge_members(
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited',
  PRIMARY KEY(challenge_id, user_id)
);
CREATE TABLE IF NOT EXISTS badges(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL, earned_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, code)
);
CREATE TABLE IF NOT EXISTS reminders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  days TEXT NOT NULL DEFAULT '0,2,4', at TEXT NOT NULL DEFAULT '17:30',
  tz TEXT NOT NULL DEFAULT 'UTC', label TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1, last_sent TEXT DEFAULT ''
);
"""

EMOJIS = ["\U0001F44F", "\U0001F525", "\U0001F4AA", "\U0001F389", "❤️"]

# code: (icon, name, how to earn it)
BADGES = {
    "first_workout": ("\U0001F31F", "First workout", "Finish your first workout."),
    "workouts_5": ("\U0001F3C3", "Getting started", "Work out on 5 different days."),
    "workouts_10": ("\U0001F4AA", "Double digits", "Work out on 10 different days."),
    "workouts_25": ("\U0001F947", "Quarter century", "Work out on 25 different days."),
    "workouts_50": ("\U0001F3C6", "Fifty strong", "Work out on 50 different days."),
    "workouts_100": ("\U0001F451", "Century club", "Work out on 100 different days."),
    "streak_3": ("\U0001F525", "On a roll", "Keep a 3-workout streak."),
    "streak_7": ("⚡", "Week warrior", "Keep a 7-workout streak."),
    "streak_14": ("\U0001F680", "Unstoppable", "Keep a 14-workout streak."),
    "first_pr": ("\U0001F4C8", "New personal best", "Beat your best lift on an exercise."),
    "pr_10": ("\U0001F3AF", "Record breaker", "Set 10 personal bests."),
    "iron_100": ("\U0001F3CB️", "Triple digits", "Lift 100 lb or more in a set."),
    "minutes_600": ("⏱️", "10 hours moved", "Log 10 hours of workouts in total."),
    "weekly_goal": ("✅", "Weekly goal hit", "Hit your workouts-per-week goal."),
    "first_weighin": ("⚖️", "On the scale", "Log your weight."),
    "food_7": ("\U0001F34E", "Food log habit", "Log food on 7 different days."),
    "first_recipe": ("\U0001F373", "Chef", "Share a recipe."),
    "first_friend": ("\U0001F91D", "Better together", "Connect with a friend."),
    "first_react": ("\U0001F389", "Cheerleader", "React to a friend's activity."),
    "challenge_done": ("\U0001F3C1", "Challenger", "Finish a friend challenge."),
}


def register(app, h):
    db, rows, one, err, body, num, text = h.db, h.rows, h.one, h.err, h.body, h.num, h.text
    login_required = h.login_required
    now = h.now

    def display(uid):
        r = one("SELECT COALESCE(NULLIF(display_name,''), username) AS n FROM users WHERE id=?", (uid,))
        return (r or {}).get("n", "Someone")

    def notify(uid, kind, msg, ref=None, push=None):
        """Add an in-app notification, and a lock-screen alert when push is given."""
        db().execute("INSERT INTO notifications(user_id,kind,text,ref_id,created_at) VALUES(?,?,?,?,?)",
                     (uid, kind, msg[:200], ref, now()))
        if push:
            db().execute("INSERT INTO alerts(user_id,due_at,title,body,nudges_left) VALUES(?,?,?,?,0)",
                         (uid, now(), push[0][:80], push[1][:160]))
        db().commit()

    h.notify = notify

    # =================== reactions ===================
    def feed_reactions(evs, uid):
        if not evs:
            return
        marks = ",".join("?" * len(evs))
        ids = [e["id"] for e in evs]
        counts = {}
        for r in rows("SELECT event_id, emoji, COUNT(*) AS c FROM reactions WHERE event_id IN (%s) "
                      "GROUP BY event_id, emoji" % marks, ids):
            counts.setdefault(r["event_id"], {})[r["emoji"]] = r["c"]
        mine = {r["event_id"]: r["emoji"] for r in rows(
            "SELECT event_id, emoji FROM reactions WHERE user_id=? AND event_id IN (%s)" % marks, [uid] + ids)}
        for e in evs:
            c = counts.get(e["id"], {})
            e["reactions"] = [{"emoji": k, "count": c[k]} for k in EMOJIS if k in c]
            e["mine"] = mine.get(e["id"], "")

    h.feed_extras.append(feed_reactions)

    @app.post("/api/feed/<int:eid>/react")
    @login_required()
    def api_feed_react(eid):
        """React to a friend's post with one emoji. Same emoji again removes it."""
        uid = g.user["id"]
        emoji = body().get("emoji")
        ev = one("SELECT * FROM events WHERE id=?", (eid,))
        if emoji not in EMOJIS or not ev or ev["user_id"] == uid or ev["user_id"] not in h.friend_ids(uid):
            return err("Not found.", 404)
        cur = one("SELECT emoji FROM reactions WHERE event_id=? AND user_id=?", (eid, uid))
        if cur and cur["emoji"] == emoji:
            db().execute("DELETE FROM reactions WHERE event_id=? AND user_id=?", (eid, uid))
        else:
            db().execute("INSERT OR REPLACE INTO reactions(event_id,user_id,emoji,created_at) VALUES(?,?,?,?)",
                         (eid, uid, emoji, now()))
            if not cur:
                notify(ev["user_id"], "reaction", "%s reacted %s to your post" % (display(uid), emoji), eid)
        db().commit()
        return jsonify({"ok": True})

    # =================== notifications ===================
    @app.get("/api/notifications")
    @login_required()
    def api_notifications():
        items = rows("SELECT id, kind, text, ref_id, created_at, is_read FROM notifications "
                     "WHERE user_id=? ORDER BY id DESC LIMIT 40", (g.user["id"],))
        unread = one("SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0", (g.user["id"],))["c"]
        return jsonify({"items": items, "unread": unread})

    @app.post("/api/notifications/read")
    @login_required()
    def api_notifications_read():
        db().execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (g.user["id"],))
        db().execute("DELETE FROM notifications WHERE user_id=? AND created_at<?", (g.user["id"], now() - 60 * 86400))
        db().commit()
        return jsonify({"ok": True})

    # =================== nudges ===================
    @app.post("/api/friends/<int:other>/nudge")
    @login_required()
    def api_nudge(other):
        """A friendly poke. One per friend per day."""
        uid = g.user["id"]
        if other == uid or other not in h.friend_ids(uid):
            return err("Not found.", 404)
        day = dt.date.today().isoformat()
        if one("SELECT 1 AS x FROM nudges WHERE from_id=? AND to_id=? AND day=?", (uid, other, day)):
            return err("You already nudged them today. Give them a little time!")
        db().execute("INSERT INTO nudges VALUES(?,?,?)", (uid, other, day))
        me = display(uid)
        notify(other, "nudge", "%s nudged you: time to move!" % me, uid,
               push=("%s nudged you" % me, "Ready for a workout today?"))
        return jsonify({"ok": True})

    # =================== badges ===================
    def counts_for(uid):
        c = {}
        c["days"] = len(h.worked_dates(uid))
        c["streak"] = h.streak_for(uid, dt.date.today().isoformat())
        c["prs"] = one("SELECT COUNT(*) AS c FROM set_logs l JOIN session_exercises e ON e.id=l.session_exercise_id "
                       "JOIN sessions s ON s.id=e.session_id WHERE s.user_id=? AND l.is_pr=1", (uid,))["c"]
        c["heavy"] = one("SELECT COUNT(*) AS c FROM set_logs l JOIN session_exercises e ON e.id=l.session_exercise_id "
                         "JOIN sessions s ON s.id=e.session_id WHERE s.user_id=? AND l.weight_lb>=100 AND l.reps>0",
                         (uid,))["c"]
        c["minutes"] = (one("SELECT COALESCE(SUM(duration_sec),0) AS d FROM sessions WHERE user_id=? AND ended_at IS NOT NULL",
                            (uid,))["d"] or 0) // 60
        c["weighins"] = one("SELECT COUNT(*) AS c FROM weights WHERE user_id=?", (uid,))["c"]
        c["food_days"] = one("SELECT COUNT(DISTINCT date) AS c FROM diary WHERE user_id=?", (uid,))["c"]
        c["recipes"] = one("SELECT COUNT(*) AS c FROM recipes WHERE owner_id=?", (uid,))["c"]
        c["friends"] = len(h.friend_ids(uid))
        c["reacts"] = one("SELECT COUNT(*) AS c FROM reactions WHERE user_id=?", (uid,))["c"]
        c["challenges"] = one("SELECT COUNT(*) AS c FROM challenges WHERE completed_at IS NOT NULL AND id IN "
                              "(SELECT challenge_id FROM challenge_members WHERE user_id=? AND status='joined')",
                              (uid,))["c"]
        p = one("SELECT workouts_per_week AS w FROM profiles WHERE user_id=?", (uid,)) or {}
        wk = h.week_for(uid, dt.date.today().isoformat())["workouts"]
        c["week_goal"] = 1 if wk >= max(1, p.get("w") or 3) else 0
        return c

    RULES = {
        "first_workout": lambda c: c["days"] >= 1, "workouts_5": lambda c: c["days"] >= 5,
        "workouts_10": lambda c: c["days"] >= 10, "workouts_25": lambda c: c["days"] >= 25,
        "workouts_50": lambda c: c["days"] >= 50, "workouts_100": lambda c: c["days"] >= 100,
        "streak_3": lambda c: c["streak"] >= 3, "streak_7": lambda c: c["streak"] >= 7,
        "streak_14": lambda c: c["streak"] >= 14, "first_pr": lambda c: c["prs"] >= 1,
        "pr_10": lambda c: c["prs"] >= 10, "iron_100": lambda c: c["heavy"] >= 1,
        "minutes_600": lambda c: c["minutes"] >= 600, "weekly_goal": lambda c: c["week_goal"] == 1,
        "first_weighin": lambda c: c["weighins"] >= 1, "food_7": lambda c: c["food_days"] >= 7,
        "first_recipe": lambda c: c["recipes"] >= 1, "first_friend": lambda c: c["friends"] >= 1,
        "first_react": lambda c: c["reacts"] >= 1, "challenge_done": lambda c: c["challenges"] >= 1,
    }

    def check_badges(uid):
        have = {r["code"] for r in rows("SELECT code FROM badges WHERE user_id=?", (uid,))}
        c = counts_for(uid)
        new = []
        for code, ok in RULES.items():
            if code not in have and ok(c):
                db().execute("INSERT OR IGNORE INTO badges VALUES(?,?,?)", (uid, code, now()))
                icon, name, _ = BADGES[code]
                db().execute("INSERT INTO events(user_id,type,text,ref_id,created_at) VALUES(?,?,?,?,?)",
                             (uid, "badge", "earned a badge: %s %s" % (icon, name), None, now()))
                notify(uid, "badge", "New badge: %s %s" % (icon, name))
                new.append(code)
        db().commit()
        return new

    h.check_badges = check_badges
    last_check = {}

    @app.after_request
    def badge_sweep(resp):
        u = g.get("user")
        if u and request.method in ("POST", "PUT") and resp.status_code < 400 and request.path.startswith("/api/") \
                and (time.time() - last_check.get(u["id"], 0) > 1 or "/finish" in request.path
                     or "/sync/" in request.path):
            last_check[u["id"]] = time.time()
            try:
                check_badges(u["id"])
            except Exception as exc:  # badges are a bonus, never break a request
                print("Badge check error:", exc)
        return resp

    @app.get("/api/badges")
    @login_required()
    def api_badges():
        uid = request.args.get("user", type=int) or g.user["id"]
        if uid != g.user["id"] and uid not in h.friend_ids(g.user["id"]):
            return err("Not found.", 404)
        got = {r["code"]: r["earned_at"] for r in rows("SELECT code, earned_at FROM badges WHERE user_id=?", (uid,))}
        return jsonify({"badges": [{"code": k, "icon": v[0], "name": v[1], "how": v[2],
                                    "earned_at": got.get(k)} for k, v in BADGES.items()]})

    # =================== challenges ===================
    def progress(uid, ch):
        if ch["metric"] == "minutes":
            r = one("SELECT COALESCE(SUM(s.duration_sec),0) AS v FROM sessions s WHERE s.user_id=? AND s.ended_at IS NOT NULL "
                    "AND s.date BETWEEN ? AND ? AND EXISTS(SELECT 1 FROM session_exercises e WHERE e.session_id=s.id "
                    "AND (e.completed=1 OR e.sets_done>0))", (uid, ch["start_date"], ch["end_date"]))
            return int((r["v"] or 0) // 60)
        r = one("SELECT COUNT(DISTINCT s.date) AS v FROM sessions s WHERE s.user_id=? AND s.ended_at IS NOT NULL "
                "AND s.date BETWEEN ? AND ? AND EXISTS(SELECT 1 FROM session_exercises e WHERE e.session_id=s.id "
                "AND (e.completed=1 OR e.sets_done>0))", (uid, ch["start_date"], ch["end_date"]))
        return int(r["v"] or 0)

    def challenge_json(ch, uid):
        members = rows("SELECT user_id, status FROM challenge_members WHERE challenge_id=?", (ch["id"],))
        out = []
        for m in members:
            out.append({"id": m["user_id"], "name": display(m["user_id"]), "status": m["status"],
                        "me": m["user_id"] == uid,
                        "progress": progress(m["user_id"], ch) if m["status"] == "joined" else 0})
        out.sort(key=lambda m: (-m["progress"], m["name"].lower()))
        joined = [m for m in out if m["status"] == "joined"]
        total = sum(m["progress"] for m in joined)
        today = dt.date.today().isoformat()
        state = "done" if ch["completed_at"] else ("over" if ch["end_date"] < today else "active")
        mine = next((m["status"] for m in out if m["me"]), "")
        return {"id": ch["id"], "title": ch["title"], "kind": ch["kind"], "metric": ch["metric"],
                "target": ch["target"], "start_date": ch["start_date"], "end_date": ch["end_date"],
                "creator": display(ch["creator_id"]), "mine": ch["creator_id"] == uid, "status": mine,
                "state": state, "total": total, "members": out,
                "winner": display(ch["winner_id"]) if ch["winner_id"] else ""}

    @app.get("/api/challenges")
    @login_required()
    def api_challenges():
        uid = g.user["id"]
        res = rows("SELECT c.* FROM challenges c JOIN challenge_members m ON m.challenge_id=c.id "
                   "WHERE m.user_id=? ORDER BY c.id DESC LIMIT 30", (uid,))
        return jsonify({"challenges": [challenge_json(c, uid) for c in res]})

    @app.post("/api/challenges")
    @login_required()
    def api_challenge_create():
        uid = g.user["id"]
        b = body()
        title = text(b.get("title"), 60)
        if not title:
            return err("Give your challenge a name.")
        kind = "race" if b.get("kind") == "race" else "team"
        metric = "minutes" if b.get("metric") == "minutes" else "workouts"
        target = int(num(b.get("target"), 1, 5000, 0))
        days = int(num(b.get("days"), 1, 90, 7))
        if target < 1:
            return err("Pick a goal number.")
        invited = [i for i in (b.get("invite_ids") or []) if isinstance(i, int) and i in h.friend_ids(uid)]
        start = dt.date.today()
        cid = db().execute("INSERT INTO challenges(creator_id,title,kind,metric,target,start_date,end_date,created_at) "
                           "VALUES(?,?,?,?,?,?,?,?)",
                           (uid, title, kind, metric, target, start.isoformat(),
                            (start + dt.timedelta(days=days - 1)).isoformat(), now())).lastrowid
        db().execute("INSERT INTO challenge_members VALUES(?,?,'joined')", (cid, uid))
        for i in invited:
            db().execute("INSERT OR IGNORE INTO challenge_members VALUES(?,?,'invited')", (cid, i))
        db().commit()
        for i in invited:
            notify(i, "challenge", "%s invited you to a challenge: %s" % (display(uid), title), cid,
                   push=("New challenge from %s" % display(uid), title))
        return api_challenges()

    @app.post("/api/challenges/<int:cid>/join")
    @login_required()
    def api_challenge_join(cid):
        db().execute("UPDATE challenge_members SET status='joined' WHERE challenge_id=? AND user_id=?",
                     (cid, g.user["id"]))
        db().commit()
        return api_challenges()

    @app.post("/api/challenges/<int:cid>/leave")
    @login_required()
    def api_challenge_leave(cid):
        db().execute("DELETE FROM challenge_members WHERE challenge_id=? AND user_id=?", (cid, g.user["id"]))
        db().commit()
        return api_challenges()

    @app.delete("/api/challenges/<int:cid>")
    @login_required()
    def api_challenge_delete(cid):
        db().execute("DELETE FROM challenges WHERE id=? AND creator_id=?", (cid, g.user["id"]))
        db().commit()
        return api_challenges()

    def challenge_check(s, did):
        if not did:
            return
        uid = s["user_id"]
        for ch in rows("SELECT c.* FROM challenges c JOIN challenge_members m ON m.challenge_id=c.id "
                       "WHERE m.user_id=? AND m.status='joined' AND c.completed_at IS NULL "
                       "AND c.start_date<=? AND c.end_date>=?", (uid, s["date"], s["date"])):
            members = [m["user_id"] for m in rows(
                "SELECT user_id FROM challenge_members WHERE challenge_id=? AND status='joined'", (ch["id"],))]
            if ch["kind"] == "race":
                done = progress(uid, ch) >= ch["target"]
                winner = uid
            else:
                done = sum(progress(m, ch) for m in members) >= ch["target"]
                winner = None
            if not done:
                continue
            db().execute("UPDATE challenges SET completed_at=?, winner_id=? WHERE id=?", (now(), winner, ch["id"]))
            db().execute("INSERT INTO events(user_id,type,text,ref_id,created_at) VALUES(?,?,?,?,?)",
                         (uid, "challenge", ("won the challenge: " if winner else "finished the challenge: ") + ch["title"],
                          ch["id"], now()))
            for m in members:
                msg = ("%s won the challenge \"%s\"!" % (display(uid), ch["title"])) if winner else \
                      ("Your team finished \"%s\"!" % ch["title"])
                notify(m, "challenge", msg, ch["id"], push=("Challenge complete", msg))
            db().commit()

    h.after_finish.append(challenge_check)

    # =================== reminders ===================
    def clean_reminder(b):
        days = sorted({int(d) for d in (b.get("days") or []) if str(d).isdigit() and 0 <= int(d) <= 6})
        at = b.get("at") or ""
        try:
            hh, mm = at.split(":")
            assert 0 <= int(hh) <= 23 and 0 <= int(mm) <= 59
            at = "%02d:%02d" % (int(hh), int(mm))
        except Exception:
            return None, "Pick a time like 17:30."
        if not days:
            return None, "Pick at least one day."
        tz = text(b.get("tz"), 60) or "UTC"
        try:
            from zoneinfo import ZoneInfo
            ZoneInfo(tz)
        except Exception:
            tz = "UTC"
        return {"days": ",".join(map(str, days)), "at": at, "tz": tz, "label": text(b.get("label"), 40),
                "enabled": 0 if b.get("enabled") is False else 1}, None

    def reminder_json(r):
        return {"id": r["id"], "days": [int(d) for d in r["days"].split(",") if d != ""], "at": r["at"],
                "tz": r["tz"], "label": r["label"], "enabled": bool(r["enabled"])}

    @app.get("/api/reminders")
    @login_required()
    def api_reminders():
        return jsonify({"reminders": [reminder_json(r) for r in rows(
            "SELECT * FROM reminders WHERE user_id=? ORDER BY id", (g.user["id"],))]})

    @app.post("/api/reminders")
    @login_required()
    def api_reminder_create():
        r, problem = clean_reminder(body())
        if problem:
            return err(problem)
        if one("SELECT COUNT(*) AS c FROM reminders WHERE user_id=?", (g.user["id"],))["c"] >= 10:
            return err("That's plenty of reminders already.")
        db().execute("INSERT INTO reminders(user_id,days,at,tz,label,enabled) VALUES(?,?,?,?,?,?)",
                     (g.user["id"], r["days"], r["at"], r["tz"], r["label"], r["enabled"]))
        db().commit()
        return api_reminders()

    @app.put("/api/reminders/<int:rid>")
    @login_required()
    def api_reminder_update(rid):
        if not one("SELECT id FROM reminders WHERE id=? AND user_id=?", (rid, g.user["id"])):
            return err("Not found.", 404)
        r, problem = clean_reminder(body())
        if problem:
            return err(problem)
        db().execute("UPDATE reminders SET days=?,at=?,tz=?,label=?,enabled=?,last_sent='' WHERE id=?",
                     (r["days"], r["at"], r["tz"], r["label"], r["enabled"], rid))
        db().commit()
        return api_reminders()

    @app.delete("/api/reminders/<int:rid>")
    @login_required()
    def api_reminder_delete(rid):
        db().execute("DELETE FROM reminders WHERE id=? AND user_id=?", (rid, g.user["id"]))
        db().commit()
        return api_reminders()

    def process_reminders(at_utc=None):
        """Send each due reminder once per day, only if they haven't already worked out."""
        from zoneinfo import ZoneInfo
        at_utc = at_utc or dt.datetime.now(dt.timezone.utc)
        conn = h.connect()
        sent = 0
        try:
            conn.row_factory = __import__("sqlite3").Row
            for r in conn.execute("SELECT r.*, u.disabled FROM reminders r JOIN users u ON u.id=r.user_id "
                                  "WHERE r.enabled=1 AND u.disabled=0").fetchall():
                try:
                    local = at_utc.astimezone(ZoneInfo(r["tz"]))
                except Exception:
                    local = at_utc
                today = local.date().isoformat()
                days = [int(d) for d in r["days"].split(",") if d != ""]
                hh, mm = map(int, r["at"].split(":"))
                minutes_late = (local.hour * 60 + local.minute) - (hh * 60 + mm)
                if local.weekday() not in days or r["last_sent"] == today or not (0 <= minutes_late <= 120):
                    continue
                conn.execute("UPDATE reminders SET last_sent=? WHERE id=?", (today, r["id"]))
                worked = conn.execute(
                    "SELECT 1 FROM sessions s WHERE s.user_id=? AND s.date=? AND s.ended_at IS NOT NULL AND "
                    "EXISTS(SELECT 1 FROM session_exercises e WHERE e.session_id=s.id AND (e.completed=1 OR e.sets_done>0))",
                    (r["user_id"], today)).fetchone()
                if worked:
                    continue
                msg = (r["label"] or "Your workout") + " is on your calendar. Even 10 minutes counts!"
                conn.execute("INSERT INTO alerts(user_id,due_at,title,body,nudges_left) VALUES(?,?,?,?,0)",
                             (r["user_id"], int(time.time()), "Time to move", msg))
                conn.execute("INSERT INTO notifications(user_id,kind,text,created_at) VALUES(?,?,?,?)",
                             (r["user_id"], "reminder", msg, int(time.time())))
                sent += 1
            conn.commit()
        finally:
            conn.close()
        return sent

    app.process_reminders = process_reminders
    h.periodic.append(process_reminders)
    h.features.extend(["reactions", "nudges", "notifications", "challenges", "badges", "reminders"])
