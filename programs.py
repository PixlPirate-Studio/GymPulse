"""
Ready-made beginner workouts. You pick a level and how long you have, and
GymPulse builds a well-rounded full-body workout (legs, chest, back, shoulders,
core) that fits the time. The result is saved as one of your own workouts, so
you can change it like any other.
"""

import guide
from flask import g, jsonify, request

SCHEMA = ""

LEVELS = [
    {"name": "Just starting", "desc": "First few weeks. Light weights and plenty of rest.", "sets": 2, "rest": 90, "reps": "10-12", "plank": 20},
    {"name": "Getting comfortable", "desc": "You know the basics. A little heavier.", "sets": 3, "rest": 75, "reps": "10-12", "plank": 30},
    {"name": "Ready for more", "desc": "Steady for a few months. Heavier, shorter rests.", "sets": 3, "rest": 60, "reps": "8-12", "plank": 45},
]
LENGTHS = (20, 30, 45, 60)

# Most important first: legs, push, pull, core, then the rest of the body.
SLOTS = {
    0: ["leg-press", "chest-press", "lat-pulldown", "plank", "glute-bridge", "shoulder-press", "seated-row", "leg-curl", "calf-raise", "crunch"],
    1: ["goblet-squat", "db-bench", "db-row", "plank", "rdl", "db-shoulder-press", "lat-pulldown", "lunge", "bicep-curl", "triceps-pushdown"],
    2: ["goblet-squat", "db-bench", "db-row", "plank", "rdl", "db-shoulder-press", "lat-pulldown", "lunge", "pushup", "bicep-curl"],
}
GROUP = {"leg-press": "Legs", "goblet-squat": "Legs", "lunge": "Legs", "rdl": "Legs", "glute-bridge": "Legs",
         "leg-curl": "Legs", "calf-raise": "Legs", "chest-press": "Chest", "db-bench": "Chest", "pushup": "Chest",
         "lat-pulldown": "Back", "seated-row": "Back", "db-row": "Back", "shoulder-press": "Shoulders",
         "db-shoulder-press": "Shoulders", "bicep-curl": "Arms", "triceps-pushdown": "Arms", "plank": "Core", "crunch": "Core"}
ORDER = ["Legs", "Chest", "Back", "Shoulders", "Arms", "Core"]


def row_for(slug):
    for r in guide.G:
        if r[0] == slug:
            return r
    raise KeyError(slug)


def make(level, minutes):
    lv = LEVELS[level]
    warm = 120 if minutes <= 20 else 300
    cool = 60 if minutes <= 20 else (120 if minutes <= 30 else 180)
    budget = minutes * 60
    nsets = min(lv["sets"], 2) if minutes <= 30 else lv["sets"]  # short visits: 2 sets each

    def cost(slug):
        if slug == "plank":
            return lv["plank"] + 45
        return nsets * (40 + lv["rest"]) + 60

    used = warm + cool
    picked = []
    for slug in SLOTS[level]:
        c = cost(slug)
        if len(picked) >= 4 and used + c > budget + 90:
            break  # always keep the first four: legs, push, pull, core
        picked.append(slug)
        used += c
    picked.sort(key=lambda s: ORDER.index(GROUP[s]))
    out = []

    def add(slug, **kw):
        r = row_for(slug)
        d = {"slug": slug, "name": r[1], "category": r[2], "kind": r[3], "sets_total": r[4], "reps": r[5], "seconds": r[6], "note": ""}
        d.update(kw)
        out.append(d)

    add("treadmill", kind="timed", sets_total=0, seconds=warm, reps="", note="Easy pace. Just get warm.")
    for slug in picked:
        if slug == "plank":
            add(slug, kind="timed", sets_total=0, seconds=lv["plank"], reps="", note="Hold a straight line. Stop if it hurts.")
        else:
            add(slug, kind="sets", sets_total=nsets, reps=lv["reps"], seconds=lv["rest"])
    add("stretch", kind="timed", sets_total=0, seconds=cool, reps="")
    return out, used, nsets


def groups_of(items):
    seen = {GROUP[i["slug"]] for i in items if i["slug"] in GROUP}
    return [x for x in ORDER if x in seen]


def register(app, h):
    db, rows, one, err, body, num, text = h.db, h.rows, h.one, h.err, h.body, h.num, h.text
    login_required = h.login_required

    def parse(src):
        level = int(num(src.get("level"), 0, len(LEVELS) - 1, 0))
        minutes = int(num(src.get("minutes"), 10, 120, 30))
        minutes = min(LENGTHS, key=lambda m: abs(m - minutes))
        return level, minutes

    def preview(level, minutes):
        items, used, nsets = make(level, minutes)
        lv = LEVELS[level]
        return {"level": level, "level_name": lv["name"], "minutes": minutes, "est_min": int(round(used / 60.0)),
                "count": len(items), "sets": nsets, "rest": lv["rest"], "groups": groups_of(items), "exercises": items}

    @app.get("/api/programs/preview")
    @login_required()
    def api_programs_preview():
        level, minutes = parse(request.args)
        return jsonify(preview(level, minutes))

    @app.post("/api/programs/build")
    @login_required()
    def api_programs_build():
        uid = g.user["id"]
        level, minutes = parse(body())
        pv = preview(level, minutes)
        base = "%s · %d min" % (LEVELS[level]["name"], minutes)
        names = h.plan_names(uid)
        name, n = base, 2
        while name in names:
            name = "%s (%d)" % (base, n)
            n += 1
        db().execute("INSERT INTO plans(user_id,name) VALUES(?,?)", (uid, name))
        for pos, e in enumerate(pv["exercises"]):
            db().execute(
                "INSERT INTO routine(user_id,position,name,category,note,kind,sets_total,seconds,reps,plan) VALUES(?,?,?,?,?,?,?,?,?,?)",
                (uid, pos, e["name"], e["category"], e["note"], e["kind"], e["sets_total"], e["seconds"], e["reps"], name))
        db().commit()
        return jsonify(dict(pv, plan=name, plans=h.plan_names(uid)))

    h.features.append("programs")
