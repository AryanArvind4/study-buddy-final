"""Security checks for backend/app.py, run against an in-memory mongomock DB."""
import os, sys, re
from datetime import datetime, timedelta

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
os.environ["MONGO_URI"] = "mongodb://fake"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["ADMIN_EMAILS"] = "admin@gapp.nthu.edu.tw"
# Explicit values so a local backend/.env (development mode, dev DB) can't change test behaviour.
os.environ["FLASK_ENV"] = "test"
os.environ["MONGO_DB_NAME"] = "test"

import mongomock, pymongo
_shared = mongomock.MongoClient()
pymongo.MongoClient = lambda *a, **k: _shared

import app as A

sent_otps = {}
A.send_otp_email_async = lambda app, email, otp: sent_otps.__setitem__(email, otp)
A.send_email = lambda *a, **k: None
sent_mail = []
A.mail.send = lambda msg: sent_mail.append(msg)
A.app.config["SESSION_COOKIE_SECURE"] = False
A.app.config["TESTING"] = True

ORIGIN = {"Origin": "https://studybuddynthu.org"}
results = []
def check(name, cond):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name)

def client():
    return A.app.test_client()

def reg_payload(email, name="Alice"):
    return {"name": name, "email": email, "college": "College of Science",
            "department": "Department of Mathematics", "course_ids": ["MATH101", "PHYS101"],
            "study_spots": ["Library"], "study_times": ["Evening (6-9 PM)"],
            "email_verified": "hacked", "is_admin": True}

def verify(c, email):
    c.post("/send_otp", json={"email": email}, headers=ORIGIN)
    r = c.post("/verify_otp", json={"email": email, "otp": sent_otps[email]}, headers=ORIGIN)
    return r.status_code == 200

def expire_cooldown(email):
    A.otp_collection.update_one({"email": email}, {"$set": {"created_at": datetime.utcnow() - timedelta(minutes=2)}})

alice, bob = "alice@gapp.nthu.edu.tw", "bob@gapp.nthu.edu.tw"

# --- Registration ---
c = client()
r = c.post("/register", json=reg_payload(alice), headers=ORIGIN)
check("register without OTP is rejected", r.status_code == 400)
check("register flow: verify OTP", verify(c, alice))
r = c.post("/register", json=reg_payload(alice), headers=ORIGIN)
check("register after OTP succeeds", r.status_code == 201)
doc = A.students_collection.find_one({"email": alice})
check("extra fields are dropped (no is_admin)", "is_admin" not in doc and doc["email_verified"] is True)
check("OTP not stored in plain text", all("otp" not in d for d in A.otp_collection.find()))

cb = client(); verify(cb, bob)
p = reg_payload(bob, "Bob <script>x</script>\nBcc: evil@x.com")
check("register bob", cb.post("/register", json=p, headers=ORIGIN).status_code == 201)
check("newlines stripped from name", "\n" not in A.students_collection.find_one({"email": bob})["name"])

# --- Login ---
attacker = client()
r = attacker.post("/login", json={"email": alice}, headers=ORIGIN)
check("login with only an email is rejected", r.status_code == 401)

c2 = client()
expire_cooldown(alice)
c2.post("/send_otp", json={"email": alice}, headers=ORIGIN)
r = c2.post("/send_otp", json={"email": alice}, headers=ORIGIN)
check("resend within 60s is rate-limited", r.status_code == 429)
c2.post("/verify_otp", json={"email": alice, "otp": sent_otps[alice]}, headers=ORIGIN)
r = attacker.post("/login", json={"email": alice}, headers=ORIGIN)
check("another browser can't use someone else's verified code", r.status_code == 401)
r = c2.post("/login", json={"email": alice}, headers=ORIGIN)
check("login after OTP verification succeeds", r.status_code == 200)
r = client().post("/login", json={"email": alice}, headers=ORIGIN)
check("verified code can't be reused", r.status_code == 401)
alice_id = A.students_collection.find_one({"email": alice})["_id"]
bob_id = A.students_collection.find_one({"email": bob})["_id"]

