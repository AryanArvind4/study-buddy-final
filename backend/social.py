"""Connections, chat, blocking, study sessions and course groups.

Every route checks that the signed-in student is allowed to see or change the
object it touches. Times are stored as naive UTC datetimes and sent to the
browser as ISO strings ending in "Z".
"""
import html
import re
import secrets
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from bson import ObjectId
from flask import Blueprint, jsonify, request, session
from pymongo.errors import DuplicateKeyError

REQUEST_TTL = timedelta(days=14)
REQUESTS_PER_DAY = 20
MESSAGES_PER_MINUTE = 30
MAX_MESSAGE_LEN = 2000
MAX_NOTE_LEN = 300
GROUP_MAX_MEMBERS = 12
GROUPS_PER_USER = 10
SESSION_MIN_MINUTES = 15
SESSION_MAX_MINUTES = 480
REPORT_REASONS = {"spam", "harassment", "inappropriate", "fake", "other"}


def init_social(app, db, *, login_required, json_body, get_str, parse_object_id, send_email, site_url):
    students = db["students"]
    connections = db["connections"]
    messages = db["messages"]
    blocks = db["blocks"]
    reports = db["reports"]
    sessions = db["sessions"]
    groups = db["groups"]

    def safe_index(coll, keys, **kwargs):
        try:
            coll.create_index(keys, **kwargs)
        except Exception as e:  # e.g. an index option the server/test double doesn't support
            print(f"⚠️ Could not create index on {coll.name}: {e}")

    # One active (pending or accepted) connection per pair of students.
    safe_index(connections, "pair_key", unique=True, partialFilterExpression={"active": True}, name="active_pair_unique")
    safe_index(connections, [("requester_id", 1), ("status", 1)])
    safe_index(connections, [("recipient_id", 1), ("status", 1)])
    safe_index(messages, [("thread_type", 1), ("thread_id", 1), ("created_at", -1)])
    safe_index(blocks, [("blocker_id", 1), ("blocked_id", 1)], unique=True)
    safe_index(sessions, [("thread_type", 1), ("thread_id", 1), ("start_at", 1)])
    safe_index(groups, "invite_code", unique=True)
    safe_index(groups, "members")

    bp = Blueprint("social", __name__)

    # ------------------------------------------------------------------ helpers

    def me():
        return ObjectId(session["user_id"])

    def now():
        return datetime.utcnow()

    def iso(dt):
        return dt.replace(microsecond=0).isoformat() + "Z" if dt else None

    def parse_time(value):
        """Parse an ISO time with a timezone into naive UTC. Returns None if invalid."""
        if not isinstance(value, str) or len(value) > 40:
            return None
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        if dt.tzinfo is None:
            return None
        return dt.astimezone(timezone.utc).replace(tzinfo=None)

    def error(message, status=400):
        return jsonify({"error": message}), status

    def public_user(doc):
        if not doc:
            return {"id": None, "name": "Former student", "department": "", "college": ""}
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "department": doc.get("department", ""),
            "college": doc.get("college", ""),
        }

    def users_by_id(ids):
        ids = list({i for i in ids if i})
        return {u["_id"]: u for u in students.find({"_id": {"$in": ids}}, {"email": 0})} if ids else {}

    def pair_key(a, b):
        return "_".join(sorted([str(a), str(b)]))

    def is_blocked_between(a, b):
        return blocks.find_one({"$or": [{"blocker_id": a, "blocked_id": b}, {"blocker_id": b, "blocked_id": a}]}) is not None

    def blocked_ids(uid):
        """Everyone this student has blocked or been blocked by."""
        out = set()
        for b in blocks.find({"$or": [{"blocker_id": uid}, {"blocked_id": uid}]}):
            out.add(b["blocked_id"] if b["blocker_id"] == uid else b["blocker_id"])
        return out

    def expire_if_stale(doc):
        """Pending requests older than REQUEST_TTL become 'expired' (lazily, on read)."""
        if doc and doc["status"] == "pending" and doc["created_at"] < now() - REQUEST_TTL:
            connections.update_one({"_id": doc["_id"], "status": "pending"},
                                   {"$set": {"status": "expired", "active": False, "updated_at": now()}})
            doc["status"] = "expired"
            doc["active"] = False
        return doc

    def connection_states(uid, other_ids):
        """Map other student id -> {status, direction, connection_id} for active connections."""
        keys = {pair_key(uid, o): o for o in other_ids}
        out = {}
        for c in connections.find({"pair_key": {"$in": list(keys)}, "active": True}):
            c = expire_if_stale(c)
            if not c.get("active"):
                continue
            other = keys[c["pair_key"]]
            out[other] = {
                "status": c["status"],
                "direction": "outgoing" if c["requester_id"] == uid else "incoming",
                "connection_id": str(c["_id"]),
            }
        return out

    def notify(user_id, subject, headline, body_text, cta_path):
        """Email a student about something that happened. Never includes anyone's email address."""
        user = students.find_one({"_id": user_id}, {"email": 1, "name": 1})
        if not user or not user.get("email"):
            return
        link = f"{site_url}{cta_path}"
        html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b">
          <p style="font-weight:600;font-size:18px;margin:0 0 12px">{html.escape(headline)}</p>
          <p style="color:#52525b;line-height:1.6;margin:0 0 20px">{html.escape(body_text)}</p>
          <a href="{html.escape(link)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open StudyBuddy</a>
          <p style="color:#a1a1aa;font-size:12px;margin-top:28px">You're getting this because you have a StudyBuddy account.</p>
        </div>"""
        send_email(user["email"], subject, html_body, f"{headline}\n\n{body_text}\n\n{link}")

    # ---------------------------------------------------------------- threads

    def load_thread(thread_type, thread_id, uid):
        """Return (doc, participant_ids) if uid may use this thread, else (None, None)."""
        oid = parse_object_id(thread_id)
        if not oid:
            return None, None
        if thread_type == "connection":
            doc = connections.find_one({"_id": oid, "status": "accepted", "$or": [{"requester_id": uid}, {"recipient_id": uid}]})
            if not doc:
                return None, None
            return doc, [doc["requester_id"], doc["recipient_id"]]
        if thread_type == "group":
            doc = groups.find_one({"_id": oid, "members": uid, "archived": {"$ne": True}})
            if not doc:
                return None, None
            return doc, list(doc["members"])
        return None, None

    def thread_collection(thread_type):
        return connections if thread_type == "connection" else groups

    def post_message(thread_type, thread_doc, sender_id, body, kind="text"):
        at = now()
        res = messages.insert_one({
            "thread_type": thread_type,
            "thread_id": thread_doc["_id"],
            "sender_id": sender_id,
            "body": body,
            "kind": kind,
            "created_at": at,
        })
        update = {"$set": {"last_message_at": at, "last_message_preview": body[:120]}}
        if sender_id:
            update["$set"][f"reads.{sender_id}"] = at
        thread_collection(thread_type).update_one({"_id": thread_doc["_id"]}, update)
        return res.inserted_id, at

    def unread_count(thread_type, doc, uid):
        last_read = (doc.get("reads") or {}).get(str(uid))
        query = {"thread_type": thread_type, "thread_id": doc["_id"], "sender_id": {"$ne": uid}, "kind": "text"}
        if last_read:
            query["created_at"] = {"$gt": last_read}
        return messages.count_documents(query)

    def serialize_message(m, uid):
        return {
            "id": str(m["_id"]),
            "sender_id": str(m["sender_id"]) if m.get("sender_id") else None,
            "body": m["body"],
            "kind": m.get("kind", "text"),
            "created_at": iso(m["created_at"]),
            "mine": m.get("sender_id") == uid,
        }

    def thread_summary(thread_type, doc, uid, people):
        if thread_type == "connection":
            other_id = doc["recipient_id"] if doc["requester_id"] == uid else doc["requester_id"]
            title = people.get(other_id, {}).get("name", "Former student")
            members = [public_user(people.get(other_id))]
        else:
            title = doc["name"]
            members = [public_user(people.get(m)) for m in doc["members"]]
        return {
            "type": thread_type,
            "id": str(doc["_id"]),
            "title": title,
            "course": doc.get("course", ""),
            "members": members,
            "last_message": doc.get("last_message_preview", ""),
            "last_message_at": iso(doc.get("last_message_at") or doc.get("updated_at") or doc.get("created_at")),
            "unread": unread_count(thread_type, doc, uid),
        }

    def my_threads(uid):
        conns = list(connections.find({"status": "accepted", "$or": [{"requester_id": uid}, {"recipient_id": uid}]}))
        grps = list(groups.find({"members": uid, "archived": {"$ne": True}}))
        return conns, grps

    # ------------------------------------------------------------ connections

    def serialize_connection(c, uid, people):
        outgoing = c["requester_id"] == uid
        other_id = c["recipient_id"] if outgoing else c["requester_id"]
        return {
            "id": str(c["_id"]),
            "status": c["status"],
            "direction": "outgoing" if outgoing else "incoming",
            "note": c.get("note", ""),
            "other": public_user(people.get(other_id)),
            "created_at": iso(c["created_at"]),
            "expires_at": iso(c["created_at"] + REQUEST_TTL) if c["status"] == "pending" else None,
        }

    @bp.route("/connections", methods=["GET"])
    @login_required
    def list_connections():
        uid = me()
        docs = [expire_if_stale(c) for c in connections.find({
            "active": True, "$or": [{"requester_id": uid}, {"recipient_id": uid}]})]
        docs = [c for c in docs if c.get("active")]
        people = users_by_id([c["requester_id"] for c in docs] + [c["recipient_id"] for c in docs])
        incoming, outgoing, accepted = [], [], []
        for c in docs:
            item = serialize_connection(c, uid, people)
            if c["status"] == "accepted":
                accepted.append(item)
            elif item["direction"] == "incoming":
                incoming.append(item)
            else:
                outgoing.append(item)
        newest_first = lambda x: x["created_at"] or ""  # noqa: E731
        return jsonify({
            "incoming": sorted(incoming, key=newest_first, reverse=True),
            "outgoing": sorted(outgoing, key=newest_first, reverse=True),
            "connections": accepted,
        })

    @bp.route("/connections", methods=["POST"])
    @login_required
    def create_connection():
        uid = me()
        data = json_body()
        target_id = parse_object_id(get_str(data, "user_id", 40))
        note = get_str(data, "note", MAX_NOTE_LEN)
        target = students.find_one({"_id": target_id}) if target_id else None
        if not target:
            return error("Student not found", 404)
        if target_id == uid:
            return error("You can't connect with yourself")
        if is_blocked_between(uid, target_id):
            return error("You can't connect with this student", 403)
        if connections.count_documents({"requester_id": uid, "created_at": {"$gt": now() - timedelta(days=1)}}) >= REQUESTS_PER_DAY:
            return error("You've sent a lot of requests today. Try again tomorrow.", 429)

        existing = expire_if_stale(connections.find_one({"pair_key": pair_key(uid, target_id), "active": True}))
        if existing and existing.get("active"):
            if existing["status"] == "accepted":
                return error("You're already connected", 409)
            if existing["requester_id"] == uid:
                return error("Request already sent", 409)
            return error("They already sent you a request. Accept it from your inbox.", 409)

        at = now()
        doc = {
            "requester_id": uid,
            "recipient_id": target_id,
            "pair_key": pair_key(uid, target_id),
            "status": "pending",
            "active": True,
            "note": note,
            "created_at": at,
            "updated_at": at,
            "reads": {},
        }
        try:
            doc["_id"] = connections.insert_one(doc).inserted_id
        except DuplicateKeyError:
            return error("Request already exists", 409)

        sender = students.find_one({"_id": uid}, {"name": 1, "department": 1})
        notify(target_id, f"{sender['name']} wants to study with you",
               f"{sender['name']} sent you a study partner request",
               (f"{sender['name']} ({sender.get('department', '')}) found you on StudyBuddy. "
                + (f'Their note: "{note}". ' if note else "")
                + "Accept or decline the request in your StudyBuddy inbox."),
               "/inbox")
        people = users_by_id([target_id])
        return jsonify({"connection": serialize_connection(doc, uid, people)}), 201

    def transition(connection_id, uid, role, from_status, to_status, active):
        """Move a connection between states. role is 'recipient', 'requester' or 'either'."""
        oid = parse_object_id(connection_id)
        if not oid:
            return None, error("Request not found", 404)
        doc = expire_if_stale(connections.find_one({"_id": oid}))
        if not doc or uid not in (doc["requester_id"], doc["recipient_id"]):
            return None, error("Request not found", 404)
        if role == "recipient" and doc["recipient_id"] != uid:
            return None, error("Only the person who received this request can do that", 403)
        if role == "requester" and doc["requester_id"] != uid:
            return None, error("Only the person who sent this request can do that", 403)
        if doc["status"] == to_status:
            return doc, None  # repeated click: nothing more to do
        if doc["status"] != from_status:
            return None, error(f"This request is already {doc['status']}", 409)
        update = {"status": to_status, "active": active, "updated_at": now(), "responded_at": now()}
        res = connections.update_one({"_id": oid, "status": from_status}, {"$set": update})
        if res.modified_count == 0:
            fresh = connections.find_one({"_id": oid})
            if fresh and fresh["status"] == to_status:
                return fresh, None
            return None, error("This request changed. Refresh and try again.", 409)
        doc.update(update)
        return doc, None

    @bp.route("/connections/<cid>/accept", methods=["POST"])
    @login_required
    def accept_connection(cid):
        uid = me()
        doc, err = transition(cid, uid, "recipient", "pending", "accepted", True)
        if err:
            return err
        if is_blocked_between(doc["requester_id"], doc["recipient_id"]):
            return error("You can't connect with this student", 403)
        if not messages.find_one({"thread_type": "connection", "thread_id": doc["_id"]}):
            post_message("connection", doc, None, "You're connected. Say hi and plan your first session.", kind="system")
            if doc.get("note"):
                messages.insert_one({"thread_type": "connection", "thread_id": doc["_id"], "sender_id": doc["requester_id"],
                                     "body": doc["note"], "kind": "text", "created_at": doc["created_at"]})
            me_doc = students.find_one({"_id": uid}, {"name": 1})
            notify(doc["requester_id"], f"{me_doc['name']} accepted your request",
                   f"{me_doc['name']} accepted your study partner request",
                   "You can now message each other and plan a study session on StudyBuddy.",
                   f"/inbox/connection/{doc['_id']}")
        people = users_by_id([doc["requester_id"]])
        return jsonify({"connection": serialize_connection(doc, uid, people)})

    @bp.route("/connections/<cid>/decline", methods=["POST"])
    @login_required
    def decline_connection(cid):
        doc, err = transition(cid, me(), "recipient", "pending", "declined", False)
        return err or jsonify({"ok": True})

    @bp.route("/connections/<cid>/cancel", methods=["POST"])
    @login_required
    def cancel_connection(cid):
        doc, err = transition(cid, me(), "requester", "pending", "cancelled", False)
        return err or jsonify({"ok": True})

    @bp.route("/connections/<cid>/remove", methods=["POST"])
    @login_required
    def remove_connection(cid):
        uid = me()
        doc, err = transition(cid, uid, "either", "accepted", "removed", False)
        if err:
            return err
        cancel_thread_sessions("connection", doc["_id"], uid)
        return jsonify({"ok": True})

    # --------------------------------------------------------- blocks/reports

    @bp.route("/blocks", methods=["GET"])
    @login_required
    def list_blocks():
        uid = me()
        rows = list(blocks.find({"blocker_id": uid}))
        people = users_by_id([b["blocked_id"] for b in rows])
        return jsonify({"blocked": [public_user(people.get(b["blocked_id"])) | {"id": str(b["blocked_id"])} for b in rows]})

    @bp.route("/blocks", methods=["POST"])
    @login_required
    def block_user():
        uid = me()
        target_id = parse_object_id(get_str(json_body(), "user_id", 40))
        if not target_id or not students.find_one({"_id": target_id}):
            return error("Student not found", 404)
        if target_id == uid:
            return error("You can't block yourself")
        try:
            blocks.insert_one({"blocker_id": uid, "blocked_id": target_id, "created_at": now()})
        except DuplicateKeyError:
            pass
        # End any active connection and its upcoming sessions.
        conn = connections.find_one({"pair_key": pair_key(uid, target_id), "active": True})
        if conn:
            connections.update_one({"_id": conn["_id"]}, {"$set": {"status": "blocked", "active": False, "updated_at": now()}})
            cancel_thread_sessions("connection", conn["_id"], uid)
        return jsonify({"ok": True})

    @bp.route("/blocks/<user_id>", methods=["DELETE"])
    @login_required
    def unblock_user(user_id):
        oid = parse_object_id(user_id)
        if oid:
            blocks.delete_one({"blocker_id": me(), "blocked_id": oid})
        return jsonify({"ok": True})

    @bp.route("/reports", methods=["POST"])
    @login_required
    def report_user():
        uid = me()
        data = json_body()
        target_id = parse_object_id(get_str(data, "user_id", 40))
        reason = get_str(data, "reason", 30)
        if not target_id or not students.find_one({"_id": target_id}):
            return error("Student not found", 404)
        if reason not in REPORT_REASONS:
            return error("Choose a reason")
        if reports.count_documents({"reporter_id": uid, "created_at": {"$gt": now() - timedelta(days=1)}}) >= 10:
            return error("Too many reports today", 429)
        reports.insert_one({
            "reporter_id": uid,
            "reported_id": target_id,
            "reason": reason,
            "details": get_str(data, "details", 1000),
            "status": "open",
            "created_at": now(),
        })
        return jsonify({"ok": True}), 201

    # ---------------------------------------------------------------- messages

    @bp.route("/threads", methods=["GET"])
    @login_required
    def list_threads():
        uid = me()
        conns, grps = my_threads(uid)
        ids = [c["requester_id"] for c in conns] + [c["recipient_id"] for c in conns] + [m for g in grps for m in g["members"]]
        people = users_by_id(ids)
        threads = [thread_summary("connection", c, uid, people) for c in conns]
        threads += [thread_summary("group", g, uid, people) for g in grps]
        threads.sort(key=lambda t: t["last_message_at"] or "", reverse=True)
        return jsonify({"threads": threads})

    @bp.route("/threads/<thread_type>/<thread_id>", methods=["GET"])
    @login_required
    def get_thread(thread_type, thread_id):
        uid = me()
        doc, members = load_thread(thread_type, thread_id, uid)
        if not doc:
            return error("Conversation not found", 404)
        people = users_by_id(members)
        summary = thread_summary(thread_type, doc, uid, people)
        if thread_type == "group":
            summary.update({
                "description": doc.get("description", ""),
                "owner_id": str(doc["owner_id"]),
                "invite_code": doc["invite_code"],
                "max_members": doc.get("max_members", GROUP_MAX_MEMBERS),
                "is_owner": doc["owner_id"] == uid,
            })
        else:
            summary["connection_id"] = str(doc["_id"])
        return jsonify({"thread": summary})

    @bp.route("/threads/<thread_type>/<thread_id>/messages", methods=["GET"])
    @login_required
    def get_messages(thread_type, thread_id):
        uid = me()
        doc, _ = load_thread(thread_type, thread_id, uid)
        if not doc:
            return error("Conversation not found", 404)
        query = {"thread_type": thread_type, "thread_id": doc["_id"]}
        # An unencoded "+" in a query string arrives as a space.
        after = parse_time((request.args.get("after") or "").replace(" ", "+"))
        if after:
            query["created_at"] = {"$gt": after}
        rows = list(messages.find(query).sort("created_at", -1).limit(200))
        rows.reverse()
        thread_collection(thread_type).update_one({"_id": doc["_id"]}, {"$set": {f"reads.{uid}": now()}})
        return jsonify({"messages": [serialize_message(m, uid) for m in rows]})

    @bp.route("/threads/<thread_type>/<thread_id>/messages", methods=["POST"])
    @login_required
    def send_message(thread_type, thread_id):
        uid = me()
        doc, members = load_thread(thread_type, thread_id, uid)
        if not doc:
            return error("Conversation not found", 404)
        if thread_type == "connection":
            other = [m for m in members if m != uid][0]
            if is_blocked_between(uid, other):
                return error("You can't message this student", 403)
        body = get_str(json_body(), "body", MAX_MESSAGE_LEN + 1)
        if not body:
            return error("Write a message first")
        if len(body) > MAX_MESSAGE_LEN:
            return error(f"Messages can be up to {MAX_MESSAGE_LEN} characters")
        if messages.count_documents({"sender_id": uid, "created_at": {"$gt": now() - timedelta(minutes=1)}}) >= MESSAGES_PER_MINUTE:
            return error("You're sending messages too quickly. Wait a moment.", 429)
        mid, at = post_message(thread_type, doc, uid, body)
        return jsonify({"message": serialize_message({"_id": mid, "sender_id": uid, "body": body, "kind": "text", "created_at": at}, uid)}), 201

    # ---------------------------------------------------------------- sessions

    def load_thread_any(thread_type, oid):
        if thread_type == "connection":
            doc = connections.find_one({"_id": oid})
            return doc, ([doc["requester_id"], doc["recipient_id"]] if doc else [])
        doc = groups.find_one({"_id": oid})
        return doc, (list(doc["members"]) if doc else [])

    def session_state(s, uid):
        end = s["start_at"] + timedelta(minutes=s["duration_min"])
        if s["status"] == "cancelled":
            return "cancelled"
        if end <= now():
            return "ended"
        if s["start_at"] <= now():
            return "in_progress"
        others_going = [k for k, v in (s.get("rsvps") or {}).items() if v == "going" and k != str(s["creator_id"])]
        return "confirmed" if others_going else "awaiting"

    def serialize_session(s, uid, people, members):
        rsvps = s.get("rsvps") or {}
        checkins = s.get("checkins") or {}
        return {
            "id": str(s["_id"]),
            "thread_type": s["thread_type"],
            "thread_id": str(s["thread_id"]),
            "title": s["title"],
            "course": s.get("course", ""),
            "agenda": s.get("agenda", []),
            "start_at": iso(s["start_at"]),
            "end_at": iso(s["start_at"] + timedelta(minutes=s["duration_min"])),
            "duration_min": s["duration_min"],
            "location": s.get("location", ""),
            "link": s.get("link", ""),
            "status": s["status"],
            "state": session_state(s, uid),
            "creator_id": str(s["creator_id"]),
            "is_creator": s["creator_id"] == uid,
            "my_rsvp": rsvps.get(str(uid), "pending"),
            "participants": [
                public_user(people.get(m)) | {"rsvp": rsvps.get(str(m), "pending"), "checked_in": str(m) in checkins}
                for m in members
            ],
            "my_checkin": checkins.get(str(uid)) and {
                "attended": checkins[str(uid)]["attended"],
                "note": checkins[str(uid)].get("note", ""),
            },
            "updated_at": iso(s.get("updated_at")),
        }

    def validate_session_fields(data, partial=False):
        """Return (fields, error_message)."""
        fields = {}
        if not partial or "title" in data:
            title = " ".join(get_str(data, "title", 80).split())
            if not title:
                return None, "Give the session a title, e.g. the course or topic"
            fields["title"] = title
        if "course" in data:
            fields["course"] = get_str(data, "course", 30)
        if "agenda" in data:
            agenda = data.get("agenda")
            if not isinstance(agenda, list) or len(agenda) > 10 or not all(isinstance(a, str) for a in agenda):
                return None, "Agenda can have up to 10 items"
            fields["agenda"] = [a.strip()[:120] for a in agenda if a.strip()]
        if not partial or "start_at" in data:
            start = parse_time(data.get("start_at"))
            if not start:
                return None, "Choose a valid date and time"
            if start < now() - timedelta(minutes=5):
                return None, "Choose a time in the future"
            if start > now() + timedelta(days=180):
                return None, "Sessions can be planned up to 6 months ahead"
            fields["start_at"] = start
        if not partial or "duration_min" in data:
            try:
                duration = int(data.get("duration_min", 60))
            except (TypeError, ValueError):
                return None, "Duration must be a number of minutes"
            if not SESSION_MIN_MINUTES <= duration <= SESSION_MAX_MINUTES:
                return None, "Sessions can last from 15 minutes to 8 hours"
            fields["duration_min"] = duration
        if not partial or "location" in data:
            fields["location"] = get_str(data, "location", 120)
        if "link" in data:
            link = get_str(data, "link", 300)
            if link and not re.match(r"^https://[^\s<>\"']+$", link):
                return None, "Meeting links must start with https://"
            fields["link"] = link
        if not partial and not fields.get("location") and not fields.get("link"):
            return None, "Add a place on campus or a meeting link"
        return fields, None

    def get_session_for(sid, uid):
        oid = parse_object_id(sid)
        s = sessions.find_one({"_id": oid}) if oid else None
        if not s:
            return None, None, error("Session not found", 404)
        doc, members = load_thread(s["thread_type"], str(s["thread_id"]), uid)
        if not doc:
            return None, None, error("Session not found", 404)
        return s, members, None

    def cancel_thread_sessions(thread_type, thread_id, uid):
        sessions.update_many(
            {"thread_type": thread_type, "thread_id": thread_id, "status": "scheduled", "start_at": {"$gt": now()}},
            {"$set": {"status": "cancelled", "cancelled_by": uid, "updated_at": now()}},
        )

    def fmt_when(dt):
        # Campus time for system messages and emails.
        taipei = dt + timedelta(hours=8)
        return taipei.strftime("%a %b %d, %H:%M") + " (Taipei)"

    @bp.route("/sessions", methods=["POST"])
    @login_required
    def create_session():
        uid = me()
        data = json_body()
        thread_type = get_str(data, "thread_type", 20)
        doc, members = load_thread(thread_type, get_str(data, "thread_id", 40), uid)
        if not doc:
            return error("Conversation not found", 404)
        if thread_type == "connection" and is_blocked_between(*members):
            return error("You can't plan sessions with this student", 403)
        fields, msg = validate_session_fields(data)
        if msg:
            return error(msg)
        if sessions.count_documents({"creator_id": uid, "created_at": {"$gt": now() - timedelta(days=1)}}) >= 20:
            return error("You've planned a lot of sessions today. Try again tomorrow.", 429)
        at = now()
        s = {
            **fields,
            "agenda": fields.get("agenda", []),
            "course": fields.get("course", ""),
            "link": fields.get("link", ""),
            "thread_type": thread_type,
            "thread_id": doc["_id"],
            "creator_id": uid,
            "status": "scheduled",
            "rsvps": {str(m): ("going" if m == uid else "pending") for m in members},
            "checkins": {},
            "created_at": at,
            "updated_at": at,
        }
        s["_id"] = sessions.insert_one(s).inserted_id
        creator = students.find_one({"_id": uid}, {"name": 1})
        post_message(thread_type, doc, None, f"{creator['name']} proposed a session: {s['title']} on {fmt_when(s['start_at'])}.", kind="system")
        for m in members:
            if m != uid:
                notify(m, f"Study session proposed: {s['title']}", f"{creator['name']} proposed a study session",
                       f"{s['title']} on {fmt_when(s['start_at'])}" + (f" at {s['location']}" if s.get("location") else "")
                       + ". Let them know if you can make it.", f"/sessions/{s['_id']}")
        people = users_by_id(members)
        return jsonify({"session": serialize_session(s, uid, people, members)}), 201

    @bp.route("/sessions", methods=["GET"])
    @login_required
    def list_sessions():
        uid = me()
        conns, grps = my_threads(uid)
        threads = [{"thread_type": "connection", "thread_id": c["_id"]} for c in conns]
        threads += [{"thread_type": "group", "thread_id": g["_id"]} for g in grps]
        if not threads:
            return jsonify({"sessions": []})
        member_map = {c["_id"]: [c["requester_id"], c["recipient_id"]] for c in conns}
        member_map.update({g["_id"]: list(g["members"]) for g in grps})
        rows = list(sessions.find({"$or": threads}).sort("start_at", 1).limit(300))
        people = users_by_id([m for ms in member_map.values() for m in ms])
        return jsonify({"sessions": [serialize_session(s, uid, people, member_map[s["thread_id"]]) for s in rows]})

    @bp.route("/sessions/<sid>", methods=["GET"])
    @login_required
    def get_session(sid):
        uid = me()
        s, members, err = get_session_for(sid, uid)
        if err:
            return err
        return jsonify({"session": serialize_session(s, uid, users_by_id(members), members)})

    @bp.route("/sessions/<sid>/rsvp", methods=["POST"])
    @login_required
    def rsvp_session(sid):
        uid = me()
        s, members, err = get_session_for(sid, uid)
        if err:
            return err
        response = get_str(json_body(), "response", 10)
        if response not in ("going", "declined"):
            return error("Choose going or can't make it")
        if session_state(s, uid) in ("cancelled", "ended"):
            return error("This session is no longer open", 409)
        res = sessions.update_one({"_id": s["_id"], "status": "scheduled"},
                                  {"$set": {f"rsvps.{uid}": response, "updated_at": now()}})
        if res.matched_count == 0:
            return error("This session is no longer open", 409)
        s = sessions.find_one({"_id": s["_id"]})
        return jsonify({"session": serialize_session(s, uid, users_by_id(members), members)})

    @bp.route("/sessions/<sid>", methods=["PATCH"])
    @login_required
    def update_session(sid):
        """Change details. Changing the time, length or place asks everyone to confirm again."""
        uid = me()
        s, members, err = get_session_for(sid, uid)
        if err:
            return err
        if session_state(s, uid) in ("cancelled", "ended"):
            return error("This session can't be changed any more", 409)
        if s["thread_type"] == "group" and s["creator_id"] != uid:
            return error("Only the person who planned a group session can change it", 403)
        data = json_body()
        fields, msg = validate_session_fields(data, partial=True)
        if msg:
            return error(msg)
        if not fields:
            return error("Nothing to change")
        rescheduled = any(k in fields and fields[k] != s.get(k) for k in ("start_at", "duration_min", "location"))
        update = {**fields, "updated_at": now()}
        if rescheduled:
            update["rsvps"] = {str(m): ("going" if m == uid else "pending") for m in members}
        res = sessions.update_one({"_id": s["_id"], "status": "scheduled", "updated_at": s["updated_at"]}, {"$set": update})
        if res.matched_count == 0:
            return error("Someone else just changed this session. Refresh and try again.", 409)
        s = sessions.find_one({"_id": s["_id"]})
        if rescheduled:
            thread, _ = load_thread_any(s["thread_type"], s["thread_id"])
            who = students.find_one({"_id": uid}, {"name": 1})
            post_message(s["thread_type"], thread, None,
                         f"{who['name']} moved {s['title']} to {fmt_when(s['start_at'])}. Please confirm again.", kind="system")
        return jsonify({"session": serialize_session(s, uid, users_by_id(members), members)})

    @bp.route("/sessions/<sid>/cancel", methods=["POST"])
    @login_required
    def cancel_session(sid):
        uid = me()
        s, members, err = get_session_for(sid, uid)
        if err:
            return err
        if s["thread_type"] == "group" and s["creator_id"] != uid:
            return error("Only the person who planned a group session can cancel it", 403)
        if s["status"] == "cancelled":
            return jsonify({"session": serialize_session(s, uid, users_by_id(members), members)})
        if session_state(s, uid) == "ended":
            return error("This session already happened", 409)
        sessions.update_one({"_id": s["_id"]}, {"$set": {"status": "cancelled", "cancelled_by": uid, "updated_at": now()}})
        s = sessions.find_one({"_id": s["_id"]})
        thread, _ = load_thread_any(s["thread_type"], s["thread_id"])
        who = students.find_one({"_id": uid}, {"name": 1})
        post_message(s["thread_type"], thread, None, f"{who['name']} cancelled {s['title']} ({fmt_when(s['start_at'])}).", kind="system")
        return jsonify({"session": serialize_session(s, uid, users_by_id(members), members)})

    @bp.route("/sessions/<sid>/checkin", methods=["POST"])
    @login_required
    def checkin_session(sid):
        uid = me()
        s, members, err = get_session_for(sid, uid)
        if err:
            return err
        if s["status"] == "cancelled":
            return error("This session was cancelled", 409)
        if s["start_at"] > now():
            return error("You can check in once the session has started", 409)
        data = json_body()
        attended = data.get("attended")
        if not isinstance(attended, bool):
            return error("Say whether the session happened")
        sessions.update_one({"_id": s["_id"]}, {"$set": {
            f"checkins.{uid}": {"attended": attended, "note": get_str(data, "note", 500), "at": now()},
            "updated_at": now(),
        }})
        s = sessions.find_one({"_id": s["_id"]})
        return jsonify({"session": serialize_session(s, uid, users_by_id(members), members)})

    # ------------------------------------------------------------------ groups

    def serialize_group(g, uid, people):
        return {
            "id": str(g["_id"]),
            "name": g["name"],
            "course": g.get("course", ""),
            "description": g.get("description", ""),
            "member_count": len(g["members"]),
            "max_members": g.get("max_members", GROUP_MAX_MEMBERS),
            "members": [public_user(people.get(m)) | {"is_owner": m == g["owner_id"]} for m in g["members"]],
            "is_owner": g["owner_id"] == uid,
            "invite_code": g["invite_code"] if uid in g["members"] else None,
            "last_message_at": iso(g.get("last_message_at") or g["created_at"]),
            "unread": unread_count("group", g, uid) if uid in g["members"] else 0,
        }

    def new_invite_code():
        return secrets.token_urlsafe(6).replace("-", "a").replace("_", "b")[:8]

    @bp.route("/groups", methods=["GET"])
    @login_required
    def list_groups():
        uid = me()
        rows = list(groups.find({"members": uid, "archived": {"$ne": True}}).sort("created_at", -1))
        people = users_by_id([m for g in rows for m in g["members"]])
        return jsonify({"groups": [serialize_group(g, uid, people) for g in rows]})

    @bp.route("/groups", methods=["POST"])
    @login_required
    def create_group():
        uid = me()
        data = json_body()
        name = " ".join(get_str(data, "name", 60).split())
        if not name:
            return error("Give your group a name")
        try:
            max_members = int(data.get("max_members", 8))
        except (TypeError, ValueError):
            return error("Group size must be a number")
        if not 2 <= max_members <= GROUP_MAX_MEMBERS:
            return error(f"Groups can have 2 to {GROUP_MAX_MEMBERS} members")
        if groups.count_documents({"members": uid, "archived": {"$ne": True}}) >= GROUPS_PER_USER:
            return error(f"You can be in up to {GROUPS_PER_USER} groups")
        at = now()
        g = {
            "name": name,
            "course": get_str(data, "course", 30),
            "description": get_str(data, "description", 300),
            "owner_id": uid,
            "members": [uid],
            "max_members": max_members,
            "invite_code": new_invite_code(),
            "archived": False,
            "reads": {},
            "created_at": at,
            "updated_at": at,
        }
        for _ in range(5):
            try:
                g["_id"] = groups.insert_one(g).inserted_id
                break
            except DuplicateKeyError:
                g["invite_code"] = new_invite_code()
                g.pop("_id", None)
        else:
            return error("Could not create the group. Try again.", 500)
        post_message("group", g, None, f"Group created. Share the invite code {g['invite_code']} with classmates.", kind="system")
        return jsonify({"group": serialize_group(g, uid, users_by_id([uid]))}), 201

    @bp.route("/groups/preview", methods=["GET"])
    @login_required
    def preview_group():
        uid = me()
        code = (request.args.get("code") or "").strip()[:20]
        g = groups.find_one({"invite_code": code, "archived": {"$ne": True}}) if code else None
        if not g:
            return error("No group found with that invite code", 404)
        return jsonify({"group": {
            "id": str(g["_id"]),
            "name": g["name"],
            "course": g.get("course", ""),
            "description": g.get("description", ""),
            "member_count": len(g["members"]),
            "max_members": g.get("max_members", GROUP_MAX_MEMBERS),
            "is_member": uid in g["members"],
        }})

    @bp.route("/groups/join", methods=["POST"])
    @login_required
    def join_group():
        uid = me()
        code = get_str(json_body(), "code", 20)
        g = groups.find_one({"invite_code": code, "archived": {"$ne": True}}) if code else None
        if not g:
            return error("No group found with that invite code", 404)
        if uid in g["members"]:
            return jsonify({"group": serialize_group(g, uid, users_by_id(g["members"]))})
        if groups.count_documents({"members": uid, "archived": {"$ne": True}}) >= GROUPS_PER_USER:
            return error(f"You can be in up to {GROUPS_PER_USER} groups")
        if any(is_blocked_between(uid, m) for m in g["members"]):
            return error("You can't join this group", 403)
        max_members = g.get("max_members", GROUP_MAX_MEMBERS)
        # Atomic: only add if not already a member and the group still has room.
        res = groups.update_one(
            {"_id": g["_id"], "members": {"$ne": uid}, f"members.{max_members - 1}": {"$exists": False}, "archived": {"$ne": True}},
            {"$push": {"members": uid}, "$set": {"updated_at": now()}},
        )
        g = groups.find_one({"_id": g["_id"]})
        if res.modified_count == 0 and uid not in g["members"]:
            return error("This group is full", 409)
        if res.modified_count:
            who = students.find_one({"_id": uid}, {"name": 1})
            post_message("group", g, None, f"{who['name']} joined the group.", kind="system")
        return jsonify({"group": serialize_group(g, uid, users_by_id(g["members"]))})

    @bp.route("/groups/<gid>/leave", methods=["POST"])
    @login_required
    def leave_group(gid):
        uid = me()
        g, _ = load_thread("group", gid, uid)
        if not g:
            return error("Group not found", 404)
        remaining = [m for m in g["members"] if m != uid]
        update = {"$pull": {"members": uid}, "$set": {"updated_at": now()}}
        if not remaining:
            update["$set"]["archived"] = True
        elif g["owner_id"] == uid:
            update["$set"]["owner_id"] = remaining[0]  # longest-standing member takes over
        groups.update_one({"_id": g["_id"]}, update)
        if remaining:
            who = students.find_one({"_id": uid}, {"name": 1})
            post_message("group", g, None, f"{who['name']} left the group.", kind="system")
        return jsonify({"ok": True})

    @bp.route("/groups/<gid>/remove", methods=["POST"])
    @login_required
    def remove_member(gid):
        uid = me()
        g, _ = load_thread("group", gid, uid)
        if not g:
            return error("Group not found", 404)
        if g["owner_id"] != uid:
            return error("Only the group owner can remove members", 403)
        target = parse_object_id(get_str(json_body(), "user_id", 40))
        if not target or target not in g["members"] or target == uid:
            return error("That student isn't a member you can remove")
        groups.update_one({"_id": g["_id"]}, {"$pull": {"members": target}, "$set": {"updated_at": now()}})
        return jsonify({"ok": True})

    @bp.route("/groups/<gid>/invite/reset", methods=["POST"])
    @login_required
    def reset_invite(gid):
        uid = me()
        g, _ = load_thread("group", gid, uid)
        if not g:
            return error("Group not found", 404)
        if g["owner_id"] != uid:
            return error("Only the group owner can change the invite code", 403)
        for _ in range(5):
            try:
                code = new_invite_code()
                groups.update_one({"_id": g["_id"]}, {"$set": {"invite_code": code, "updated_at": now()}})
                return jsonify({"invite_code": code})
            except DuplicateKeyError:
                continue
        return error("Could not change the code. Try again.", 500)

    # ---------------------------------------------------------------- activity

    @bp.route("/activity", methods=["GET"])
    @login_required
    def activity():
        """Small summary for nav badges and the dashboard."""
        uid = me()
        incoming = [expire_if_stale(c) for c in connections.find({"recipient_id": uid, "status": "pending", "active": True})]
        incoming = [c for c in incoming if c.get("active")]
        conns, grps = my_threads(uid)
        unread_threads = sum(1 for c in conns if unread_count("connection", c, uid)) + \
            sum(1 for g in grps if unread_count("group", g, uid))
        threads = [{"thread_type": "connection", "thread_id": c["_id"]} for c in conns] + \
                  [{"thread_type": "group", "thread_id": g["_id"]} for g in grps]
        next_session, needs_checkin, upcoming = None, 0, 0
        if threads:
            member_map = {c["_id"]: [c["requester_id"], c["recipient_id"]] for c in conns}
            member_map.update({g["_id"]: list(g["members"]) for g in grps})
            rows = list(sessions.find({"$or": threads, "status": "scheduled",
                                       "start_at": {"$gt": now() - timedelta(days=14)}}).sort("start_at", 1))
            for s in rows:
                state = session_state(s, uid)
                mine = (s.get("rsvps") or {}).get(str(uid))
                if state == "ended" and mine == "going" and str(uid) not in (s.get("checkins") or {}):
                    needs_checkin += 1
                elif state in ("awaiting", "confirmed", "in_progress") and mine != "declined":
                    upcoming += 1
                    if next_session is None:
                        members = member_map[s["thread_id"]]
                        next_session = serialize_session(s, uid, users_by_id(members), members)
        return jsonify({
            "incoming_requests": len(incoming),
            "unread_threads": unread_threads,
            "upcoming_sessions": upcoming,
            "needs_checkin": needs_checkin,
            "next_session": next_session,
        })

    app.register_blueprint(bp)
    return SimpleNamespace(blocked_ids=blocked_ids, connection_states=connection_states)
