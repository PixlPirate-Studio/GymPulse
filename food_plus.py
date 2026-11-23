"""
Food and body extras: saved meals, copy a day, grocery list, water,
body measurements, and daily health numbers (steps etc.) that an iPhone
Shortcut or a future app can send in.
"""

from flask import g, jsonify, request

SCHEMA = """
CREATE TABLE IF NOT EXISTS saved_meals(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_meal_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id INTEGER NOT NULL REFERENCES saved_meals(id) ON DELETE CASCADE,
  food_id INTEGER, name TEXT NOT NULL, serving TEXT DEFAULT '', servings REAL NOT NULL DEFAULT 1,
  calories REAL NOT NULL, protein REAL DEFAULT 0, carbs REAL DEFAULT 0, fat REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS grocery_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0,
  recipe_id INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS water(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, oz REAL NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, date)
);
CREATE TABLE IF NOT EXISTS measurements(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  waist_in REAL, hips_in REAL, chest_in REAL, arm_in REAL, thigh_in REAL,
  UNIQUE(user_id, date)
);
CREATE TABLE IF NOT EXISTS health_daily(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  steps INTEGER, active_calories REAL, resting_hr INTEGER, avg_hr INTEGER, distance_mi REAL,
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, date)
);
"""
MIGRATIONS = (("profiles", "water_goal_oz", "INTEGER NOT NULL DEFAULT 64"),)

MEALS = ("breakfast", "lunch", "dinner", "snacks")
MEASURES = ("waist_in", "hips_in", "chest_in", "arm_in", "thigh_in")