# --- Brute-force limit ---
b = client(); expire_cooldown(bob)
b.post("/send_otp", json={"email": bob}, headers=ORIGIN)
real = sent_otps[bob]
wrong = "000000" if real != "000000" else "111111"
for _ in range(5):
    b.post("/verify_otp", json={"email": bob, "otp": wrong}, headers=ORIGIN)
r = b.post("/verify_otp", json={"email": bob, "otp": real}, headers=ORIGIN)
check("correct code refused after 5 wrong guesses", r.status_code == 400)
r = b.post("/verify_otp", json={"email": {"$ne": ""}, "otp": {"$ne": ""}}, headers=ORIGIN)
check("NoSQL operator injection in OTP rejected", r.status_code == 400)

# --- Data access ---
r = c2.get("/get_students")
check("/get_students removed", r.status_code == 404)
r = c2.get("/stats")
check("/stats returns only a count", r.status_code == 200 and r.json == {"total_students": 2})
r = c2.get(f"/get_student/{bob_id}")
check("/get_student hides email", r.status_code == 200 and "email" not in r.json and r.json["name"])
r = c2.get("/get_student/not-an-id")
check("/get_student bad id -> 404 (no crash)", r.status_code == 404)
r = c2.get(f"/get_matches/{bob_id}")
check("can't compute someone else's matches", r.status_code == 403)
r = c2.get("/get_matches")
check("own matches work", r.status_code == 200 and r.json["matches"][0]["student_id"] == str(bob_id))
r = c2.get(f"/get_matches/{alice_id}")
check("legacy /get_matches/<own id> still works", r.status_code == 200)
r = c2.post("/add_student", json=reg_payload("fake@gapp.nthu.edu.tw"), headers=ORIGIN)
check("/add_student removed", r.status_code in (404, 405))

# --- Matches no longer expose emails; old email endpoint removed ---
r = c2.get("/get_matches")
check("matches never include email", all("email" not in m for m in r.json["matches"]))
r = c2.post("/send_partner_email", json={"partner_id": str(bob_id)}, headers=ORIGIN)
check("old email-introduction endpoint removed", r.status_code in (404, 405))

# --- CORS / CSRF ---
r = c2.get("/stats", headers={"Origin": "https://evil.vercel.app"})
check("untrusted origin gets no CORS header", "Access-Control-Allow-Origin" not in r.headers)
r = c2.get("/stats", headers={"Origin": "https://studybuddynthu.org.evil.com"})
check("look-alike origin gets no CORS header", "Access-Control-Allow-Origin" not in r.headers)
r = c2.get("/stats", headers=ORIGIN)
check("trusted origin gets CORS header", r.headers.get("Access-Control-Allow-Origin") == ORIGIN["Origin"])
r = c2.put("/update_profile", json={"study_spots": ["Library"]}, headers={"Origin": "https://evil.com"})
check("state change from untrusted origin blocked", r.status_code == 403)
r = c2.options("/login", headers={"Origin": "https://evil.com"})
check("preflight from untrusted origin gets no CORS header", "Access-Control-Allow-Origin" not in r.headers)

# --- Profile / admin / errors ---
r = c2.put("/update_profile", json={"course_ids": [{"$gt": ""}]}, headers=ORIGIN)
check("update_profile rejects non-string course ids", r.status_code == 400)
r = c2.put("/update_profile", json={"course_ids": ["CS101"], "email": "x@y.com"}, headers=ORIGIN)
check("update_profile ignores email field", r.status_code == 200 and r.json["user"]["email"] == alice)
r = c2.post("/update_courses_from_nthu", headers=ORIGIN)
check("course refresh needs admin", r.status_code == 403)
r = c2.post("/get_course_names", data="not json", headers={**ORIGIN, "Content-Type": "text/plain"})
check("bad body handled without error leak", r.status_code < 500)
r = client().post("/login", data="x", headers={**ORIGIN, "Content-Type": "application/json"})
check("malformed JSON login -> 401, no 500", r.status_code == 401)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
