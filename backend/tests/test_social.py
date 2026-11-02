"""Core journey tests: connections, chat, blocking, sessions, groups. Uses an in-memory DB."""
import os, sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.update({"MONGO_URI": "mongodb://fake", "SECRET_KEY": "test-secret"})
# Explicit values so a local backend/.env (development mode, dev DB) can't change test behaviour.
os.environ.update({"FLASK_ENV": "test", "MONGO_DB_NAME": "test"})

import mongomock, pymongo
shared = mongomock.MongoClient()
pymongo.MongoClient = lambda *a, **k: shared
import app as A
from bson import ObjectId

A.mail.send = lambda msg: None
A.app.config["SESSION_COOKIE_SECURE"] = False
H = {"Origin": "https://studybuddynthu.org"}

results = []
def check(name, cond):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name)

def make_user(name, courses=("C1",), times=("Evening (6-9 PM)",), spots=("Library",)):
    _id = A.students_collection.insert_one({
        "name": name, "email": f"{name.lower()}@gapp.nthu.edu.tw", "college": "College of Science",
        "department": "Department of Mathematics", "course_ids": list(courses),
        "study_spots": list(spots), "study_times": list(times), "email_verified": True,
    }).inserted_id
    c = A.app.test_client()
    with c.session_transaction() as s:
        s["user_id"] = str(_id)
        s["user_email"] = f"{name.lower()}@gapp.nthu.edu.tw"
    return _id, c

def iso_in(hours):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()

alice, ca = make_user("Alice")
bob, cb = make_user("Bob")
carol, cc = make_user("Carol")
dave, cd = make_user("Dave")
eve, ce = make_user("Eve")

# ---- matches & privacy
r = ca.get("/get_matches")
check("matches include connection field, no email", r.status_code == 200 and all("email" not in m and "connection" in m for m in r.json["matches"]))

# ---- connection requests
r = ca.post("/connections", json={"user_id": str(bob), "note": "Hi Bob, want to study C1?"}, headers=H)
check("send request", r.status_code == 201 and r.json["connection"]["status"] == "pending")
conn_id = r.json["connection"]["id"]
check("request has no email", "email" not in str(r.json))
r = ca.post("/connections", json={"user_id": str(bob)}, headers=H)
check("duplicate request rejected", r.status_code == 409)
r = cb.post("/connections", json={"user_id": str(alice)}, headers=H)
check("reverse request while pending rejected", r.status_code == 409)
r = ca.post("/connections", json={"user_id": str(alice)}, headers=H)
check("can't request yourself", r.status_code == 400)
r = ca.post("/connections", json={"user_id": "nope"}, headers=H)
check("bad id -> 404", r.status_code == 404)
r = cb.get("/connections")
check("recipient sees incoming", len(r.json["incoming"]) == 1 and r.json["incoming"][0]["note"].startswith("Hi Bob"))
r = cb.get("/activity")
check("activity counts incoming request", r.json["incoming_requests"] == 1)
r = ca.post(f"/connections/{conn_id}/accept", headers=H)
check("requester can't accept own request", r.status_code == 403)
r = cc.post(f"/connections/{conn_id}/accept", headers=H)
check("stranger can't accept", r.status_code == 404)
r = cc.get(f"/threads/connection/{conn_id}/messages")
check("no chat before accept (stranger)", r.status_code == 404)
r = ca.get(f"/threads/connection/{conn_id}/messages")
check("no chat before accept (requester)", r.status_code == 404)
r = cb.post(f"/connections/{conn_id}/accept", headers=H)
check("recipient accepts", r.status_code == 200 and r.json["connection"]["status"] == "accepted")
r = cb.post(f"/connections/{conn_id}/accept", headers=H)
check("accept twice is idempotent", r.status_code == 200)
check("only one system welcome message", A.db["messages"].count_documents({"thread_id": ObjectId(conn_id), "kind": "system"}) == 1)
r = ca.get("/get_matches")
bob_match = [m for m in r.json["matches"] if m["student_id"] == str(bob)]
check("match shows accepted connection", bob_match and bob_match[0]["connection"]["status"] == "accepted")

