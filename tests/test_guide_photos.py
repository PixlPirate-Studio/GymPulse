import io
import os
import sys

os.environ["GYMPULSE_NO_THREADS"] = "1"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from test_app import app, client, setup_admin, add_user, H  # noqa: F401,E402
from PIL import Image


def jpeg(w=2000, h=1500, gps=True):
    im = Image.new("RGB", (w, h), (200, 30, 30))
    buf = io.BytesIO()
    exif = Image.Exif()
    if gps:
        exif[0x8825] = {1: "N"}
        exif[0x010F] = "SecretCam"
    im.save(buf, "JPEG", exif=exif)
    buf.seek(0)
    return buf


def test_guide_matches_every_default_exercise(app):
    import app as mod
    c = client(app); setup_admin(c)
    for name, *_ in mod.DEFAULT_ROUTINE:
        card = c.get("/api/exercise-guide", query_string={"name": name}).get_json()["card"]
        assert card and card["how"] and card["setup"] and card["mistakes"], name
    assert c.get("/api/exercise-guide", query_string={"name": "Zorbing"}).get_json()["card"] is None
    cards = c.get("/api/exercise-guide").get_json()["cards"]
    assert len(cards) >= 25 and "how" not in cards[0]
    assert c.get("/api/exercise-guide/plank").get_json()["card"]["kind"] == "timed"
    assert c.get("/api/exercise-guide/nope").status_code == 404


def test_photo_upload_private_resized_no_exif(app):
    c = client(app); setup_admin(c)
    r = c.post("/api/photos", data={"photo": (jpeg(), "me.jpg"), "date": "2026-02-01"}, headers=H,
               content_type="multipart/form-data")
    assert r.status_code == 200, r.get_json()
    pid = r.get_json()["id"]
    img = Image.open(io.BytesIO(c.get("/api/photos/%d/image" % pid).data))
    assert max(img.size) == 1280
    assert not img.getexif().get(0x8825) and not img.getexif().get(0x010F)
    thumb = Image.open(io.BytesIO(c.get("/api/photos/%d/image?size=thumb" % pid).data))
    assert max(thumb.size) == 320
    # admin and strangers cannot see it
    other = add_user(c, "sam")
    assert other.get("/api/photos/%d/image" % pid).status_code == 404
    assert other.get("/api/photos").get_json()["photos"] == []
    # not-a-photo and missing file are refused
    bad = c.post("/api/photos", data={"photo": (io.BytesIO(b"<script>"), "x.jpg")}, headers=H,
                 content_type="multipart/form-data")
    assert bad.status_code == 400
    assert c.post("/api/photos", data={}, headers=H, content_type="multipart/form-data").status_code == 400
    c.delete("/api/photos/%d" % pid, headers=H)
    assert c.get("/api/photos").get_json()["photos"] == []
    assert c.get("/api/photos/%d/image" % pid).status_code == 404


def test_big_json_rejected(app):
    c = client(app); setup_admin(c)
    r = c.post("/api/weight", data=b"{" + b" " * (2 * 1024 * 1024) + b"}", headers=dict(H, **{"Content-Type": "application/json"}))
    assert r.status_code == 413