def register(app, h):
    db, rows, one, err, body, num, text = h.db, h.rows, h.one, h.err, h.body, h.num, h.text
    login_required = h.login_required
    now = h.now

    # =================== saved meals ===================
    def meals_json(uid):
        out = []
        for m in rows("SELECT * FROM saved_meals WHERE user_id=? ORDER BY name COLLATE NOCASE", (uid,)):
            items = rows("SELECT * FROM saved_meal_items WHERE meal_id=? ORDER BY id", (m["id"],))
            out.append({"id": m["id"], "name": m["name"], "items": items,
                        "calories": round(sum(i["calories"] for i in items))})
        return out

    @app.get("/api/meals")
    @login_required()
    def api_meals():
        return jsonify({"meals": meals_json(g.user["id"])})

    @app.post("/api/meals")
    @login_required()
    def api_meal_save():
        """Save what you ate at one meal as a reusable combo."""
        uid, b = g.user["id"], body()
        name = text(b.get("name"), 50)
        meal = b.get("meal") if b.get("meal") in MEALS else None
        if not name or not meal:
            return err("Give the meal a name and pick which meal to save.")
        items = rows("SELECT * FROM diary WHERE user_id=? AND date=? AND meal=? ORDER BY id",
                     (uid, h.valid_date(b.get("date")), meal))
        if not items:
            return err("There is nothing logged in that meal yet.")
        mid = db().execute("INSERT INTO saved_meals(user_id,name) VALUES(?,?)", (uid, name)).lastrowid
        for i in items:
            db().execute("INSERT INTO saved_meal_items(meal_id,food_id,name,serving,servings,calories,protein,carbs,fat) "
                         "VALUES(?,?,?,?,?,?,?,?,?)",
                         (mid, i["food_id"], i["name"], i["serving"], i["servings"], i["calories"],
                          i["protein"], i["carbs"], i["fat"]))
        db().commit()
        return jsonify({"meals": meals_json(uid)})

    @app.post("/api/meals/<int:mid>/log")
    @login_required()
    def api_meal_log(mid):
        uid, b = g.user["id"], body()
        m = one("SELECT * FROM saved_meals WHERE id=? AND user_id=?", (mid, uid))
        meal = b.get("meal") if b.get("meal") in MEALS else None
        if not m or not meal:
            return err("Pick a saved meal and a meal time.", 404 if not m else 400)
        d = h.valid_date(b.get("date"))
        n = 0
        for i in rows("SELECT * FROM saved_meal_items WHERE meal_id=?", (mid,)):
            db().execute("INSERT INTO diary(user_id,date,meal,food_id,name,serving,servings,calories,protein,carbs,fat) "
                         "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                         (uid, d, meal, i["food_id"], i["name"], i["serving"], i["servings"], i["calories"],
                          i["protein"], i["carbs"], i["fat"]))
            n += 1
        db().commit()
        return jsonify({"ok": True, "added": n})

    @app.delete("/api/meals/<int:mid>")
    @login_required()
    def api_meal_delete(mid):
        db().execute("DELETE FROM saved_meals WHERE id=? AND user_id=?", (mid, g.user["id"]))
        db().commit()
        return jsonify({"meals": meals_json(g.user["id"])})

    @app.post("/api/diary/copy")
    @login_required()
    def api_diary_copy():
        """Copy everything (or one meal) from one day to another, e.g. yesterday to today."""
        uid, b = g.user["id"], body()
        src, dst = h.valid_date(b.get("from")), h.valid_date(b.get("to"))
        if src == dst:
            return err("Pick two different days.")
        sql, args = "SELECT * FROM diary WHERE user_id=? AND date=?", [uid, src]
        if b.get("meal") in MEALS:
            sql, args = sql + " AND meal=?", args + [b["meal"]]
        items = rows(sql + " ORDER BY id", args)
        for i in items:
            db().execute("INSERT INTO diary(user_id,date,meal,food_id,name,serving,servings,calories,protein,carbs,fat) "
                         "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                         (uid, dst, i["meal"], i["food_id"], i["name"], i["serving"], i["servings"],
                          i["calories"], i["protein"], i["carbs"], i["fat"]))
        db().commit()
        return jsonify({"ok": True, "added": len(items)})

    # =================== grocery list ===================
    def grocery_json(uid):
        return {"items": rows("SELECT id, text, done, recipe_id FROM grocery_items WHERE user_id=? "
                              "ORDER BY done, id", (uid,))}

    @app.get("/api/grocery")
    @login_required()
    def api_grocery():
        return jsonify(grocery_json(g.user["id"]))

    @app.post("/api/grocery")
    @login_required()
    def api_grocery_add():
        t = text(body().get("text"), 120)
        if not t:
            return err("Type what you need to buy.")
        db().execute("INSERT INTO grocery_items(user_id,text,created_at) VALUES(?,?,?)", (g.user["id"], t, now()))
        db().commit()
        return jsonify(grocery_json(g.user["id"]))

    @app.put("/api/grocery/<int:gid>")
    @login_required()
    def api_grocery_toggle(gid):
        db().execute("UPDATE grocery_items SET done=? WHERE id=? AND user_id=?",
                     (1 if body().get("done") else 0, gid, g.user["id"]))
        db().commit()
        return jsonify(grocery_json(g.user["id"]))

    @app.delete("/api/grocery/<int:gid>")
    @login_required()
    def api_grocery_delete(gid):
        db().execute("DELETE FROM grocery_items WHERE id=? AND user_id=?", (gid, g.user["id"]))
        db().commit()
        return jsonify(grocery_json(g.user["id"]))

    @app.delete("/api/grocery")
    @login_required()
    def api_grocery_clear():
        """Clear checked-off items (or everything with ?all=1)."""
        if request.args.get("all") == "1":
            db().execute("DELETE FROM grocery_items WHERE user_id=?", (g.user["id"],))
        else:
            db().execute("DELETE FROM grocery_items WHERE user_id=? AND done=1", (g.user["id"],))
        db().commit()
        return jsonify(grocery_json(g.user["id"]))

    @app.post("/api/recipes/<int:rid>/grocery")
    @login_required()
    def api_recipe_grocery(rid):
        """Put a recipe's ingredients on your grocery list (skips ones already there)."""
        uid = g.user["id"]
        r = one("SELECT * FROM recipes WHERE id=?", (rid,))
        if not r or not (r["owner_id"] == uid or (r["shared"] and r["owner_id"] in h.friend_ids(uid))):
            return err("Recipe not found.", 404)
        have = {i["text"].lower() for i in rows("SELECT text FROM grocery_items WHERE user_id=? AND done=0", (uid,))}
        added = 0
        for line in (r["ingredients"] or "").splitlines():
            line = line.strip(" -*•\t")[:120]
            if line and line.lower() not in have:
                db().execute("INSERT INTO grocery_items(user_id,text,recipe_id,created_at) VALUES(?,?,?,?)",
                             (uid, line, rid, now()))
                have.add(line.lower())
                added += 1
        db().commit()
        return jsonify(dict(grocery_json(uid), added=added))

    # =================== water ===================
    def water_json(uid, d):
        r = one("SELECT oz FROM water WHERE user_id=? AND date=?", (uid, d))
        goal = (one("SELECT water_goal_oz AS g FROM profiles WHERE user_id=?", (uid,)) or {}).get("g") or 64
        return {"date": d, "oz": (r or {}).get("oz", 0), "goal_oz": goal}

    @app.get("/api/water")
    @login_required()
    def api_water():
        return jsonify(water_json(g.user["id"], h.valid_date(request.args.get("date"))))

    @app.post("/api/water")
    @login_required()
    def api_water_set():
        """Send add_oz to add a glass, or set_oz to correct the total."""
        uid, b = g.user["id"], body()
        d = h.valid_date(b.get("date"))
        cur = water_json(uid, d)["oz"]
        if b.get("set_oz") is not None:
            new = num(b.get("set_oz"), 0, 500, None)
        else:
            add = num(b.get("add_oz"), -200, 200, None)
            new = None if add is None else max(0, cur + add)
        if new is None:
            return err("Enter a number of ounces.")
        db().execute("INSERT INTO water(user_id,date,oz) VALUES(?,?,?) "
                     "ON CONFLICT(user_id,date) DO UPDATE SET oz=excluded.oz", (uid, d, round(new, 1)))
        db().commit()
        return jsonify(water_json(uid, d))

    @app.put("/api/water/goal")
    @login_required()
    def api_water_goal():
        goal = int(num(body().get("goal_oz"), 8, 400, 64))
        db().execute("UPDATE profiles SET water_goal_oz=? WHERE user_id=?", (goal, g.user["id"]))
        db().commit()
        return jsonify(water_json(g.user["id"], h.valid_date(request.args.get("date"))))

    # =================== body measurements ===================
    @app.get("/api/measurements")
    @login_required()
    def api_measurements():
        return jsonify({"measurements": rows(
            "SELECT * FROM measurements WHERE user_id=? ORDER BY date DESC LIMIT 60", (g.user["id"],))})

    @app.post("/api/measurements")
    @login_required()
    def api_measurement_add():
        uid, b = g.user["id"], body()
        vals = {k: num(b.get(k), 3, 120, None) for k in MEASURES}
        if all(v is None for v in vals.values()):
            return err("Enter at least one measurement in inches.")
        d = h.valid_date(b.get("date"))
        cols = ",".join(MEASURES)
        marks = ",".join("?" * len(MEASURES))
        sets = ",".join("%s=COALESCE(excluded.%s, %s)" % (k, k, k) for k in MEASURES)
        db().execute("INSERT INTO measurements(user_id,date,%s) VALUES(?,?,%s) ON CONFLICT(user_id,date) DO UPDATE SET %s"
                     % (cols, marks, sets), [uid, d] + [vals[k] for k in MEASURES])
        db().commit()
        return api_measurements()

    @app.delete("/api/measurements/<int:mid>")
    @login_required()
    def api_measurement_delete(mid):
        db().execute("DELETE FROM measurements WHERE id=? AND user_id=?", (mid, g.user["id"]))
        db().commit()
        return api_measurements()

    # =================== health numbers (steps etc.) ===================
    @app.post("/api/health")
    @login_required(scopes=("full", "health"))
    def api_health_post():
        """Send a day's numbers. Only the ones you include are changed."""
        uid, b = g.user["id"], body()
        d = h.valid_date(b.get("date"))
        fields = {
            "steps": num(b.get("steps"), 0, 200000, None),
            "active_calories": num(b.get("active_calories"), 0, 20000, None),
            "resting_hr": num(b.get("resting_hr"), 20, 250, None),
            "avg_hr": num(b.get("avg_hr"), 20, 250, None),
            "distance_mi": num(b.get("distance_mi"), 0, 500, None),
        }
        if all(v is None for v in fields.values()):
            return err("Send at least one of: steps, active_calories, resting_hr, avg_hr, distance_mi.")
        for k in ("steps", "resting_hr", "avg_hr"):
            if fields[k] is not None:
                fields[k] = int(fields[k])
        cols = list(fields)
        sets = ",".join("%s=COALESCE(excluded.%s, %s)" % (k, k, k) for k in cols) + ",updated_at=excluded.updated_at"
        db().execute("INSERT INTO health_daily(user_id,date,%s,updated_at) VALUES(?,?,%s,?) "
                     "ON CONFLICT(user_id,date) DO UPDATE SET %s" % (",".join(cols), ",".join("?" * len(cols)), sets),
                     [uid, d] + [fields[k] for k in cols] + [now()])
        db().commit()
        return jsonify({"ok": True, "date": d})

    @app.get("/api/health")
    @login_required()
    def api_health_get():
        days = int(num(request.args.get("days"), 1, 90, 14))
        return jsonify({"days": rows("SELECT * FROM health_daily WHERE user_id=? ORDER BY date DESC LIMIT ?",
                                     (g.user["id"], days))})

    h.features.extend(["saved_meals", "grocery", "water", "measurements", "health_import"])