# ---- chat
r = ca.post(f"/threads/connection/{conn_id}/messages", json={"body": "Library at 7?"}, headers=H)
check("send message", r.status_code == 201 and r.json["message"]["mine"])
r = ca.post(f"/threads/connection/{conn_id}/messages", json={"body": "   "}, headers=H)
check("empty message rejected", r.status_code == 400)
r = ca.post(f"/threads/connection/{conn_id}/messages", json={"body": "x" * 2001}, headers=H)
check("too-long message rejected", r.status_code == 400)
r = cc.post(f"/threads/connection/{conn_id}/messages", json={"body": "intruder"}, headers=H)
check("stranger can't post", r.status_code == 404)
r = cb.get("/threads")
check("thread list shows unread", r.json["threads"][0]["unread"] >= 1)
r = cb.get(f"/threads/connection/{conn_id}/messages")
check("recipient reads messages incl. note", r.status_code == 200 and any(m["body"].startswith("Hi Bob") for m in r.json["messages"]))
r = cb.get("/threads")
check("reading clears unread", r.json["threads"][0]["unread"] == 0)
r = cb.get(f"/threads/connection/{conn_id}/messages?after={iso_in(1)}")
check("after= filter returns nothing newer", r.status_code == 200 and r.json["messages"] == [])

# ---- sessions (1:1)
r = ca.post("/sessions", json={"thread_type": "connection", "thread_id": conn_id, "title": "C1 review",
                               "agenda": ["Ch 3", "Past paper"], "start_at": iso_in(24), "duration_min": 90,
                               "location": "Library"}, headers=H)
check("create session", r.status_code == 201 and r.json["session"]["state"] == "awaiting")
sid = r.json["session"]["id"]
r = ca.post("/sessions", json={"thread_type": "connection", "thread_id": conn_id, "title": "x",
                               "start_at": iso_in(-5), "location": "Library"}, headers=H)
check("past start rejected", r.status_code == 400)
r = ca.post("/sessions", json={"thread_type": "connection", "thread_id": conn_id, "title": "x",
                               "start_at": "2026-12-01T10:00", "location": "Library"}, headers=H)
check("time without timezone rejected", r.status_code == 400)
r = ca.post("/sessions", json={"thread_type": "connection", "thread_id": conn_id, "title": "x",
                               "start_at": iso_in(5), "link": "javascript:alert(1)"}, headers=H)
check("non-https link rejected", r.status_code == 400)
r = cc.get(f"/sessions/{sid}")
check("stranger can't see session", r.status_code == 404)
r = cc.post("/sessions", json={"thread_type": "connection", "thread_id": conn_id, "title": "x",
                               "start_at": iso_in(5), "location": "L"}, headers=H)
check("stranger can't create session in thread", r.status_code == 404)
r = cb.post(f"/sessions/{sid}/rsvp", json={"response": "going"}, headers=H)
check("partner accepts -> confirmed", r.status_code == 200 and r.json["session"]["state"] == "confirmed")
r = cb.post(f"/sessions/{sid}/rsvp", json={"response": "going"}, headers=H)
check("rsvp repeat is idempotent", r.status_code == 200)
r = cb.get("/activity")
check("activity has next session", r.json["next_session"] and r.json["next_session"]["id"] == sid)
before = A.db["sessions"].find_one({"_id": ObjectId(sid)})["updated_at"]
r = ca.patch(f"/sessions/{sid}", json={"start_at": iso_in(48)}, headers=H)
check("reschedule resets partner rsvp", r.status_code == 200 and r.json["session"]["state"] == "awaiting"
      and [p for p in r.json["session"]["participants"] if p["id"] == str(bob)][0]["rsvp"] == "pending")
