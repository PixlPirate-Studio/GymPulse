"""Small "undo / clean up" calls: delete a weigh-in, your own food, a recipe tip, or your own feed post."""

from flask import g, jsonify, request

SCHEMA = ""


def register(app, h):
    db, one, err = h.db, h.one, h.err
    login_required = h.login_required

    @app.delete("/api/weight/<day>")
    @login_required()
    def api_weight_delete(day):
        """Remove one day's weigh-in."""
        db().execute("DELETE FROM weights WHERE user_id=? AND date=?", (g.user["id"], day))
        db().commit()
        return jsonify({"ok": True, "stats": h.body_stats(g.user["id"])})

    @app.delete("/api/foods/<int:fid>")
    @login_required()
    def api_food_delete(fid):
        """Delete a food you created or scanned. Past diary entries keep their numbers."""
        f = one("SELECT id FROM foods WHERE id=? AND owner_id=?", (fid, g.user["id"]))
        if not f:
            return err("You can only delete foods you added yourself.", 404)
        db().execute("UPDATE diary SET food_id=NULL WHERE food_id=?", (fid,))
        db().execute("UPDATE saved_meal_items SET food_id=NULL WHERE food_id=?", (fid,))
        db().execute("DELETE FROM foods WHERE id=?", (fid,))
        db().commit()
        return jsonify({"ok": True})

    @app.delete("/api/recipes/<int:rid>/tips/<int:tid>")
    @login_required()
    def api_tip_delete(rid, tid):
        """The person who wrote a tip, or the recipe's owner, can remove it."""
        uid = g.user["id"]
        tip = one("SELECT t.*, r.owner_id AS rowner FROM recipe_tips t JOIN recipes r ON r.id=t.recipe_id "
                  "WHERE t.id=? AND t.recipe_id=?", (tid, rid))
        if not tip or uid not in (tip["user_id"], tip["rowner"]):
            return err("Not found.", 404)
        db().execute("DELETE FROM recipe_tips WHERE id=?", (tid,))
        db().commit()
        return jsonify({"ok": True})

    @app.delete("/api/feed/<int:eid>")
    @login_required()
    def api_feed_delete(eid):
        """Remove one of your own posts from the activity feed."""
        db().execute("DELETE FROM events WHERE id=? AND user_id=?", (eid, g.user["id"]))
        db().commit()
        return jsonify({"ok": True})

    @app.post("/api/reset")
    @login_required()
    def api_reset():
        """Start fresh. Clears only YOUR data, only the parts you pick: workouts, food, body."""
        uid = g.user["id"]
        what = (request.get_json(silent=True) or {}).get("what") or []
        if not isinstance(what, list) or not set(what) <= {"workouts", "food", "body"} or not what:
            return err("Pick what to reset.")
        q = db().execute
        if "workouts" in what:
            ids = "(SELECT id FROM sessions WHERE user_id=?)"
            q("DELETE FROM set_logs WHERE session_exercise_id IN (SELECT id FROM session_exercises WHERE session_id IN %s)" % ids, (uid,))
            q("DELETE FROM session_exercises WHERE session_id IN %s" % ids, (uid,))
            q("DELETE FROM sessions WHERE user_id=?", (uid,))
            q("DELETE FROM badges WHERE user_id=?", (uid,))
            q("DELETE FROM cheers WHERE event_id IN (SELECT id FROM events WHERE user_id=?)", (uid,))
            q("DELETE FROM reactions WHERE event_id IN (SELECT id FROM events WHERE user_id=? AND type IN ('workout','pr','badge','challenge'))", (uid,))
            q("DELETE FROM events WHERE user_id=? AND type IN ('workout','pr','badge','challenge')", (uid,))
            q("DELETE FROM notifications WHERE user_id=? AND kind IN ('badge','reaction','challenge')", (uid,))
        if "food" in what:
            q("DELETE FROM diary WHERE user_id=?", (uid,))
            q("DELETE FROM water WHERE user_id=?", (uid,))
        if "body" in what:
            q("DELETE FROM weights WHERE user_id=?", (uid,))
            q("DELETE FROM measurements WHERE user_id=?", (uid,))
        db().commit()
        return jsonify({"ok": True})
