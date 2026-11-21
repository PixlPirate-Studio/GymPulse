#!/usr/bin/env python3
"""
GymPulse - a self-hosted workout, food and friends tracker.

One file, one database (SQLite), no outside services needed to run.
Everything it saves lives in the data folder (default /config, which you
map to /mnt/user/appdata/gympulse on Unraid).
"""

import base64
import datetime as dt
import json
import math
import os
import re
import secrets
import shutil
import sqlite3
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from functools import wraps

from flask import (Flask, g, jsonify, request, send_file, send_from_directory,
                   session)
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

APP_VERSION = "1.0.0"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MEALS = ("breakfast", "lunch", "dinner", "snacks")
ACTIVITY = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "very": 1.725,
}

DEFAULT_ROUTINE = [
    ("Treadmill Warm-Up", "Warm-Up", "8:00 brisk walk to warm up your joints", "timed", 0, 480),
    ("Seated Leg Press Machine", "Lower Body", "3 sets of 10-12 reps. Rest 1:15 between sets", "sets", 3, 75),
    ("Lat Pulldown Machine", "Upper Back", "3 sets of 10-12 reps. Pull the bar to your upper chest", "sets", 3, 75),
    ("Chest Press Machine", "Chest & Arms", "3 sets of 10-12 reps. Handles at mid-chest height", "sets", 3, 75),
    ("Seated Cable Row", "Mid Back", "3 sets of 10-12 reps. Squeeze your shoulder blades", "sets", 3, 75),
    ("Bodyweight or Assisted Squats", "Legs & Core", "3 sets of 8-10 reps. Hold a support if you need it", "sets", 3, 75),
    ("Elliptical Finisher", "Cardio", "12:00 at a steady, comfortable pace", "timed", 0, 720),
    ("Cool Down & Stretch", "Recovery", "4:00 slow walk, then gentle chest, back and leg stretches", "timed", 0, 240),
]