r = ca.patch(f"/sessions/{sid}", json={"agenda": ["Only Ch 3"]}, headers=H)
check("agenda edit keeps rsvps", r.status_code == 200 and r.json["session"]["agenda"] == ["Only Ch 3"])
r = cb.post(f"/sessions/{sid}/checkin", json={"attended": True}, headers=H)
check("can't check in before start", r.status_code == 409)
r = cb.post(f"/sessions/{sid}/cancel", headers=H)
check("partner can cancel 1:1 session", r.status_code == 200 and r.json["session"]["state"] == "cancelled")
r = ca.post(f"/sessions/{sid}/rsvp", json={"response": "going"}, headers=H)
check("cancelled session not joinable", r.status_code == 409)
r = ca.patch(f"/sessions/{sid}", json={"title": "new"}, headers=H)
check("cancelled session not editable", r.status_code == 409)
# ended session -> check-in
r = ca.post("/sessions", json={"thread_type": "connection", "thread_id": conn_id, "title": "Past one",
                               "start_at": iso_in(1), "duration_min": 30, "location": "Library"}, headers=H)
past_id = r.json["session"]["id"]
A.db["sessions"].update_one({"_id": ObjectId(past_id)}, {"$set": {"start_at": datetime.utcnow() - timedelta(hours=2)}})
r = ca.get("/activity")
check("ended session needs check-in", r.json["needs_checkin"] == 1)
r = ca.post(f"/sessions/{past_id}/checkin", json={"attended": True, "note": "Finished ch 3"}, headers=H)
check("check-in after session", r.status_code == 200 and r.json["session"]["my_checkin"]["attended"] is True)
r = ca.get("/activity")
check("check-in clears reminder", r.json["needs_checkin"] == 0)
r = cc.post(f"/sessions/{past_id}/checkin", json={"attended": True}, headers=H)
check("stranger can't check in", r.status_code == 404)
r = ca.get("/sessions")
check("session list for participant", r.status_code == 200 and len(r.json["sessions"]) == 2)
r = cc.get("/sessions")
check("session list empty for stranger", r.json["sessions"] == [])

# ---- decline / cancel / expiry
r = cc.post("/connections", json={"user_id": str(dave)}, headers=H)
c2 = r.json["connection"]["id"]
r = cd.post(f"/connections/{c2}/decline", headers=H)
check("decline", r.status_code == 200)
r = cd.post(f"/connections/{c2}/accept", headers=H)
check("can't accept declined", r.status_code == 409)
r = cc.post("/connections", json={"user_id": str(dave)}, headers=H)
check("can request again after decline", r.status_code == 201)
c3 = r.json["connection"]["id"]
r = cc.post(f"/connections/{c3}/cancel", headers=H)
check("requester cancels", r.status_code == 200)
r = cc.post("/connections", json={"user_id": str(eve)}, headers=H)
c4 = r.json["connection"]["id"]
A.db["connections"].update_one({"_id": ObjectId(c4)}, {"$set": {"created_at": datetime.utcnow() - timedelta(days=15)}})
r = ce.post(f"/connections/{c4}/accept", headers=H)
check("expired request can't be accepted", r.status_code == 409 and "expired" in r.json["error"])

# ---- blocking
r = ce.post("/connections", json={"user_id": str(alice)}, headers=H)
check("eve requests alice", r.status_code == 201)
r = ca.post("/blocks", json={"user_id": str(eve)}, headers=H)
check("alice blocks eve", r.status_code == 200)
r = ca.get("/connections")
check("blocked request disappears", all(x["other"]["id"] != str(eve) for x in r.json["incoming"]))
r = ce.post("/connections", json={"user_id": str(alice)}, headers=H)
check("blocked user can't request", r.status_code == 403)
r = ca.get("/get_matches")
check("blocked user hidden from matches", all(m["student_id"] != str(eve) for m in r.json["matches"]))
r = ce.get("/get_matches")
check("blocker hidden from blocked user's matches", all(m["student_id"] != str(alice) for m in r.json["matches"]))
# block an accepted connection: chat and sessions stop
r = ca.post("/sessions", json={"thread_type": "connection", "thread_id": conn_id, "title": "Future",
                               "start_at": iso_in(30), "location": "Library"}, headers=H)
