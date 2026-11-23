"""
Beginner how-to cards for common exercises, plus private progress photos.

The cards are plain written steps (no videos, nothing downloaded), so they
work offline and never call an outside service.
"""

import os
import re

from flask import g, jsonify, request, send_file

SCHEMA = """
CREATE TABLE IF NOT EXISTS photos(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, note TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
"""

# slug, name, category, kind, sets, reps, seconds, aliases, muscles, setup, how, mistakes, tip
G = [
    ("leg-press", "Seated Leg Press", "Lower Body", "sets", 3, "10-12", 75,
     ["leg press", "seated leg press machine", "leg press machine"], "Thighs and glutes",
     ["Sit back with your whole back flat on the pad.", "Set your feet shoulder-width apart, in the middle of the plate.",
      "Pick a light weight to start. Pin it in the stack."],
     ["Push the plate away through your heels until your legs are almost straight.",
      "Pause, then bend your knees slowly to come back. Take about 3 seconds on the way back."],
     ["Locking your knees hard at the top.", "Letting your lower back lift off the pad.", "Dropping the weight fast."],
     "If it feels easy for 12 reps, add a little weight next time."),
    ("chest-press", "Chest Press Machine", "Chest & Arms", "sets", 3, "10-12", 75,
     ["chest press", "chest press machine", "machine chest press"], "Chest, shoulders, back of arms",
     ["Adjust the seat so the handles are at mid-chest height.", "Sit tall with your back against the pad and feet flat."],
     ["Push the handles forward until your arms are nearly straight.", "Slowly bring them back until you feel a light stretch across your chest."],
     ["Shrugging your shoulders up toward your ears.", "Arching your back off the pad.", "Locking out your elbows."],
     "Breathe out as you push, in as you return."),
    ("lat-pulldown", "Lat Pulldown", "Upper Back", "sets", 3, "10-12", 75,
     ["lat pulldown machine", "pulldown", "lat pull down"], "Back and biceps",
     ["Set the thigh pad so your legs are snug under it.", "Grab the bar a little wider than your shoulders."],
     ["Lean back just slightly and pull the bar to your upper chest.", "Squeeze your shoulder blades down and together.",
      "Let the bar rise slowly until your arms are straight."],
     ["Pulling the bar behind your neck.", "Swinging your body to heave the weight.", "Using too much weight."],
     "Think of pulling with your elbows, not your hands."),
    ("seated-row", "Seated Cable Row", "Mid Back", "sets", 3, "10-12", 75,
     ["seated row", "cable row", "seated cable row", "row machine"], "Mid back and biceps",
     ["Sit with your feet on the plates and knees slightly bent.", "Sit up tall and hold the handle with arms straight."],
     ["Pull the handle to your belly button.", "Squeeze your shoulder blades together for 1 second.", "Return slowly."],
     ["Rocking your whole body back and forth.", "Rounding your shoulders forward.", "Shrugging up."],
     "Keep your chest proud, like you are showing off a logo on your shirt."),
    ("shoulder-press", "Shoulder Press Machine", "Shoulders", "sets", 3, "10-12", 75,
     ["shoulder press", "overhead press machine", "machine shoulder press"], "Shoulders and arms",
     ["Adjust the seat so the handles start at about shoulder height.", "Sit tall with your back on the pad."],
     ["Press the handles up until your arms are almost straight.", "Lower slowly back to shoulder height."],
     ["Arching your lower back.", "Pressing too heavy and shrugging.", "Letting the weight crash down."],
     "Start light; shoulders like gentle progress."),
    ("leg-extension", "Leg Extension", "Lower Body", "sets", 3, "12-15", 60,
     ["leg extension machine"], "Front of thighs",
     ["Adjust the back so your knees line up with the machine's pivot.", "Place the pad just above your ankles."],
     ["Straighten your legs until they are nearly flat.", "Hold for 1 second, then lower slowly."],
     ["Swinging the weight up.", "Going too heavy.", "Locking your knees hard."], "Light weight, slow control."),
    ("leg-curl", "Seated Leg Curl", "Lower Body", "sets", 3, "12-15", 60,
     ["leg curl", "hamstring curl", "seated leg curl machine"], "Back of thighs",
     ["Adjust the pad so it rests just above your heels.", "Sit back with your thighs snug under the thigh pad."],
     ["Pull your heels down and back as far as comfortable.", "Pause, then let them rise slowly."],
     ["Lifting your hips off the seat.", "Rushing the way up."], "Pretend you are slowly sliding a drawer closed."),
    ("bicep-curl", "Dumbbell Bicep Curl", "Arms", "sets", 3, "10-12", 60,
     ["bicep curl", "biceps curl", "dumbbell curl", "curl"], "Front of upper arms",
     ["Stand tall holding a light dumbbell in each hand, palms facing forward.", "Keep your elbows next to your ribs."],
     ["Bend your elbows to lift the weights toward your shoulders.", "Lower slowly until your arms are straight."],
     ["Swinging your body.", "Letting your elbows drift forward.", "Using weights that are too heavy."],
     "If you have to swing, the weight is too heavy."),
    ("triceps-pushdown", "Triceps Pushdown", "Arms", "sets", 3, "10-12", 60,
     ["tricep pushdown", "triceps pushdown", "cable pushdown", "triceps extension"], "Back of upper arms",
     ["Stand facing the cable with a straight bar or rope at chest height.", "Tuck your elbows against your sides."],
     ["Push down until your arms are straight.", "Let the handle rise until your forearms are just past parallel."],
     ["Flaring your elbows out.", "Leaning your whole body over the bar."], "Only your forearms should move."),
    ("goblet-squat", "Squat (Bodyweight or Goblet)", "Legs & Core", "sets", 3, "8-10", 75,
     ["squat", "squats", "bodyweight or assisted squats", "bodyweight squat", "assisted squats", "goblet squat"],
     "Thighs, glutes and core",
     ["Stand with feet a little wider than your hips, toes slightly out.", "Hold a support, or hold one dumbbell at your chest.",
      "Keep your chest up."],
     ["Sit your hips back and down like you are sitting in a chair.", "Go as low as is comfortable with your heels flat.", "Push through your heels to stand."],
     ["Knees caving inward.", "Heels lifting off the floor.", "Rounding your back."],
     "Holding onto a sturdy rail is perfectly fine while you learn."),
    ("lunge", "Lunge", "Legs & Core", "sets", 3, "8-10", 60,
     ["lunges", "walking lunge", "reverse lunge"], "Thighs and glutes",
     ["Stand tall with your feet together.", "Hold a wall or rail if your balance needs help."],
     ["Step one foot back and lower until both knees are bent about 90 degrees.", "Push through your front foot to stand.", "Switch legs."],
     ["Front knee drifting past your toes by a lot.", "Leaning forward.", "Taking a step that is too short."],
     "Count 8-10 on each leg."),
    ("pushup", "Push-Up", "Chest & Arms", "sets", 3, "6-10", 60,
     ["push up", "pushups", "push-ups", "incline push-up", "wall push-up"], "Chest, shoulders, arms, core",
     ["Hands on a wall, counter or bench for an easier version; on the floor for harder.",
      "Hands slightly wider than your shoulders, body in one straight line."],
     ["Bend your elbows to lower your chest toward your hands.", "Push back up until your arms are straight."],
     ["Sagging hips.", "Flaring your elbows straight out to the sides.", "Dropping only your head."],
     "The higher your hands, the easier it gets. Lower them over the weeks."),
    ("plank", "Plank", "Core", "timed", 0, "", 30,
     ["forearm plank", "plank hold"], "Core, shoulders",
     ["Rest on your forearms with elbows under your shoulders.", "Legs straight behind you, toes or knees on the floor."],
     ["Squeeze your stomach and glutes so your body is in a straight line.", "Breathe steadily and hold."],
     ["Hips sagging or piking up.", "Holding your breath."], "Start with 20 seconds. Stop when your form slips."),
    ("treadmill", "Treadmill Walk", "Cardio", "timed", 0, "", 480,
     ["treadmill warm-up", "treadmill", "treadmill walk", "treadmill warm up"], "Legs and heart",
     ["Stand on the side rails, start the belt slowly, then step on.", "Clip the safety cord to your clothes if there is one."],
     ["Walk at a brisk pace where you can still talk in full sentences.", "Swing your arms naturally and look ahead."],
     ["Holding the rails the whole time.", "Starting at a speed that is too fast."],
     "A little incline adds challenge without more speed."),
    ("elliptical", "Elliptical", "Cardio", "timed", 0, "", 720,
     ["elliptical finisher", "elliptical machine"], "Legs, arms and heart",
     ["Step on one pedal at a time and hold the handles.", "Pick a low resistance to begin."],
     ["Move in a smooth oval motion with your whole foot flat.", "Keep a steady pace where you can still talk."],
     ["Leaning heavily on the handles.", "Going so fast the motion gets jerky."],
     "Try going backward for a minute to change the muscles used."),
    ("bike", "Stationary Bike", "Cardio", "timed", 0, "", 600,
     ["bike", "exercise bike", "recumbent bike", "spin bike"], "Legs and heart",
     ["Set the seat so your knee is slightly bent at the bottom of the pedal.", "Start with easy resistance."],
     ["Pedal in smooth circles.", "Keep a pace where you can still talk."],
     ["Seat too low (knees get sore).", "Bouncing on the seat."], "If your knees hurt, raise the seat a notch."),
    ("rowing", "Rowing Machine", "Cardio", "timed", 0, "", 600,
     ["rower", "row machine cardio"], "Whole body",
     ["Strap your feet in snugly.", "Grab the handle with arms straight and knees bent."],
     ["Push with your legs first, then lean back slightly, then pull the handle to your belly.", "Return in reverse: arms, body, legs."],
     ["Pulling with your arms first.", "Hunching your back."], "Legs, body, arms. Then arms, body, legs."),
    ("db-row", "One-Arm Dumbbell Row", "Mid Back", "sets", 3, "10-12", 60,
     ["dumbbell row", "one arm row"], "Back and biceps",
     ["Put one hand and the same-side knee on a bench.", "Hold a light dumbbell in the other hand, arm hanging straight."],
     ["Pull the dumbbell toward your hip.", "Pause, then lower slowly. Finish all reps, then switch sides."],
     ["Twisting your body.", "Pulling the weight up to your chest instead of your hip."], "Keep your back flat like a tabletop."),
    ("glute-bridge", "Glute Bridge", "Legs & Core", "sets", 3, "12-15", 45,
     ["bridge", "hip bridge"], "Glutes and hamstrings",
     ["Lie on your back with knees bent and feet flat, hip-width apart."],
     ["Push through your heels to lift your hips until your body is a straight line from shoulders to knees.", "Squeeze, then lower slowly."],
     ["Arching your lower back at the top.", "Pushing up through your toes."], "Squeeze like you are holding a coin between your cheeks."),
    ("calf-raise", "Calf Raise", "Lower Body", "sets", 3, "12-15", 45,
     ["calf raises", "standing calf raise"], "Calves",
     ["Stand holding a wall or rail with feet hip-width apart."],
     ["Rise onto the balls of your feet.", "Pause for a second, then lower slowly."], ["Bouncing quickly.", "Rolling your ankles out."],
     "Slow and steady works best."),
    ("rdl", "Dumbbell Romanian Deadlift", "Lower Body", "sets", 3, "10-12", 75,
     ["deadlift", "romanian deadlift", "rdl"], "Back of thighs, glutes, lower back",
     ["Stand holding a light dumbbell in each hand in front of your thighs.", "Soft bend in your knees."],
     ["Push your hips straight back while the weights slide down your legs.", "Stop when you feel a stretch in the back of your thighs.", "Squeeze your glutes to stand tall."],
     ["Rounding your back.", "Squatting down instead of pushing the hips back."], "Keep the weights close, like you are zipping up a tight jacket."),
    ("db-bench", "Dumbbell Bench Press", "Chest & Arms", "sets", 3, "10-12", 75,
     ["dumbbell press", "bench press", "dumbbell chest press"], "Chest, shoulders, back of arms",
     ["Lie on a bench with feet flat on the floor.", "Hold the dumbbells at chest level with palms forward."],
     ["Press the weights up until your arms are straight above your chest.", "Lower slowly until your elbows are just below the bench."],
     ["Letting the weights wobble out.", "Lifting your hips off the bench."], "Ask someone to hand you the weights if they are heavy."),
    ("lateral-raise", "Lateral Raise", "Shoulders", "sets", 3, "12-15", 45,
     ["side raise", "dumbbell lateral raise"], "Sides of shoulders",
     ["Stand holding very light dumbbells at your sides."],
     ["Lift your arms out to the sides to shoulder height.", "Lower slowly."], ["Swinging the weights.", "Lifting above shoulder height."],
     "Light is right for this one."),
    ("crunch", "Crunch", "Core", "sets", 3, "12-15", 45,
     ["crunches", "ab crunch", "sit-up"], "Stomach",
     ["Lie on your back with knees bent and feet flat.", "Cross your arms over your chest."],
     ["Curl your shoulders off the floor by squeezing your stomach.", "Lower slowly."], ["Pulling on your neck.", "Using momentum."],
     "Look at the ceiling and keep a fist-size gap under your chin."),
    ("pec-fly", "Pec Fly Machine", "Chest & Arms", "sets", 3, "12-15", 60,
     ["chest fly", "pec deck", "butterfly machine"], "Chest",
     ["Adjust the seat so the handles are at chest height.", "Sit tall with your back on the pad."],
     ["Bring the handles together in front of you with elbows slightly bent.", "Open slowly until you feel a light stretch."],
     ["Going too heavy.", "Letting your shoulders roll forward."], "Imagine hugging a big tree."),
    ("stretch", "Cool Down & Stretch", "Recovery", "timed", 0, "", 240,
     ["cool down", "cooldown", "stretching", "cool down & stretch"], "Whole body",
     ["Slow your pace to an easy walk for a minute or two.", "Find a clear spot to stand or sit."],
     ["Hold each stretch 20-30 seconds: chest, back of thighs, front of thighs, calves.", "Breathe slowly. Stretch to a gentle pull, never pain."],
     ["Bouncing in a stretch.", "Holding your breath."], "This is the time to let your heart rate settle."),
]