# Starter foods (approximate, typical values). Import the USDA files with
# import_usda.py for thousands more.  (name, serving, cal, protein, carbs, fat)
STARTER_FOODS = [
    ("Banana", "1 medium (118 g)", 105, 1.3, 27, 0.4),
    ("Apple", "1 medium (182 g)", 95, 0.5, 25, 0.3),
    ("Orange", "1 medium (131 g)", 62, 1.2, 15.4, 0.2),
    ("Strawberries", "1 cup (152 g)", 49, 1, 11.7, 0.5),
    ("Blueberries", "1 cup (148 g)", 84, 1.1, 21.4, 0.5),
    ("Egg, whole", "1 large (50 g)", 72, 6.3, 0.4, 4.8),
    ("Oatmeal, cooked", "1 cup (234 g)", 166, 5.9, 28, 3.6),
    ("Whole wheat bread", "1 slice (28 g)", 70, 3.6, 12, 1),
    ("Chicken breast, roasted", "6 oz (170 g)", 280, 52, 0, 6),
    ("Chicken breast, raw", "6 oz (170 g)", 190, 36, 0, 4),
    ("Ground beef 90% lean, cooked", "3 oz (85 g)", 184, 22, 0, 10),
    ("Salmon, baked", "3 oz (85 g)", 175, 19, 0, 10),
    ("Tuna, canned in water", "3 oz (85 g)", 100, 22, 0, 1),
    ("White rice, cooked", "1 cup (158 g)", 205, 4.2, 45, 0.4),
    ("Brown rice, cooked", "1 cup (195 g)", 216, 5, 45, 1.8),
    ("Pasta, cooked", "1 cup (140 g)", 220, 8, 43, 1.3),
    ("Sweet potato, baked", "1 medium (114 g)", 103, 2.3, 24, 0.2),
    ("Potato, baked with skin", "1 medium (173 g)", 161, 4.3, 36.6, 0.2),
    ("Broccoli, cooked", "1 cup (156 g)", 55, 3.7, 11, 0.6),
    ("Spinach, raw", "1 cup (30 g)", 7, 0.9, 1.1, 0.1),
    ("Romaine lettuce", "1 cup shredded (47 g)", 8, 0.6, 1.5, 0.1),
    ("Carrot, raw", "1 medium (61 g)", 25, 0.6, 5.8, 0.1),
    ("Tomato", "1 medium (123 g)", 22, 1.1, 4.8, 0.2),
    ("Bell pepper", "1 medium (119 g)", 31, 1, 7.2, 0.3),
    ("Avocado", "1/2 fruit (100 g)", 160, 2, 9, 15),
    ("Black beans, cooked", "1/2 cup (86 g)", 114, 7.6, 20.4, 0.5),
    ("Greek yogurt, plain nonfat", "1 cup (245 g)", 145, 25, 9, 1),
    ("Milk, 2%", "1 cup (244 g)", 122, 8.1, 11.7, 4.8),
    ("Milk, skim", "1 cup (245 g)", 83, 8.3, 12.2, 0.2),
    ("Cheddar cheese", "1 oz (28 g)", 113, 7, 0.4, 9.3),
    ("Almonds", "1 oz (28 g)", 164, 6, 6, 14),
    ("Peanut butter", "2 tbsp (32 g)", 190, 7, 7, 16),
    ("Olive oil", "1 tbsp (13.5 g)", 119, 0, 0, 13.5),
    ("Butter", "1 tbsp (14 g)", 102, 0.1, 0, 11.5),
    ("Orange juice", "1 cup (248 g)", 112, 1.7, 26, 0.5),
    ("Soda (cola)", "12 oz can", 140, 0, 39, 0),
    ("Coffee, black", "1 cup (237 g)", 2, 0.3, 0, 0),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER, sex TEXT, height_in REAL, goal_weight_lb REAL,
  activity TEXT DEFAULT 'light',
  workouts_per_week INTEGER DEFAULT 3,
  nudge INTEGER DEFAULT 1,
  auto_rest INTEGER DEFAULT 1,
  apple_timer INTEGER DEFAULT 0,
  shortcut_name TEXT DEFAULT 'GymPulse Timer'
);
CREATE TABLE IF NOT EXISTS weights(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, weight_lb REAL NOT NULL,
  UNIQUE(user_id, date)
);
CREATE TABLE IF NOT EXISTS routine(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL, category TEXT DEFAULT '', note TEXT DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'sets',
  sets_total INTEGER NOT NULL DEFAULT 3,
  seconds INTEGER NOT NULL DEFAULT 75
);
CREATE TABLE IF NOT EXISTS sessions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, started_at INTEGER NOT NULL,
  ended_at INTEGER, duration_sec INTEGER DEFAULT 0,
  strength INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS session_exercises(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  routine_id INTEGER, name TEXT NOT NULL,
  kind TEXT NOT NULL, sets_total INTEGER NOT NULL DEFAULT 0,
  sets_done INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS friendships(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  UNIQUE(requester_id, addressee_id)
);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, text TEXT NOT NULL, ref_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cheers(
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(event_id, user_id)
);
CREATE TABLE IF NOT EXISTS foods(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, brand TEXT DEFAULT '', serving TEXT NOT NULL DEFAULT '1 serving',
  calories REAL NOT NULL, protein REAL DEFAULT 0, carbs REAL DEFAULT 0, fat REAL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'custom', barcode TEXT
);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);
CREATE TABLE IF NOT EXISTS diary(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, meal TEXT NOT NULL,
  food_id INTEGER, name TEXT NOT NULL, serving TEXT DEFAULT '',
  servings REAL NOT NULL DEFAULT 1,
  calories REAL NOT NULL, protein REAL DEFAULT 0, carbs REAL DEFAULT 0, fat REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary(user_id, date);
CREATE TABLE IF NOT EXISTS recipes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, servings INTEGER NOT NULL DEFAULT 1,
  minutes INTEGER DEFAULT 0, ingredients TEXT DEFAULT '', steps TEXT DEFAULT '',
  calories REAL DEFAULT 0, protein REAL DEFAULT 0, carbs REAL DEFAULT 0, fat REAL DEFAULT 0,
  shared INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS recipe_cheers(
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(recipe_id, user_id)
);
CREATE TABLE IF NOT EXISTS recipe_tips(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE, sub_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  nudges_left INTEGER NOT NULL DEFAULT 0
);
"""


def now():
    return int(time.time())


def create_app():
    data_dir = os.environ.get("GYMPULSE_DATA", "/config")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "gympulse.db")

    app = Flask(__name__, static_folder=None)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("GYMPULSE_SECURE_COOKIES", "0") == "1"
    app.config["PERMANENT_SESSION_LIFETIME"] = dt.timedelta(days=90)

    # ---- secret key (kept in the data folder so logins survive restarts) ----
    key_path = os.path.join(data_dir, "secret_key")
    if not os.path.exists(key_path):
        with open(key_path, "w") as fh:
            fh.write(secrets.token_hex(32))
        os.chmod(key_path, 0o600)
    with open(key_path) as fh:
        app.secret_key = fh.read().strip()

    # ---- database helpers ----
    def connect():
        conn = sqlite3.connect(db_path, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    with connect() as boot:
        boot.executescript(SCHEMA)
        if boot.execute("SELECT COUNT(*) FROM foods WHERE owner_id IS NULL").fetchone()[0] == 0:
            boot.executemany(
                "INSERT INTO foods(owner_id,name,serving,calories,protein,carbs,fat,source) "
                "VALUES(NULL,?,?,?,?,?,?, 'starter')", STARTER_FOODS)
        boot.commit()

    def db():
        if "db" not in g:
            g.db = connect()
        return g.db

    @app.teardown_appcontext
    def close_db(_exc):
        conn = g.pop("db", None)
        if conn is not None:
            conn.close()

    def rows(sql, args=()):
        return [dict(r) for r in db().execute(sql, args).fetchall()]

    def one(sql, args=()):
        r = db().execute(sql, args).fetchone()
        return dict(r) if r else None

    def err(message, code=400):
        return jsonify({"error": message}), code

    # ---- VAPID keys for push alerts ----
    vapid = {"path": None, "public": None}
    try:
        from py_vapid import Vapid
        from cryptography.hazmat.primitives import serialization
        vpath = os.path.join(data_dir, "vapid_private.pem")
        if os.path.exists(vpath):
            v = Vapid.from_file(vpath)
        else:
            v = Vapid()
            v.generate_keys()
            v.save_key(vpath)
            os.chmod(vpath, 0o600)
        raw = v.public_key.public_bytes(serialization.Encoding.X962,
                                        serialization.PublicFormat.UncompressedPoint)
        vapid["path"] = vpath
        vapid["public"] = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    except Exception as exc:  # push is optional; the app still works without it
        print("Push alerts unavailable:", exc)

    # ---- request guards ----
    @app.before_request
    def csrf_guard():
        if request.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
            if request.headers.get("X-GymPulse") != "1":
                return err("Blocked request.", 403)

    def login_required(admin=False):
        def deco(fn):
            @wraps(fn)
            def wrapper(*a, **k):
                uid = session.get("uid")
                if not uid:
                    return err("Please sign in.", 401)
                u = one("SELECT * FROM users WHERE id=? AND disabled=0", (uid,))
                if not u:
                    session.clear()
                    return err("Please sign in.", 401)
                g.user = u
                if admin and u["role"] != "admin":
                    return err("Admins only.", 403)
                return fn(*a, **k)
            return wrapper
        return deco

    # ---- small validators ----
    def body():
        return request.get_json(silent=True) or {}

    def num(v, lo, hi, default=None):
        try:
            x = float(v)
        except (TypeError, ValueError):
            return default
        if math.isnan(x) or x < lo or x > hi:
            return default
        return x

    def text(v, maxlen):
        return (v or "").strip()[:maxlen] if isinstance(v, str) else ""

    def valid_date(s, default=None):
        try:
            dt.datetime.strptime(s, "%Y-%m-%d")
            return s
        except (TypeError, ValueError):
            return default or dt.date.today().isoformat()

    USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,24}$")

    def public_user(u):
        return {"id": u["id"], "username": u["username"], "role": u["role"]}

    def make_user(username, password, role):
        if not USERNAME_RE.match(username or ""):
            return None, "Usernames are 3-24 letters, numbers, dots, dashes or underscores."
        if len(password or "") < 8:
            return None, "Passwords need at least 8 characters."
        if one("SELECT id FROM users WHERE username=?", (username,)):
            return None, "That username is taken."
        cur = db().execute("INSERT INTO users(username,pw_hash,role,created_at) VALUES(?,?,?,?)",
                           (username, generate_password_hash(password), role, now()))
        uid = cur.lastrowid
        db().execute("INSERT INTO profiles(user_id) VALUES(?)", (uid,))
        load_default_routine(uid)
        db().commit()
        return uid, None

    def load_default_routine(uid):
        db().execute("DELETE FROM routine WHERE user_id=?", (uid,))
        for pos, (name, cat, note, kind, sets, secs) in enumerate(DEFAULT_ROUTINE):
            db().execute(
                "INSERT INTO routine(user_id,position,name,category,note,kind,sets_total,seconds) "
                "VALUES(?,?,?,?,?,?,?,?)", (uid, pos, name, cat, note, kind, sets, secs))

    # ---- login rate limit (in memory) ----
    attempts = {}

    def too_many(key):
        cutoff = time.time() - 900
        attempts[key] = [t for t in attempts.get(key, []) if t > cutoff]
        return len(attempts[key]) >= 8

    # =====================================================================
    # Pages and files
    # =====================================================================
    static_dir = os.path.join(BASE_DIR, "static")

    @app.get("/")
    def index():
        resp = send_from_directory(static_dir, "index.html")
        resp.headers["Cache-Control"] = "no-cache"
        return resp

    @app.get("/sw.js")
    def service_worker():
        resp = send_from_directory(static_dir, "sw.js")
        resp.headers["Cache-Control"] = "no-cache"
        resp.headers["Service-Worker-Allowed"] = "/"
        return resp

    @app.get("/static/<path:name>")
    def static_files(name):
        resp = send_from_directory(static_dir, name)
        resp.headers["Cache-Control"] = "no-cache"
        return resp

    @app.get("/manifest.webmanifest")
    def manifest():
        return send_from_directory(static_dir, "manifest.webmanifest",
                                   mimetype="application/manifest+json")

    @app.get("/healthz")
    def healthz():
        return jsonify({"ok": True, "version": APP_VERSION})

    # =====================================================================
    # Sign in / accounts
    # =====================================================================
    @app.get("/api/me")
    def api_me():
        count = one("SELECT COUNT(*) AS c FROM users")["c"]
        uid = session.get("uid")
        u = one("SELECT * FROM users WHERE id=? AND disabled=0", (uid,)) if uid else None
        return jsonify({"user": public_user(u) if u else None,
                        "needs_setup": count == 0, "version": APP_VERSION})

    @app.post("/api/setup")
    def api_setup():
        if one("SELECT COUNT(*) AS c FROM users")["c"] > 0:
            return err("Setup is already done.", 403)
        b = body()
        uid, problem = make_user(text(b.get("username"), 24), b.get("password") or "", "admin")
        if problem:
            return err(problem)
        session.clear()
        session["uid"] = uid
        session.permanent = True
        return jsonify({"ok": True})

    @app.post("/api/login")
    def api_login():
        b = body()
        username = text(b.get("username"), 24)
        key = (request.remote_addr or "") + "|" + username.lower()
        if too_many(key):
            return err("Too many tries. Please wait 15 minutes and try again.", 429)
        u = one("SELECT * FROM users WHERE username=?", (username,))
        if not u or u["disabled"] or not check_password_hash(u["pw_hash"], b.get("password") or ""):
            attempts.setdefault(key, []).append(time.time())
            return err("That username or password is not right.", 401)
        attempts.pop(key, None)
        session.clear()
        session["uid"] = u["id"]
        session.permanent = True
        return jsonify({"ok": True})

    @app.post("/api/logout")
    def api_logout():
        session.clear()
        return jsonify({"ok": True})

    @app.post("/api/password")
    @login_required()
    def api_password():
        b = body()
        if not check_password_hash(g.user["pw_hash"], b.get("current") or ""):
            return err("Your current password is not right.", 403)
        if len(b.get("new") or "") < 8:
            return err("Passwords need at least 8 characters.")
        db().execute("UPDATE users SET pw_hash=? WHERE id=?",
                     (generate_password_hash(b["new"]), g.user["id"]))
        db().commit()
        return jsonify({"ok": True})

    # =====================================================================
    # Body, profile and numbers
    # =====================================================================
    def latest_weight(uid):
        r = one("SELECT weight_lb FROM weights WHERE user_id=? ORDER BY date DESC LIMIT 1", (uid,))
        return r["weight_lb"] if r else None

    def body_stats(uid):
        p = one("SELECT * FROM profiles WHERE user_id=?", (uid,)) or {}
        w = latest_weight(uid)
        h = p.get("height_in")
        out = {"weight_lb": w, "bmi": None, "healthy_min": None, "healthy_max": None,
               "stay_cal": None, "goal_cal": None, "personalized": False,
               "lbs_to_goal": None, "weeks_to_goal": None}
        if h:
            out["healthy_min"] = round(18.5 * h * h / 703, 1)
            out["healthy_max"] = round(24.9 * h * h / 703, 1)
        if h and w:
            out["bmi"] = round(w * 703 / (h * h), 1)
        if h and w and p.get("age") and p.get("sex") in ("male", "female"):
            kg, cm = w * 0.45359237, h * 2.54
            bmr = 10 * kg + 6.25 * cm - 5 * p["age"] + (5 if p["sex"] == "male" else -161)
            stay = bmr * ACTIVITY.get(p.get("activity") or "light", 1.375)
            out["stay_cal"] = int(round(stay))
            goal = p.get("goal_weight_lb")
            if goal and goal < w - 1:
                cal = stay - 500
            elif goal and goal > w + 1:
                cal = stay + 300
            else:
                cal = stay
            floor = 1500 if p["sex"] == "male" else 1200
            out["goal_cal"] = int(round(max(cal, floor)))
            out["personalized"] = True
        goal = p.get("goal_weight_lb")
        if goal and w:
            out["lbs_to_goal"] = round(abs(w - goal), 1)
            out["weeks_to_goal"] = int(math.ceil(abs(w - goal) / 1.0)) if abs(w - goal) >= 1 else 0
        return out

    @app.get("/api/profile")
    @login_required()
    def api_profile_get():
        p = one("SELECT * FROM profiles WHERE user_id=?", (g.user["id"],))
        return jsonify({"profile": p, "stats": body_stats(g.user["id"]), "user": public_user(g.user)})

    @app.put("/api/profile")
    @login_required()
    def api_profile_put():
        b, uid = body(), g.user["id"]
        cur = one("SELECT * FROM profiles WHERE user_id=?", (uid,))
        age = num(b.get("age"), 13, 110, cur["age"]) if "age" in b else cur["age"]
        sex = b.get("sex") if b.get("sex") in ("male", "female") else cur["sex"]
        height = num(b.get("height_in"), 36, 96, cur["height_in"]) if "height_in" in b else cur["height_in"]
        goal = num(b.get("goal_weight_lb"), 70, 500, cur["goal_weight_lb"]) if "goal_weight_lb" in b else cur["goal_weight_lb"]
        act = b.get("activity") if b.get("activity") in ACTIVITY else cur["activity"]
        wpw = int(num(b.get("workouts_per_week"), 1, 7, cur["workouts_per_week"] or 3))
        nudge = int(bool(b["nudge"])) if "nudge" in b else cur["nudge"]
        auto = int(bool(b["auto_rest"])) if "auto_rest" in b else cur["auto_rest"]
        apple = int(bool(b["apple_timer"])) if "apple_timer" in b else cur["apple_timer"]
        sc = text(b.get("shortcut_name"), 60) or cur["shortcut_name"] if "shortcut_name" in b else cur["shortcut_name"]
        age = int(age) if age else None
        db().execute(
            "UPDATE profiles SET age=?,sex=?,height_in=?,goal_weight_lb=?,activity=?,"
            "workouts_per_week=?,nudge=?,auto_rest=?,apple_timer=?,shortcut_name=? WHERE user_id=?",
            (age, sex, height, goal, act, wpw, nudge, auto, apple, sc, uid))
        db().commit()
        return api_profile_get()

    @app.post("/api/weight")
    @login_required()
    def api_weight_post():
        b = body()
        w = num(b.get("weight_lb"), 50, 700)
        if w is None:
            return err("Please enter a weight between 50 and 700 lb.")
        d = valid_date(b.get("date"))
        db().execute(
            "INSERT INTO weights(user_id,date,weight_lb) VALUES(?,?,?) "
            "ON CONFLICT(user_id,date) DO UPDATE SET weight_lb=excluded.weight_lb",
            (g.user["id"], d, round(w, 1)))
        db().commit()
        return jsonify({"ok": True, "stats": body_stats(g.user["id"])})

    @app.get("/api/weights")
    @login_required()
    def api_weights():
        return jsonify({"weights": rows(
            "SELECT date, weight_lb FROM weights WHERE user_id=? ORDER BY date ASC LIMIT 800",
            (g.user["id"],))})

    # =====================================================================
    # Routine (your list of exercises)
    # =====================================================================
    def clean_exercise(b, cur=None):
        cur = cur or {}
        name = text(b.get("name"), 80) or cur.get("name")
        if not name:
            return None, "Please give the exercise a name."
        kind = b.get("kind") if b.get("kind") in ("sets", "timed") else cur.get("kind", "sets")
        sets = int(num(b.get("sets_total"), 0, 10, cur.get("sets_total", 3)))
        if kind == "timed":
            sets = 0
        elif sets < 1:
            sets = 3
        secs = int(num(b.get("seconds"), 5, 7200, cur.get("seconds", 75)))
        return {"name": name, "category": text(b.get("category"), 40) if "category" in b else cur.get("category", ""),
                "note": text(b.get("note"), 200) if "note" in b else cur.get("note", ""),
                "kind": kind, "sets_total": sets, "seconds": secs}, None

    @app.get("/api/routine")
    @login_required()
    def api_routine_get():
        return jsonify({"routine": rows(
            "SELECT * FROM routine WHERE user_id=? ORDER BY position, id", (g.user["id"],))})

    @app.post("/api/routine")
    @login_required()
    def api_routine_add():
        ex, problem = clean_exercise(body())
        if problem:
            return err(problem)
        pos = one("SELECT COALESCE(MAX(position),-1)+1 AS p FROM routine WHERE user_id=?", (g.user["id"],))["p"]
        db().execute(
            "INSERT INTO routine(user_id,position,name,category,note,kind,sets_total,seconds) VALUES(?,?,?,?,?,?,?,?)",
            (g.user["id"], pos, ex["name"], ex["category"] or "Custom", ex["note"], ex["kind"], ex["sets_total"], ex["seconds"]))
        db().commit()
        return api_routine_get()

    @app.put("/api/routine/<int:rid>")
    @login_required()
    def api_routine_edit(rid):
        cur = one("SELECT * FROM routine WHERE id=? AND user_id=?", (rid, g.user["id"]))
        if not cur:
            return err("Not found.", 404)
        ex, problem = clean_exercise(body(), cur)
        if problem:
            return err(problem)
        db().execute("UPDATE routine SET name=?,category=?,note=?,kind=?,sets_total=?,seconds=? WHERE id=?",
                     (ex["name"], ex["category"], ex["note"], ex["kind"], ex["sets_total"], ex["seconds"], rid))
        db().commit()
        return api_routine_get()

    @app.delete("/api/routine/<int:rid>")
    @login_required()
    def api_routine_delete(rid):
        db().execute("DELETE FROM routine WHERE id=? AND user_id=?", (rid, g.user["id"]))
        db().commit()
        return api_routine_get()

    @app.post("/api/routine/<int:rid>/move")
    @login_required()
    def api_routine_move(rid):
        direction = -1 if body().get("direction") == "up" else 1
        items = rows("SELECT id FROM routine WHERE user_id=? ORDER BY position, id", (g.user["id"],))
        ids = [r["id"] for r in items]
        if rid in ids:
            i = ids.index(rid)
            j = i + direction
            if 0 <= j < len(ids):
                ids[i], ids[j] = ids[j], ids[i]
                for pos, x in enumerate(ids):
                    db().execute("UPDATE routine SET position=? WHERE id=?", (pos, x))
                db().commit()
        return api_routine_get()

    @app.post("/api/routine/template")
    @login_required()
    def api_routine_template():
        load_default_routine(g.user["id"])
        db().commit()
        return api_routine_get()

    # =====================================================================
    # Workout sessions
    # =====================================================================
    def session_payload(s):
        exs = rows("SELECT * FROM session_exercises WHERE session_id=? ORDER BY id", (s["id"],))
        return {"session": s, "exercises": exs}

    @app.get("/api/session/active")
    @login_required()
    def api_session_active():
        s = one("SELECT * FROM sessions WHERE user_id=? AND ended_at IS NULL ORDER BY id DESC LIMIT 1",
                (g.user["id"],))
        if s and now() - s["started_at"] > 12 * 3600:  # forgotten session: close it quietly
            db().execute("UPDATE sessions SET ended_at=started_at+duration_sec WHERE id=?", (s["id"],))
            db().commit()
            s = None
        return jsonify(session_payload(s) if s else {"session": None, "exercises": []})

    @app.post("/api/session/start")
    @login_required()
    def api_session_start():
        existing = one("SELECT * FROM sessions WHERE user_id=? AND ended_at IS NULL ORDER BY id DESC LIMIT 1",
                       (g.user["id"],))
        if existing and now() - existing["started_at"] <= 12 * 3600:
            return jsonify(session_payload(existing))
        cur = db().execute("INSERT INTO sessions(user_id,date,started_at) VALUES(?,?,?)",
                           (g.user["id"], valid_date(body().get("date")), now()))
        sid = cur.lastrowid
        for r in rows("SELECT * FROM routine WHERE user_id=? ORDER BY position, id", (g.user["id"],)):
            db().execute(
                "INSERT INTO session_exercises(session_id,routine_id,name,kind,sets_total) VALUES(?,?,?,?,?)",
                (sid, r["id"], r["name"], r["kind"], r["sets_total"]))
        db().commit()
        return jsonify(session_payload(one("SELECT * FROM sessions WHERE id=?", (sid,))))

    @app.post("/api/session/<int:sid>/exercise/<int:seid>")
    @login_required()
    def api_session_exercise(sid, seid):
        s = one("SELECT * FROM sessions WHERE id=? AND user_id=?", (sid, g.user["id"]))
        ex = one("SELECT * FROM session_exercises WHERE id=? AND session_id=?", (seid, sid))
        if not s or not ex:
            return err("Not found.", 404)
        b = body()
        if ex["kind"] == "sets":
            done = int(num(b.get("sets_done"), 0, ex["sets_total"], ex["sets_done"]))
            completed = 1 if done >= ex["sets_total"] else 0
        else:
            done = 0
            completed = 1 if b.get("completed") else 0
        db().execute("UPDATE session_exercises SET sets_done=?, completed=? WHERE id=?", (done, completed, seid))
        db().commit()
        return jsonify(session_payload(s))

    @app.post("/api/session/<int:sid>/finish")
    @login_required()
    def api_session_finish(sid):
        s = one("SELECT * FROM sessions WHERE id=? AND user_id=?", (sid, g.user["id"]))
        if not s:
            return err("Not found.", 404)
        if s["ended_at"] is None:
            exs = rows("SELECT * FROM session_exercises WHERE session_id=?", (sid,))
            did = [e for e in exs if e["completed"] or e["sets_done"] > 0]
            strength = 1 if any(e["kind"] == "sets" and e["sets_done"] > 0 for e in exs) else 0
            ended = now()
            db().execute("UPDATE sessions SET ended_at=?, duration_sec=?, strength=? WHERE id=?",
                         (ended, ended - s["started_at"], strength, sid))
            if did:
                done_count = sum(1 for e in exs if e["completed"])
                db().execute("INSERT INTO events(user_id,type,text,ref_id,created_at) VALUES(?,?,?,?,?)",
                             (g.user["id"], "workout",
                              "finished a workout (%d of %d exercises)" % (done_count, len(exs)), sid, ended))
            db().commit()
        return jsonify({"ok": True})

    @app.delete("/api/session/<int:sid>")
    @login_required()
    def api_session_discard(sid):
        db().execute("DELETE FROM sessions WHERE id=? AND user_id=?", (sid, g.user["id"]))
        db().commit()
        return jsonify({"ok": True})

    # ---- history and progress ----
    def worked_dates(uid):
        return [r["date"] for r in rows(
            "SELECT DISTINCT s.date FROM sessions s WHERE s.user_id=? AND s.ended_at IS NOT NULL AND "
            "EXISTS(SELECT 1 FROM session_exercises e WHERE e.session_id=s.id AND (e.completed=1 OR e.sets_done>0)) "
            "ORDER BY s.date DESC", (uid,))]

    def streak_for(uid, today):
        ds = worked_dates(uid)
        if not ds:
            return 0
        t = dt.date.fromisoformat(today)
        latest = dt.date.fromisoformat(ds[0])
        if (t - latest).days > 2:
            return 0
        count, prev = 1, latest
        for d in ds[1:]:
            cur = dt.date.fromisoformat(d)
            if (prev - cur).days <= 2:
                count += 1
                prev = cur
            else:
                break
        return count

    def week_for(uid, today):
        t = dt.date.fromisoformat(today)
        monday = t - dt.timedelta(days=t.weekday())
        sunday = monday + dt.timedelta(days=6)
        ss = rows("SELECT s.* FROM sessions s WHERE s.user_id=? AND s.ended_at IS NOT NULL AND s.date BETWEEN ? AND ?",
                  (uid, monday.isoformat(), sunday.isoformat()))
        worked = set(worked_dates_in(uid, monday.isoformat(), sunday.isoformat()))
        minutes = int(round(sum(s["duration_sec"] or 0 for s in ss if s["date"] in worked) / 60.0))
        strength_days = len({s["date"] for s in ss if s["strength"] and s["date"] in worked})
        days = [(monday + dt.timedelta(days=i)).isoformat() for i in range(7)]
        return {"workouts": len(worked), "minutes": minutes, "strength_days": strength_days,
                "days": [{"date": d, "worked": d in worked} for d in days]}

    def worked_dates_in(uid, a, b):
        return [d for d in worked_dates(uid) if a <= d <= b]

    @app.get("/api/progress")
    @login_required()
    def api_progress():
        today = valid_date(request.args.get("today"))
        uid = g.user["id"]
        p = one("SELECT * FROM profiles WHERE user_id=?", (uid,))
        weights = rows("SELECT date, weight_lb FROM weights WHERE user_id=? ORDER BY date ASC", (uid,))
        total = one("SELECT COUNT(DISTINCT date) AS c FROM sessions WHERE user_id=? AND ended_at IS NOT NULL", (uid,))["c"]
        return jsonify({"streak": streak_for(uid, today), "week": week_for(uid, today),
                        "total_sessions": total, "weights": weights[-120:],
                        "goal_weight_lb": p["goal_weight_lb"], "workouts_per_week": p["workouts_per_week"],
                        "stats": body_stats(uid)})

    @app.get("/api/history")
    @login_required()
    def api_history():
        month = request.args.get("month") or dt.date.today().strftime("%Y-%m")
        if not re.match(r"^\d{4}-\d{2}$", month):
            return err("Bad month.")
        ss = rows("SELECT s.*, "
                  "(SELECT COUNT(*) FROM session_exercises e WHERE e.session_id=s.id) AS total, "
                  "(SELECT COUNT(*) FROM session_exercises e WHERE e.session_id=s.id AND e.completed=1) AS done, "
                  "(SELECT COALESCE(SUM(e.sets_done),0) FROM session_exercises e WHERE e.session_id=s.id) AS sets "
                  "FROM sessions s WHERE s.user_id=? AND s.date LIKE ? ORDER BY s.date DESC, s.id DESC",
                  (g.user["id"], month + "-%"))
        days = sorted({s["date"] for s in ss if s["ended_at"] and (s["done"] or s["sets"])})
        recent = rows("SELECT s.*, "
                      "(SELECT COUNT(*) FROM session_exercises e WHERE e.session_id=s.id) AS total, "
                      "(SELECT COUNT(*) FROM session_exercises e WHERE e.session_id=s.id AND e.completed=1) AS done, "
                      "(SELECT COALESCE(SUM(e.sets_done),0) FROM session_exercises e WHERE e.session_id=s.id) AS sets "
                      "FROM sessions s WHERE s.user_id=? AND s.ended_at IS NOT NULL ORDER BY s.date DESC, s.id DESC LIMIT 8",
                      (g.user["id"],))
        return jsonify({"month": month, "days": days, "month_sessions": len(days), "recent": recent})

    # =====================================================================
    # Food
    # =====================================================================
    def goals_for(uid):
        st = body_stats(uid)
        cal = st["goal_cal"] or 2000
        return {"calories": cal, "protein": int(round(cal * 0.25 / 4)), "carbs": int(round(cal * 0.45 / 4)),
                "fat": int(round(cal * 0.30 / 9)), "personalized": st["personalized"]}

    @app.get("/api/foods/search")
    @login_required()
    def api_food_search():
        q = text(request.args.get("q"), 60)
        scope = request.args.get("scope", "all")
        uid = g.user["id"]
        if scope == "recent":
            res = rows("SELECT f.* FROM foods f JOIN (SELECT food_id, MAX(id) AS last FROM diary "
                       "WHERE user_id=? AND food_id IS NOT NULL GROUP BY food_id ORDER BY last DESC LIMIT 25) d "
                       "ON d.food_id=f.id ORDER BY d.last DESC", (uid,))
            return jsonify({"foods": res})
        where, args = ["(f.owner_id IS NULL OR f.owner_id=?)"], [uid]
        if scope == "mine":
            where = ["f.owner_id=?"]
            args = [uid]
        for tok in q.split()[:5]:
            where.append("(f.name LIKE ? OR f.brand LIKE ?)")
            args += ["%" + tok + "%", "%" + tok + "%"]
        sql = ("SELECT f.* FROM foods f WHERE " + " AND ".join(where) +
               " ORDER BY (f.owner_id IS NULL), (f.name LIKE ?) DESC, length(f.name) LIMIT 30")
        args.append(q + "%")
        return jsonify({"foods": rows(sql, args)})

    def clean_food(b):
        name = text(b.get("name"), 90)
        cal = num(b.get("calories"), 0, 5000)
        if not name or cal is None:
            return None
        return {"name": name, "brand": text(b.get("brand"), 60), "serving": text(b.get("serving"), 60) or "1 serving",
                "calories": cal, "protein": num(b.get("protein"), 0, 500, 0), "carbs": num(b.get("carbs"), 0, 800, 0),
                "fat": num(b.get("fat"), 0, 500, 0)}

    @app.post("/api/foods")
    @login_required()
    def api_food_create():
        f = clean_food(body())
        if not f:
            return err("Please enter a name and the calories.")
        cur = db().execute(
            "INSERT INTO foods(owner_id,name,brand,serving,calories,protein,carbs,fat,source) VALUES(?,?,?,?,?,?,?,?, 'custom')",
            (g.user["id"], f["name"], f["brand"], f["serving"], f["calories"], f["protein"], f["carbs"], f["fat"]))
        db().commit()
        return jsonify({"food": one("SELECT * FROM foods WHERE id=?", (cur.lastrowid,))})

    def fetch_off(code):
        """Look one barcode up on Open Food Facts. Returns a dict or None."""
        url = ("https://world.openfoodfacts.org/api/v2/product/" + urllib.parse.quote(code) +
               ".json?fields=product_name,brands,nutriments,serving_size,serving_quantity")
        req = urllib.request.Request(url, headers={"User-Agent": "GymPulse/%s (self-hosted)" % APP_VERSION})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("status") != 1:
            return None
        p = data.get("product") or {}
        n = p.get("nutriments") or {}
        grams = num(p.get("serving_quantity"), 1, 5000)
        factor = (grams / 100.0) if grams else 1.0
        serving = (p.get("serving_size") or "").strip() or "100 g"
        if not grams:
            serving = "100 g"
        kcal = num(n.get("energy-kcal_100g"), 0, 1000)
        if kcal is None or not p.get("product_name"):
            return None
        return {"name": p["product_name"][:90], "brand": (p.get("brands") or "")[:60], "serving": serving[:60],
                "calories": round(kcal * factor, 1),
                "protein": round((num(n.get("proteins_100g"), 0, 100, 0)) * factor, 1),
                "carbs": round((num(n.get("carbohydrates_100g"), 0, 100, 0)) * factor, 1),
                "fat": round((num(n.get("fat_100g"), 0, 100, 0)) * factor, 1)}

    app.fetch_off = fetch_off  # lets the tests swap in a fake

    @app.get("/api/foods/barcode/<code>")
    @login_required()
    def api_food_barcode(code):
        if not re.match(r"^\d{6,14}$", code):
            return err("Barcodes are 6 to 14 digits.")
        have = one("SELECT * FROM foods WHERE barcode=? AND (owner_id IS NULL OR owner_id=?) LIMIT 1", (code, g.user["id"]))
        if have:
            return jsonify({"food": have})
        try:
            found = app.fetch_off(code)
        except (urllib.error.URLError, TimeoutError, ValueError, OSError):
            return err("Couldn't reach Open Food Facts right now. Check your server's internet, or add the food yourself.", 502)
        if not found:
            return err("That barcode wasn't found. You can add the food yourself.", 404)
        cur = db().execute(
            "INSERT INTO foods(owner_id,name,brand,serving,calories,protein,carbs,fat,source,barcode) "
            "VALUES(NULL,?,?,?,?,?,?,?, 'off', ?)",
            (found["name"], found["brand"], found["serving"], found["calories"], found["protein"],
             found["carbs"], found["fat"], code))
        db().commit()
        return jsonify({"food": one("SELECT * FROM foods WHERE id=?", (cur.lastrowid,))})

    @app.get("/api/diary")
    @login_required()
    def api_diary_get():
        d = valid_date(request.args.get("date"))
        entries = rows("SELECT * FROM diary WHERE user_id=? AND date=? ORDER BY id", (g.user["id"], d))
        tot = {k: round(sum(e[k] for e in entries), 1) for k in ("calories", "protein", "carbs", "fat")}
        return jsonify({"date": d, "entries": entries, "totals": tot, "goals": goals_for(g.user["id"])})

    def add_diary(uid, d, meal, name, serving, servings, cal, pro, carb, fat, food_id=None):
        db().execute(
            "INSERT INTO diary(user_id,date,meal,food_id,name,serving,servings,calories,protein,carbs,fat) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (uid, d, meal, food_id, name, serving, servings,
             round(cal * servings, 1), round(pro * servings, 1), round(carb * servings, 1), round(fat * servings, 1)))
        db().commit()

    @app.post("/api/diary")
    @login_required()
    def api_diary_add():
        b = body()
        meal = b.get("meal") if b.get("meal") in MEALS else None
        servings = num(b.get("servings"), 0.05, 50)
        f = one("SELECT * FROM foods WHERE id=? AND (owner_id IS NULL OR owner_id=?)", (b.get("food_id"), g.user["id"]))
        if not (meal and servings and f):
            return err("Pick a food, a meal and how much you ate.")
        add_diary(g.user["id"], valid_date(b.get("date")), meal, f["name"], f["serving"], servings,
                  f["calories"], f["protein"], f["carbs"], f["fat"], f["id"])
        return jsonify({"ok": True})

    @app.delete("/api/diary/<int:eid>")
    @login_required()
    def api_diary_delete(eid):
        db().execute("DELETE FROM diary WHERE id=? AND user_id=?", (eid, g.user["id"]))
        db().commit()
        return jsonify({"ok": True})

    # =====================================================================
    # Friends and the feed
    # =====================================================================
    def friend_ids(uid):
        return {r["other"] for r in rows(
            "SELECT CASE WHEN requester_id=? THEN addressee_id ELSE requester_id END AS other "
            "FROM friendships WHERE status='accepted' AND (requester_id=? OR addressee_id=?)", (uid, uid, uid))}

    @app.get("/api/friends")
    @login_required()
    def api_friends():
        uid = g.user["id"]
        friends = rows(
            "SELECT u.id, u.username FROM users u WHERE u.disabled=0 AND u.id IN ("
            "SELECT CASE WHEN requester_id=? THEN addressee_id ELSE requester_id END FROM friendships "
            "WHERE status='accepted' AND (requester_id=? OR addressee_id=?)) ORDER BY u.username", (uid, uid, uid))
        incoming = rows("SELECT f.id, u.username FROM friendships f JOIN users u ON u.id=f.requester_id "
                        "WHERE f.addressee_id=? AND f.status='pending' AND u.disabled=0", (uid,))
        outgoing = rows("SELECT f.id, u.username FROM friendships f JOIN users u ON u.id=f.addressee_id "
                        "WHERE f.requester_id=? AND f.status='pending' AND u.disabled=0", (uid,))
        return jsonify({"friends": friends, "incoming": incoming, "outgoing": outgoing})

    @app.post("/api/friends/request")
    @login_required()
    def api_friend_request():
        uid = g.user["id"]
        other = one("SELECT * FROM users WHERE username=? AND disabled=0", (text(body().get("username"), 24),))
        if not other or other["id"] == uid:
            return err("We couldn't find anyone with that username.", 404)
        mine = one("SELECT * FROM friendships WHERE requester_id=? AND addressee_id=?", (uid, other["id"]))
        theirs = one("SELECT * FROM friendships WHERE requester_id=? AND addressee_id=?", (other["id"], uid))
        if mine or (theirs and theirs["status"] == "accepted"):
            return err("You're already connected or waiting for a reply.")
        if theirs:  # they already asked us, so just accept
            db().execute("UPDATE friendships SET status='accepted' WHERE id=?", (theirs["id"],))
        else:
            db().execute("INSERT INTO friendships(requester_id,addressee_id,created_at) VALUES(?,?,?)",
                         (uid, other["id"], now()))
        db().commit()
        return api_friends()

    @app.post("/api/friends/<int:fid>/accept")
    @login_required()
    def api_friend_accept(fid):
        db().execute("UPDATE friendships SET status='accepted' WHERE id=? AND addressee_id=?", (fid, g.user["id"]))
        db().commit()
        return api_friends()

    @app.post("/api/friends/<int:fid>/ignore")
    @login_required()
    def api_friend_ignore(fid):
        db().execute("DELETE FROM friendships WHERE id=? AND (addressee_id=? OR requester_id=?) AND status='pending'",
                     (fid, g.user["id"], g.user["id"]))
        db().commit()
        return api_friends()

    @app.delete("/api/friends/<int:other>")
    @login_required()
    def api_friend_remove(other):
        uid = g.user["id"]
        db().execute("DELETE FROM friendships WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)",
                     (uid, other, other, uid))
        db().commit()
        return api_friends()

    @app.get("/api/leaderboard")
    @login_required()
    def api_leaderboard():
        today = valid_date(request.args.get("today"))
        ids = [g.user["id"]] + sorted(friend_ids(g.user["id"]))
        out = []
        for i in ids:
            u = one("SELECT id, username FROM users WHERE id=? AND disabled=0", (i,))
            if u:
                out.append({"id": u["id"], "username": u["username"], "me": i == g.user["id"],
                            "workouts": week_for(i, today)["workouts"], "streak": streak_for(i, today)})
        out.sort(key=lambda r: (-r["workouts"], -r["streak"], r["username"].lower()))
        return jsonify({"leaders": out})

    @app.get("/api/feed")
    @login_required()
    def api_feed():
        uid = g.user["id"]
        ids = [uid] + sorted(friend_ids(uid))
        marks = ",".join("?" * len(ids))
        evs = rows(
            "SELECT e.id, e.type, e.text, e.ref_id, e.created_at, u.username, e.user_id, "
            "(SELECT COUNT(*) FROM cheers c WHERE c.event_id=e.id) AS cheers, "
            "(SELECT COUNT(*) FROM cheers c WHERE c.event_id=e.id AND c.user_id=?) AS cheered "
            "FROM events e JOIN users u ON u.id=e.user_id WHERE e.user_id IN (" + marks + ") AND u.disabled=0 "
            "ORDER BY e.created_at DESC LIMIT 25", [uid] + ids)
        return jsonify({"events": evs})

    @app.post("/api/feed/<int:eid>/cheer")
    @login_required()
    def api_feed_cheer(eid):
        uid = g.user["id"]
        ev = one("SELECT * FROM events WHERE id=?", (eid,))
        if not ev or ev["user_id"] == uid or ev["user_id"] not in friend_ids(uid):
            return err("Not found.", 404)
        if one("SELECT 1 AS x FROM cheers WHERE event_id=? AND user_id=?", (eid, uid)):
            db().execute("DELETE FROM cheers WHERE event_id=? AND user_id=?", (eid, uid))
        else:
            db().execute("INSERT INTO cheers(event_id,user_id) VALUES(?,?)", (eid, uid))
        db().commit()
        return jsonify({"ok": True})

    # =====================================================================
    # Recipes
    # =====================================================================
    def can_see_recipe(r):
        uid = g.user["id"]
        return r["owner_id"] == uid or (r["shared"] and r["owner_id"] in friend_ids(uid))

    def recipe_card(r):
        uid = g.user["id"]
        r["owner"] = (one("SELECT username FROM users WHERE id=?", (r["owner_id"],)) or {}).get("username", "?")
        r["cheers"] = one("SELECT COUNT(*) AS c FROM recipe_cheers WHERE recipe_id=?", (r["id"],))["c"]
        r["cheered"] = bool(one("SELECT 1 AS x FROM recipe_cheers WHERE recipe_id=? AND user_id=?", (r["id"], uid)))
        r["mine"] = r["owner_id"] == uid
        return r

    @app.get("/api/recipes")
    @login_required()
    def api_recipes():
        uid = g.user["id"]
        ids = [uid] + sorted(friend_ids(uid))
        marks = ",".join("?" * len(ids))
        res = rows("SELECT * FROM recipes WHERE owner_id IN (" + marks + ") AND (owner_id=? OR shared=1) "
                   "ORDER BY created_at DESC LIMIT 100", ids + [uid])
        return jsonify({"recipes": [recipe_card(r) for r in res]})

    @app.get("/api/recipes/<int:rid>")
    @login_required()
    def api_recipe_get(rid):
        r = one("SELECT * FROM recipes WHERE id=?", (rid,))
        if not r or not can_see_recipe(r):
            return err("Recipe not found.", 404)
        tips = rows("SELECT t.id, t.text, t.created_at, u.username FROM recipe_tips t JOIN users u ON u.id=t.user_id "
                    "WHERE t.recipe_id=? ORDER BY t.id", (rid,))
        return jsonify({"recipe": recipe_card(r), "tips": tips})

    def clean_recipe(b):
        title = text(b.get("title"), 90)
        if not title:
            return None, "Please give your recipe a title."
        return {"title": title, "servings": int(num(b.get("servings"), 1, 50, 1)),
                "minutes": int(num(b.get("minutes"), 0, 1440, 0)),
                "ingredients": text(b.get("ingredients"), 4000), "steps": text(b.get("steps"), 6000),
                "calories": num(b.get("calories"), 0, 5000, 0), "protein": num(b.get("protein"), 0, 500, 0),
                "carbs": num(b.get("carbs"), 0, 800, 0), "fat": num(b.get("fat"), 0, 500, 0),
                "shared": 1 if b.get("shared", True) else 0}, None

    @app.post("/api/recipes")
    @login_required()
    def api_recipe_create():
        r, problem = clean_recipe(body())
        if problem:
            return err(problem)
        cur = db().execute(
            "INSERT INTO recipes(owner_id,title,servings,minutes,ingredients,steps,calories,protein,carbs,fat,shared,created_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (g.user["id"], r["title"], r["servings"], r["minutes"], r["ingredients"], r["steps"], r["calories"],
             r["protein"], r["carbs"], r["fat"], r["shared"], now()))
        rid = cur.lastrowid
        if r["shared"]:
            db().execute("INSERT INTO events(user_id,type,text,ref_id,created_at) VALUES(?,?,?,?,?)",
                         (g.user["id"], "recipe", "shared a recipe: " + r["title"], rid, now()))
        db().commit()
        return jsonify({"id": rid})

    @app.put("/api/recipes/<int:rid>")
    @login_required()
    def api_recipe_edit(rid):
        cur = one("SELECT * FROM recipes WHERE id=? AND owner_id=?", (rid, g.user["id"]))
        if not cur:
            return err("Recipe not found.", 404)
        r, problem = clean_recipe(body())
        if problem:
            return err(problem)
        db().execute("UPDATE recipes SET title=?,servings=?,minutes=?,ingredients=?,steps=?,calories=?,protein=?,"
                     "carbs=?,fat=?,shared=? WHERE id=?",
                     (r["title"], r["servings"], r["minutes"], r["ingredients"], r["steps"], r["calories"],
                      r["protein"], r["carbs"], r["fat"], r["shared"], rid))
        db().commit()
        return jsonify({"id": rid})

    @app.delete("/api/recipes/<int:rid>")
    @login_required()
    def api_recipe_delete(rid):
        db().execute("DELETE FROM events WHERE type='recipe' AND ref_id=? AND user_id=?", (rid, g.user["id"]))
        db().execute("DELETE FROM recipes WHERE id=? AND owner_id=?", (rid, g.user["id"]))
        db().commit()
        return jsonify({"ok": True})

    @app.post("/api/recipes/<int:rid>/cheer")
    @login_required()
    def api_recipe_cheer(rid):
        r = one("SELECT * FROM recipes WHERE id=?", (rid,))
        if not r or not can_see_recipe(r):
            return err("Recipe not found.", 404)
        uid = g.user["id"]
        if one("SELECT 1 AS x FROM recipe_cheers WHERE recipe_id=? AND user_id=?", (rid, uid)):
            db().execute("DELETE FROM recipe_cheers WHERE recipe_id=? AND user_id=?", (rid, uid))
        else:
            db().execute("INSERT INTO recipe_cheers(recipe_id,user_id) VALUES(?,?)", (rid, uid))
        db().commit()
        return jsonify({"ok": True})

    @app.post("/api/recipes/<int:rid>/tips")
    @login_required()
    def api_recipe_tip(rid):
        r = one("SELECT * FROM recipes WHERE id=?", (rid,))
        if not r or not can_see_recipe(r):
            return err("Recipe not found.", 404)
        t = text(body().get("text"), 400)
        if not t:
            return err("Write a quick tip first.")
        db().execute("INSERT INTO recipe_tips(recipe_id,user_id,text,created_at) VALUES(?,?,?,?)",
                     (rid, g.user["id"], t, now()))
        db().commit()
        return jsonify({"ok": True})

    @app.post("/api/recipes/<int:rid>/log")
    @login_required()
    def api_recipe_log(rid):
        r = one("SELECT * FROM recipes WHERE id=?", (rid,))
        if not r or not can_see_recipe(r):
            return err("Recipe not found.", 404)
        b = body()
        meal = b.get("meal") if b.get("meal") in MEALS else None
        servings = num(b.get("servings"), 0.05, 50)
        if not (meal and servings):
            return err("Pick a meal and how much you ate.")
        add_diary(g.user["id"], valid_date(b.get("date")), meal, r["title"], "1 serving", servings,
                  r["calories"], r["protein"], r["carbs"], r["fat"])
        return jsonify({"ok": True})

    # =====================================================================
    # Push alerts (rest timer finished)
    # =====================================================================
    @app.get("/api/push/key")
    @login_required()
    def api_push_key():
        return jsonify({"key": vapid["public"]})

    @app.post("/api/push/subscribe")
    @login_required()
    def api_push_subscribe():
        sub = body().get("subscription") or {}
        endpoint = sub.get("endpoint")
        if not endpoint or not str(endpoint).startswith("https://"):
            return err("That doesn't look like a valid subscription.")
        db().execute(
            "INSERT INTO push_subs(user_id,endpoint,sub_json) VALUES(?,?,?) "
            "ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, sub_json=excluded.sub_json",
            (g.user["id"], endpoint, json.dumps(sub)))
        db().commit()
        return jsonify({"ok": True})

    @app.post("/api/push/unsubscribe")
    @login_required()
    def api_push_unsubscribe():
        db().execute("DELETE FROM push_subs WHERE user_id=?", (g.user["id"],))
        db().commit()
        return jsonify({"ok": True})

    @app.post("/api/push/test")
    @login_required()
    def api_push_test():
        db().execute("DELETE FROM alerts WHERE user_id=?", (g.user["id"],))
        db().execute("INSERT INTO alerts(user_id,due_at,title,body,nudges_left) VALUES(?,?,?,?,0)",
                     (g.user["id"], now() + 3, "GymPulse test", "Alerts are working. Nice!"))
        db().commit()
        return jsonify({"ok": True})

    @app.post("/api/timer")
    @login_required()
    def api_timer_set():
        b = body()
        secs = int(num(b.get("seconds"), 3, 7200, 0))
        if not secs:
            return err("Bad time.")
        p = one("SELECT nudge FROM profiles WHERE user_id=?", (g.user["id"],))
        db().execute("DELETE FROM alerts WHERE user_id=?", (g.user["id"],))
        db().execute("INSERT INTO alerts(user_id,due_at,title,body,nudges_left) VALUES(?,?,?,?,?)",
                     (g.user["id"], now() + secs + 1, text(b.get("title"), 80) or "Time's up!",
                      text(b.get("body"), 140) or "Your timer is done.", 2 if p and p["nudge"] else 0))
        db().commit()
        return jsonify({"ok": True})

    @app.delete("/api/timer")
    @login_required()
    def api_timer_cancel():
        if request.args.get("nudges_only") == "1":
            db().execute("DELETE FROM alerts WHERE user_id=? AND due_at<=?", (g.user["id"], now() + 1))
            # keep a rest that is still counting down; drop only already-due repeats
            db().execute("DELETE FROM alerts WHERE user_id=? AND title LIKE 'Still%'", (g.user["id"],))
        else:
            db().execute("DELETE FROM alerts WHERE user_id=?", (g.user["id"],))
        db().commit()
        return jsonify({"ok": True})

    def send_push(sub_json, title, body_text):
        from pywebpush import webpush
        webpush(subscription_info=json.loads(sub_json),
                data=json.dumps({"title": title, "body": body_text}),
                vapid_private_key=vapid["path"],
                vapid_claims={"sub": os.environ.get("GYMPULSE_VAPID_SUBJECT", "mailto:gympulse@example.com")},
                ttl=120)

    app.send_push = send_push

    def process_alerts():
        conn = connect()
        try:
            due = [dict(r) for r in conn.execute("SELECT * FROM alerts WHERE due_at<=?", (now(),)).fetchall()]
            for a in due:
                conn.execute("DELETE FROM alerts WHERE id=?", (a["id"],))
                conn.commit()
                subs = [dict(r) for r in conn.execute("SELECT * FROM push_subs WHERE user_id=?", (a["user_id"],)).fetchall()]
                for s in subs:
                    try:
                        app.send_push(s["sub_json"], a["title"], a["body"])
                    except Exception as exc:
                        code = getattr(getattr(exc, "response", None), "status_code", None)
                        if code in (404, 410):
                            conn.execute("DELETE FROM push_subs WHERE id=?", (s["id"],))
                            conn.commit()
                        else:
                            print("Push failed:", exc)
                if a["nudges_left"] > 0 and subs:
                    conn.execute("INSERT INTO alerts(user_id,due_at,title,body,nudges_left) VALUES(?,?,?,?,?)",
                                 (a["user_id"], now() + 30, "Still resting? Time's up!", a["body"], a["nudges_left"] - 1))
                    conn.commit()
        finally:
            conn.close()

    app.process_alerts = process_alerts

    # =====================================================================
    # Admin (add people, reset passwords, backups)
    # =====================================================================
    @app.get("/api/admin/users")
    @login_required(admin=True)
    def api_admin_users():
        return jsonify({"users": rows(
            "SELECT u.id, u.username, u.role, u.disabled, u.created_at, "
            "(SELECT MAX(s.date) FROM sessions s WHERE s.user_id=u.id AND s.ended_at IS NOT NULL) AS last_workout "
            "FROM users u ORDER BY u.username COLLATE NOCASE")})

    @app.post("/api/admin/users")
    @login_required(admin=True)
    def api_admin_create():
        b = body()
        role = "admin" if b.get("role") == "admin" else "user"
        uid, problem = make_user(text(b.get("username"), 24), b.get("password") or "", role)
        if problem:
            return err(problem)
        return api_admin_users()

    @app.put("/api/admin/users/<int:uid>")
    @login_required(admin=True)
    def api_admin_edit(uid):
        u = one("SELECT * FROM users WHERE id=?", (uid,))
        if not u:
            return err("Not found.", 404)
        b = body()
        admins = one("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND disabled=0")["c"]
        new_role = ("admin" if b.get("role") == "admin" else "user") if "role" in b else u["role"]
        new_disabled = int(bool(b["disabled"])) if "disabled" in b else u["disabled"]
        losing_admin = u["role"] == "admin" and not u["disabled"] and (new_role != "admin" or new_disabled)
        if losing_admin and admins <= 1:
            return err("There must always be at least one active admin.")
        if "password" in b and b["password"]:
            if len(b["password"]) < 8:
                return err("Passwords need at least 8 characters.")
            db().execute("UPDATE users SET pw_hash=? WHERE id=?", (generate_password_hash(b["password"]), uid))
        db().execute("UPDATE users SET role=?, disabled=? WHERE id=?", (new_role, new_disabled, uid))
        db().commit()
        return api_admin_users()

    def make_backup(dest):
        src = connect()
        out = sqlite3.connect(dest)
        try:
            src.backup(out)
        finally:
            out.close()
            src.close()

    @app.get("/api/admin/backup")
    @login_required(admin=True)
    def api_admin_backup():
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        tmp.close()
        make_backup(tmp.name)
        name = "gympulse-backup-%s.db" % dt.date.today().strftime("%Y%m%d")
        resp = send_file(tmp.name, as_attachment=True, download_name=name)
        resp.call_on_close(lambda: os.path.exists(tmp.name) and os.unlink(tmp.name))
        return resp

    backup_dir = os.path.join(data_dir, "backups")

    def nightly_backup():
        os.makedirs(backup_dir, exist_ok=True)
        dest = os.path.join(backup_dir, "gympulse-%s.db" % dt.date.today().strftime("%Y%m%d"))
        if not os.path.exists(dest):
            make_backup(dest)
        for old in sorted(os.listdir(backup_dir))[:-7]:
            try:
                os.unlink(os.path.join(backup_dir, old))
            except OSError:
                pass

    app.nightly_backup = nightly_backup

    # ---- background workers ----
    def alert_loop():
        while True:
            try:
                process_alerts()
            except Exception as exc:
                print("Alert loop error:", exc)
            time.sleep(1)

    def backup_loop():
        while True:
            try:
                nightly_backup()
            except Exception as exc:
                print("Backup error:", exc)
            time.sleep(6 * 3600)

    if os.environ.get("GYMPULSE_NO_THREADS") != "1":
        threading.Thread(target=alert_loop, daemon=True).start()
        threading.Thread(target=backup_loop, daemon=True).start()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