fut = r.json["session"]["id"]
r = cb.post("/blocks", json={"user_id": str(alice)}, headers=H)
r = ca.post(f"/threads/connection/{conn_id}/messages", json={"body": "hello?"}, headers=H)
check("no messages after block", r.status_code == 404)
check("future sessions cancelled on block", A.db["sessions"].find_one({"_id": ObjectId(fut)})["status"] == "cancelled")
r = ca.post("/reports", json={"user_id": str(eve), "reason": "spam", "details": "x"}, headers=H)
check("report saved", r.status_code == 201)
r = ca.post("/reports", json={"user_id": str(eve), "reason": "bogus"}, headers=H)
check("invalid report reason rejected", r.status_code == 400)
r = cb.delete(f"/blocks/{alice}", headers=H)
check("unblock", r.status_code == 200 and not A.db["blocks"].find_one({"blocker_id": bob, "blocked_id": alice}))

# ---- groups
r = cc.post("/groups", json={"name": "C1 exam crew", "course": "C1", "max_members": 3}, headers=H)
check("create group", r.status_code == 201 and r.json["group"]["invite_code"])
gid, code = r.json["group"]["id"], r.json["group"]["invite_code"]
r = cd.get(f"/threads/group/{gid}/messages")
check("non-member can't read group chat", r.status_code == 404)
r = cd.get(f"/groups/preview?code={code}")
check("preview by code", r.status_code == 200 and r.json["group"]["member_count"] == 1 and "invite_code" not in r.json["group"])
r = cd.post("/groups/join", json={"code": "wrong"}, headers=H)
check("wrong code rejected", r.status_code == 404)
r = cd.post("/groups/join", json={"code": code}, headers=H)
check("join with code", r.status_code == 200 and r.json["group"]["member_count"] == 2)
r = cd.post("/groups/join", json={"code": code}, headers=H)
check("join twice is idempotent", r.status_code == 200 and r.json["group"]["member_count"] == 2)
r = cb.post("/groups/join", json={"code": code}, headers=H)
check("third member joins", r.status_code == 200)
r = ca.post("/groups/join", json={"code": code}, headers=H)
check("full group rejects", r.status_code == 409)
r = cd.post(f"/threads/group/{gid}/messages", json={"body": "hi group"}, headers=H)
check("member posts in group", r.status_code == 201)
r = cc.post("/sessions", json={"thread_type": "group", "thread_id": gid, "title": "Group review",
                               "start_at": iso_in(10), "location": "Library"}, headers=H)
gsid = r.json["session"]["id"]
check("group session has all members", r.status_code == 201 and len(r.json["session"]["participants"]) == 3)
r = cd.post(f"/sessions/{gsid}/cancel", headers=H)
check("non-creator can't cancel group session", r.status_code == 403)
r = cd.post(f"/sessions/{gsid}/rsvp", json={"response": "going"}, headers=H)
check("member rsvps to group session", r.status_code == 200 and r.json["session"]["state"] == "confirmed")
r = cd.post(f"/groups/{gid}/remove", json={"user_id": str(bob)}, headers=H)
check("non-owner can't remove", r.status_code == 403)
r = cc.post(f"/groups/{gid}/remove", json={"user_id": str(bob)}, headers=H)
check("owner removes member", r.status_code == 200)
r = cb.get(f"/threads/group/{gid}/messages")
check("removed member loses access", r.status_code == 404)
r = cc.post(f"/groups/{gid}/invite/reset", headers=H)
check("owner resets invite", r.status_code == 200 and r.json["invite_code"] != code)
r = cb.post("/groups/join", json={"code": code}, headers=H)
check("old code no longer works", r.status_code == 404)
r = cc.post(f"/groups/{gid}/leave", headers=H)
g = A.db["groups"].find_one({"_id": ObjectId(gid)})
check("owner leaves -> ownership transfers", r.status_code == 200 and g["owner_id"] == dave)
r = cd.post(f"/groups/{gid}/leave", headers=H)
check("last member leaves -> archived", A.db["groups"].find_one({"_id": ObjectId(gid)})["archived"] is True)

# ---- auth required everywhere
anon = A.app.test_client()
for path in ["/connections", "/threads", "/sessions", "/groups", "/activity", "/blocks"]:
    check(f"anon blocked from {path}", anon.get(path).status_code == 401)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