def card(row, full=True):
    d = {"slug": row[0], "name": row[1], "category": row[2], "kind": row[3], "sets_total": row[4],
         "reps": row[5], "seconds": row[6], "muscles": row[8]}
    if full:
        d.update({"setup": row[9], "how": row[10], "mistakes": row[11], "tip": row[12]})
    return d


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def find_by_name(name):
    n = norm(name)
    if not n:
        return None
    for row in G:
        if n == norm(row[1]) or n in [norm(a) for a in row[7]]:
            return row
    for row in G:  # looser: one name contains the other
        names = [norm(row[1])] + [norm(a) for a in row[7]]
        if any(len(x) > 4 and (x in n or n in x) for x in names):
            return row
    return None


def register(app, h):
    db, rows, one, err, body, num, text = h.db, h.rows, h.one, h.err, h.body, h.num, h.text
    login_required = h.login_required
    photo_dir = os.path.join(h.data_dir, "photos")

    # =================== exercise cards ===================
    @app.get("/api/exercise-guide")
    @login_required()
    def api_guide():
        """The whole library, or ?name=... for the card that matches an exercise."""
        name = request.args.get("name")
        if name:
            row = find_by_name(name)
            return jsonify({"card": card(row) if row else None})
        return jsonify({"cards": [card(r, full=False) for r in G]})

    @app.get("/api/exercise-guide/<slug>")
    @login_required()
    def api_guide_card(slug):
        for row in G:
            if row[0] == slug:
                return jsonify({"card": card(row)})
        return err("Not found.", 404)

    # =================== progress photos (private) ===================
    MAX_PHOTOS = 300

    @app.before_request
    def small_json_only():
        # Only photo uploads may be big; everything else stays small.
        if request.path.startswith("/api/") and request.path != "/api/photos" \
                and (request.content_length or 0) > 1024 * 1024:
            return err("That request is too large.", 413)

    def paths(pid, uid):
        base = os.path.join(photo_dir, str(uid))
        return os.path.join(base, "%d.jpg" % pid), os.path.join(base, "%d_t.jpg" % pid)

    @app.post("/api/photos")
    @login_required()
    def api_photo_upload():
        """Upload a progress photo (multipart field 'photo'). Stored privately, location data removed."""
        from PIL import Image, ImageOps
        uid = g.user["id"]
        f = request.files.get("photo")
        if not f:
            return err("Choose a photo first.")
        if one("SELECT COUNT(*) AS c FROM photos WHERE user_id=?", (uid,))["c"] >= MAX_PHOTOS:
            return err("You have reached the photo limit. Delete a few old ones first.")
        try:
            img = Image.open(f.stream)
            img.verify()
            f.stream.seek(0)
            img = Image.open(f.stream)
            img = ImageOps.exif_transpose(img).convert("RGB")
        except Exception:
            return err("That file does not look like a photo.")
        pid = db().execute("INSERT INTO photos(user_id,date,note,created_at) VALUES(?,?,?,?)",
                           (uid, h.valid_date(request.form.get("date")), text(request.form.get("note"), 80), h.now())).lastrowid
        full_p, thumb_p = paths(pid, uid)
        os.makedirs(os.path.dirname(full_p), exist_ok=True)
        big = img.copy()
        big.thumbnail((1280, 1280))
        big.save(full_p, "JPEG", quality=85)       # re-saving drops EXIF/GPS data
        small = img.copy()
        small.thumbnail((320, 320))
        small.save(thumb_p, "JPEG", quality=80)
        db().commit()
        return jsonify({"ok": True, "id": pid})

    @app.get("/api/photos")
    @login_required()
    def api_photos():
        return jsonify({"photos": rows("SELECT id, date, note FROM photos WHERE user_id=? ORDER BY date DESC, id DESC",
                                       (g.user["id"],))})

    @app.get("/api/photos/<int:pid>/image")
    @login_required()
    def api_photo_image(pid):
        """Only the owner can see a photo. Admins cannot, and friends cannot."""
        p = one("SELECT * FROM photos WHERE id=? AND user_id=?", (pid, g.user["id"]))
        if not p:
            return err("Not found.", 404)
        full_p, thumb_p = paths(pid, g.user["id"])
        path = thumb_p if request.args.get("size") == "thumb" else full_p
        if not os.path.exists(path):
            return err("Not found.", 404)
        resp = send_file(path, mimetype="image/jpeg")
        resp.headers["Cache-Control"] = "private, max-age=86400"
        return resp

    @app.delete("/api/photos/<int:pid>")
    @login_required()
    def api_photo_delete(pid):
        p = one("SELECT id FROM photos WHERE id=? AND user_id=?", (pid, g.user["id"]))
        if p:
            for path in paths(pid, g.user["id"]):
                if os.path.exists(path):
                    os.unlink(path)
            db().execute("DELETE FROM photos WHERE id=?", (pid,))
            db().commit()
        return api_photos()

    h.features.extend(["exercise_guide", "photos"])
