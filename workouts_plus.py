"""
Workout extras: weight and reps for each set, "last time" hints, personal
records, and an offline-friendly sync call.

An app (or the web page while offline) can keep a whole workout on the phone
and send it in one go with POST /api/v1/sync/workout. Sending the same workout
again is safe: it is matched by the `cid` the app made up, so nothing doubles.
"""

from flask import g, jsonify, request

SCHEMA = """
CREATE TABLE IF NOT EXISTS set_logs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_no INTEGER NOT NULL,
  weight_lb REAL NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  is_pr INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_exercise_id, set_no)
);
"""
MIGRATIONS = (("sessions", "cid", "TEXT"), ("session_exercises", "cid", "TEXT"))
POST_SCHEMA = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_cid ON sessions(user_id, cid) WHERE cid IS NOT NULL;
"""


def e1rm(weight, reps):
    """Estimated best single lift (Epley formula). Used only to compare sets."""
    if weight <= 0 or reps <= 0:
        return 0.0
    return round(weight * (1 + reps / 30.0), 1)


def register(app, h):
    db, rows, one, err, body, num, text = h.db, h.rows, h.one, h.err, h.body, h.num, h.text
    login_required = h.login_required

    def logs_for(seid):
        return rows("SELECT set_no, weight_lb, reps, is_pr FROM set_logs "
                    "WHERE session_exercise_id=? ORDER BY set_no", (seid,))

    def baseline(uid, name, exclude_sid):
        r = one("SELECT MAX(l.weight_lb * (1 + l.reps / 30.0)) AS best FROM set_logs l "
                "JOIN session_exercises e ON e.id=l.session_exercise_id "
                "JOIN sessions s ON s.id=e.session_id "
                "WHERE s.user_id=? AND s.id<>? AND LOWER(e.name)=LOWER(?) AND l.weight_lb>0 AND l.reps>0",
                (uid, exclude_sid, name))
        return (r or {}).get("best") or 0.0

    def mark_prs(sid):
        """A set is a record when it beats everything lifted before on that exercise."""
        s = one("SELECT * FROM sessions WHERE id=?", (sid,))
        for ex in rows("SELECT * FROM session_exercises WHERE session_id=? ORDER BY id", (sid,)):
            best = baseline(s["user_id"], ex["name"], sid)
            for lg in rows("SELECT * FROM set_logs WHERE session_exercise_id=? ORDER BY set_no", (ex["id"],)):
                v = e1rm(lg["weight_lb"], lg["reps"])
                is_pr = 1 if (best > 0 and v > best + 0.05) else 0
                if v > best:
                    best = v
                if is_pr != lg["is_pr"]:
                    db().execute("UPDATE set_logs SET is_pr=? WHERE id=?", (is_pr, lg["id"]))
        db().commit()

    def last_time(uid, name, exclude_sid):
        prev = one("SELECT e.id, s.date FROM session_exercises e JOIN sessions s ON s.id=e.session_id "
                   "WHERE s.user_id=? AND s.id<>? AND LOWER(e.name)=LOWER(?) "
                   "AND EXISTS(SELECT 1 FROM set_logs l WHERE l.session_exercise_id=e.id AND (l.weight_lb>0 OR l.reps>0)) "
                   "ORDER BY s.started_at DESC, e.id DESC LIMIT 1", (uid, exclude_sid, name))
        if not prev:
            return None
        return {"date": prev["date"], "sets": logs_for(prev["id"])}

    def extras(s, exs):
        for ex in exs:
            ex["logs"] = logs_for(ex["id"])
            ex["last"] = last_time(s["user_id"], ex["name"], s["id"]) if ex["kind"] == "sets" else None

    h.payload_extras.append(extras)

    def on_finish(s, did):
        mark_prs(s["id"])
        n = one("SELECT COUNT(DISTINCT LOWER(e.name)) AS c FROM set_logs l "
                "JOIN session_exercises e ON e.id=l.session_exercise_id "
                "WHERE e.session_id=? AND l.is_pr=1", (s["id"],))["c"]
        if n:
            names = [r["name"] for r in rows(
                "SELECT DISTINCT e.name FROM set_logs l JOIN session_exercises e ON e.id=l.session_exercise_id "
                "WHERE e.session_id=? AND l.is_pr=1 ORDER BY e.id LIMIT 3", (s["id"],))]
            db().execute("INSERT INTO events(user_id,type,text,ref_id,created_at) VALUES(?,?,?,?,?)",
                         (s["user_id"], "pr", "set a personal record: " + ", ".join(names), s["id"], h.now()))
            db().commit()
        g.finish_extras = dict(getattr(g, "finish_extras", {}), prs=n)

    h.after_finish.append(on_finish)
    h.on_finish_prs = on_finish

    def clean_set(d):
        w = num(d.get("weight_lb"), 0, 2000, 0)
        r = int(num(d.get("reps"), 0, 1000, 0))
        return round(w, 1), r

    # ---- one set's weight and reps ----
    @app.put("/api/session/<int:sid>/exercise/<int:seid>/set/<int:n>")
    @login_required()
    def api_set_log(sid, n, seid):
        """Save the weight and reps for one set of an exercise."""
        s = one("SELECT * FROM sessions WHERE id=? AND user_id=?", (sid, g.user["id"]))
        ex = one("SELECT * FROM session_exercises WHERE id=? AND session_id=?", (seid, sid))
        if not s or not ex:
            return err("Not found.", 404)
        if n < 1 or n > 30:
            return err("Set number looks wrong.")
        w, r = clean_set(body())
        db().execute("INSERT INTO set_logs(session_exercise_id,set_no,weight_lb,reps) VALUES(?,?,?,?) "
                     "ON CONFLICT(session_exercise_id,set_no) DO UPDATE SET weight_lb=excluded.weight_lb, reps=excluded.reps",
                     (seid, n, w, r))
        db().commit()
        mark_prs(sid)
        return jsonify(h.session_payload(s))

    # ---- last time + records ----
    @app.get("/api/exercise-history")
    @login_required()
    def api_exercise_history():
        name = text(request.args.get("name"), 80)
        return jsonify({"name": name, "last": last_time(g.user["id"], name, 0),
                        "best_e1rm": baseline(g.user["id"], name, 0)})

    @app.get("/api/records")
    @login_required()
    def api_records():
        """Heaviest lifts so far, one line per exercise."""
        data = rows(
            "SELECT e.name, l.weight_lb, l.reps, s.date FROM set_logs l "
            "JOIN session_exercises e ON e.id=l.session_exercise_id JOIN sessions s ON s.id=e.session_id "
            "WHERE s.user_id=? AND l.weight_lb>0 AND l.reps>0 ORDER BY s.date ASC, l.id ASC", (g.user["id"],))
        best = {}
        for d in data:
            key = d["name"].lower()
            v = e1rm(d["weight_lb"], d["reps"])
            if key not in best or v >= best[key]["e1rm"]:
                best[key] = {"name": d["name"], "weight_lb": d["weight_lb"], "reps": d["reps"],
                             "date": d["date"], "e1rm": v}
        out = sorted(best.values(), key=lambda r: -r["e1rm"])
        return jsonify({"records": out})

    # ---- offline sync ----
    @app.post("/api/sync/workout")
    @login_required()
    def api_sync_workout():
        """Send a whole workout kept on the phone. Safe to send again."""
        b = body()
        uid = g.user["id"]
        cid = text(b.get("cid"), 64)
        if not cid:
            return err("Missing workout id (cid).")
        plan = h.clean_plan(b.get("plan"), uid)
        started = int(num(b.get("started_at"), 1, 4102444800, h.now()))
        ended = num(b.get("ended_at"), 1, 4102444800, None)
        date = h.valid_date(b.get("date"))
        s = one("SELECT * FROM sessions WHERE user_id=? AND cid=?", (uid, cid))
        if not s and isinstance(b.get("session_id"), int):
            # adopt a workout that was started on the server before this app went offline
            s = one("SELECT * FROM sessions WHERE id=? AND user_id=? AND cid IS NULL", (b["session_id"], uid))
            if s:
                db().execute("UPDATE sessions SET cid=? WHERE id=?", (cid, s["id"]))
        if not s:
            sid = db().execute("INSERT INTO sessions(user_id,date,started_at,plan,cid) VALUES(?,?,?,?,?)",
                               (uid, date, started, plan, cid)).lastrowid
        else:
            sid = s["id"]
        if s and s["ended_at"] is not None:
            return jsonify(dict(h.session_payload(s), ok=True, already_finished=True))
        exs = b.get("exercises")
        if not isinstance(exs, list) or len(exs) > 60:
            return err("Send a list of exercises.")
        keep = []
        for i, raw in enumerate(exs):
            if not isinstance(raw, dict):
                continue
            ex, problem = h.clean_exercise(raw)
            if problem:
                return err(problem)
            ecid = text(raw.get("cid"), 64) or ("auto%d" % i)
            done = int(num(raw.get("sets_done"), 0, max(ex["sets_total"], 20), 0))
            if ex["kind"] == "sets":
                done = min(done, ex["sets_total"])
                completed = 1 if done >= ex["sets_total"] else 0
            else:
                done, completed = 0, 1 if raw.get("completed") else 0
            cur = one("SELECT id FROM session_exercises WHERE session_id=? AND cid=?", (sid, ecid))
            if not cur and isinstance(raw.get("id"), int):
                cur = one("SELECT id FROM session_exercises WHERE session_id=? AND id=?", (sid, raw["id"]))
                if cur:
                    db().execute("UPDATE session_exercises SET cid=? WHERE id=?", (ecid, cur["id"]))
            if cur:
                seid = cur["id"]
                db().execute("UPDATE session_exercises SET name=?,kind=?,sets_total=?,category=?,note=?,reps=?,"
                             "seconds=?,sets_done=?,completed=? WHERE id=?",
                             (ex["name"], ex["kind"], ex["sets_total"], ex["category"], ex["note"], ex["reps"],
                              ex["seconds"], done, completed, seid))
            else:
                rid = raw.get("routine_id")
                rid = rid if one("SELECT id FROM routine WHERE id=? AND user_id=?", (rid, uid)) else None
                seid = db().execute(
                    "INSERT INTO session_exercises(session_id,routine_id,name,kind,sets_total,sets_done,completed,"
                    "category,note,reps,seconds,cid) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (sid, rid, ex["name"], ex["kind"], ex["sets_total"], done, completed, ex["category"],
                     ex["note"], ex["reps"], ex["seconds"], ecid)).lastrowid
            keep.append(seid)
            for lg in (raw.get("sets") or [])[:30]:
                if isinstance(lg, dict):
                    n = int(num(lg.get("set_no"), 1, 30, 0))
                    if n:
                        w, r = clean_set(lg)
                        db().execute(
                            "INSERT INTO set_logs(session_exercise_id,set_no,weight_lb,reps) VALUES(?,?,?,?) "
                            "ON CONFLICT(session_exercise_id,set_no) DO UPDATE SET weight_lb=excluded.weight_lb, reps=excluded.reps",
                            (seid, n, w, r))
        if keep:
            marks = ",".join("?" * len(keep))
            db().execute("DELETE FROM session_exercises WHERE session_id=? AND id NOT IN (%s)" % marks, [sid] + keep)
        else:
            db().execute("DELETE FROM session_exercises WHERE session_id=?", (sid,))
        db().commit()
        mark_prs(sid)
        s = one("SELECT * FROM sessions WHERE id=?", (sid,))
        if ended:
            paused = int(num(b.get("paused_sec"), 0, 43200, 0))
            h.finish_session(s, paused, int(ended))
            s = one("SELECT * FROM sessions WHERE id=?", (sid,))
        out = h.session_payload(s)
        out["ok"] = True
        out["extras"] = g.get("finish_extras", {})
        return jsonify(out)

    h.features.extend(["set_logs", "records", "sync"])
