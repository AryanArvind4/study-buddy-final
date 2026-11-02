"""Dev-mode checks: app starts without SECRET_KEY, cookies work over http, OTP printed, no email sent."""
import os, sys, io, re, contextlib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.update({"MONGO_URI": "mongodb://fake", "FLASK_ENV": "development", "MONGO_DB_NAME": "study_partner_dev"})
for k in ("SECRET_KEY", "MAIL_USERNAME", "MAIL_PASSWORD"):
    os.environ.pop(k, None)

import mongomock, pymongo
shared = mongomock.MongoClient()
pymongo.MongoClient = lambda *a, **k: shared
import app as A

emails_sent = []
A.send_otp_email_async = lambda *a: emails_sent.append(a)
ok = True
def check(name, cond):
    global ok; ok &= bool(cond); print(("PASS " if cond else "FAIL ") + name)

check("uses dev database", A.db.name == "study_partner_dev")
c = A.app.test_client()  # plain http://localhost
H = {"Origin": "http://localhost:3000"}
email = "dev@gapp.nthu.edu.tw"
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    c.post("/send_otp", json={"email": email}, headers=H)
out = buf.getvalue()
m = re.search(r"Login code for .*: (\d{6})", out)
check("OTP printed in dev", m)
check("no email attempted without mail credentials", not emails_sent)
r = c.post("/verify_otp", json={"email": email, "otp": m.group(1)}, headers=H)
cookie = r.headers.get("Set-Cookie", "")
check("verify ok", r.status_code == 200)
check("cookie not Secure, SameSite=Lax", "Secure" not in cookie and "SameSite=Lax" in cookie)
r = c.post("/register", json={"name": "Dev", "email": email, "college": "College of Science",
           "department": "Department of Mathematics", "course_ids": ["X1"],
           "study_spots": ["Library"], "study_times": ["Weekend Morning"]}, headers=H)
check("register over http works (session cookie kept)", r.status_code == 201)
check("CORS allows localhost:3000", c.get("/get_options", headers=H).headers.get("Access-Control-Allow-Origin") == "http://localhost:3000")
sys.exit(0 if ok else 1)
