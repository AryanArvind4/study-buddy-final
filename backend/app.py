from flask import Flask, request, jsonify, session
from flask_mail import Mail, Message
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from bson import ObjectId
from bson.errors import InvalidId
from werkzeug.exceptions import HTTPException
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from datetime import datetime, timedelta
from functools import wraps
import certifi
import hashlib
import hmac
import html
import re
import secrets
import threading
import requests

from social import init_social

load_dotenv()

IS_DEV = os.getenv("FLASK_ENV") == "development"

# Setup MongoDB connection (certificates are verified against certifi's CA bundle)
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI is not set")
print("🔄 Connecting to MongoDB...")

try:
    client = MongoClient(
        MONGO_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=20000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000
    )
    client.server_info()
    print("✅ MongoDB connected successfully!")
except Exception as e:
    print(f"❌ MongoDB connection failed: {type(e).__name__}")
    print("Check MONGO_URI credentials and MongoDB Atlas network access.")
    raise SystemExit(1)

# Use a separate database (e.g. MONGO_DB_NAME=study_partner_dev) when testing locally.
DB_NAME = os.getenv("MONGO_DB_NAME", "study_partner")
print(f"🗄️ Using database: {DB_NAME}")
db = client[DB_NAME]
students_collection = db["students"]
courses_collection = db["courses"]
otp_collection = db["otps"]

# Initialize Flask app
app = Flask(__name__)

# Exact list of frontend origins allowed to make credentialed requests.
# Override with ALLOWED_ORIGINS="https://a.com,https://b.com" (e.g. to add a Vercel preview URL).
DEFAULT_ALLOWED_ORIGINS = [
    "https://studybuddynthu.org",
    "https://www.studybuddynthu.org",
    "https://study-buddy-final-orcin.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
ALLOWED_ORIGINS = {
    o.strip().rstrip("/")
    for o in (os.getenv("ALLOWED_ORIGINS") or ",".join(DEFAULT_ALLOWED_ORIGINS)).split(",")
    if o.strip()
}

ADMIN_EMAILS = {
    e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()
}


def _apply_cors(response, origin):
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Max-Age'] = '3600'


@app.after_request
def add_cors_headers(response):
    response.headers['Vary'] = 'Origin'
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        _apply_cors(response, origin)
    return response


@app.before_request
def check_origin():
    origin = request.headers.get('Origin')
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        if origin in ALLOWED_ORIGINS:
            _apply_cors(response, origin)
        return response
    # CSRF protection: browsers always send Origin on cross-site state-changing requests,
    # so reject those that come from a site we don't trust.
    if request.method in ('POST', 'PUT', 'DELETE') and origin and origin not in ALLOWED_ORIGINS:
        return jsonify({"error": "Origin not allowed"}), 403

# Session configuration
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if not IS_DEV:
        raise RuntimeError("SECRET_KEY is not set. Set it to a long random value in the environment.")
    SECRET_KEY = secrets.token_hex(32)
    print("⚠️ SECRET_KEY not set; using a temporary key (development only)")
app.config["SECRET_KEY"] = SECRET_KEY
app.config["SESSION_COOKIE_HTTPONLY"] = True  # Prevent JavaScript access to session cookie
if IS_DEV:
    # localhost runs on plain HTTP, where browsers drop Secure cookies.
    # localhost:3000 -> localhost:5001 counts as same-site, so Lax works.
    app.config["SESSION_COOKIE_SECURE"] = False
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
else:
    app.config["SESSION_COOKIE_SECURE"] = True  # Only send cookies over HTTPS
    app.config["SESSION_COOKIE_SAMESITE"] = "None"  # Frontend and backend are on different sites
app.config["SESSION_COOKIE_DOMAIN"] = None  # Allow cookies from any domain
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
app.config["SESSION_COOKIE_PATH"] = "/"  # Cookies available for all paths
app.config["SESSION_REFRESH_EACH_REQUEST"] = True  # Refresh session on each request

# Email configuration for OTP verification
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', 'your-email@gmail.com')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', 'your-app-password')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_USERNAME', 'your-email@gmail.com')

# Initialize Flask-Mail
print("📧 Initializing Flask-Mail...")
mail = Mail(app)
print("✅ Flask-Mail initialized - OTP will be sent via email")

# Legacy fixed lists for UI fallback
STUDY_SPOTS = [
    "Louisa Café",
    "Library",
    "XCB (小吃部)",
    "Moonlight Area",
    "In your dormitory room",
    "Education Building",
    "Starbucks (In front of the campus main gate)",
]

STUDY_TIMES = [
    "Early Morning (6-9 AM)",
    "Morning (9-12 PM)",
    "Afternoon (12-3 PM)",
    "Late Afternoon (3-6 PM)",
    "Evening (6-9 PM)",
    "Night (9-12 AM)",
    "Weekend Morning",
    "Weekend Evening",
]

COLLEGE_DEPARTMENTS = {
    "College of Science": [
        "Department of Mathematics",
        "Department of Physics", 
        "Department of Chemistry",
        "Institute of Statistics",
        "Institute of Astronomy",
        "Interdisciplinary Program of Sciences",
        "Institute of Computational and Modeling Science"
    ],
    "College of Engineering": [
        "Department of Chemical Engineering",
        "Department of Power Mechanical Engineering", 
        "Department of Materials Science and Engineering",
        "Department of Industrial Engineering and Engineering Management",
        "Institute / Program of Nanoengineering and Microsystems",
        "Biomedical Engineering (institute / program)",
        "Interdisciplinary Program of Engineering",
        "Dual Master Program for Global Operation Management"
    ],
    "College of Nuclear Science": [
        "Department of Engineering and System Science",
        "Department of Biomedical Engineering and Environmental Science",
        "Institute of Nuclear Engineering and Science",
        "Institute of Analytical and Environmental Sciences",
        "Interdisciplinary Program of Nuclear Science",
        "International Ph.D. Program in Environmental Science and Technology (UST)"
    ],
    "College of Humanities and Social Sciences": [
        "Department of Chinese Literature",
        "Department of Foreign Languages and Literature",
        "Institute of Philosophy",
        "Institute of History",
        "Institute of Anthropology",
        "Institute of Sociology",
        "Institute of Linguistics",
        "Institute of Taiwan Literature",
        "Graduate Program on Taiwan Studies",
        "International Master's Program in Inter-Asia Cultural Studies (UST)",
        "Master's Program in Chinese Language and Culture",
        "Interdisciplinary Program of Humanities and Social Sciences"
    ],
    "College of Life Sciences and Medicine": [
        "Department of Life Science",
        "Department of Medical Science",
        "Interdisciplinary Program of Life Sciences and Medicine",
        "Institute of Molecular and Cellular Biology",
        "Institute of Molecular Medicine",
        "Institute of Bioinformatics and Structural Biology",
        "Institute of Biotechnology",
        "Institute of Systems Neuroscience",
        "International Ph.D. Program in Interdisciplinary Neuroscience (UST)",
        "Precision Medicine Ph.D. Program"
    ],
    "College of Electrical Engineering and Computer Science": [
        "Department of Electrical Engineering",
        "Department of Computer Science",
        "Interdisciplinary Program of Electrical Engineering & Computer Science",
        "Institute of Electronics Engineering",
        "Institute of Communications Engineering",
        "Institute of Information Systems and Applications",
        "Institute of Photonics Technologies",
        "International Ph.D. Program in Photonics (UST)"
    ],
    "College of Technology Management": [
        "Department of Economics",
        "Department of Quantitative Finance",
        "Interdisciplinary Program of Management and Technology",
        "Institute of Technology Management",
        "Institute of Law for Science and Technology",
        "Institute of Service Science",
        "EMBA",
        "EMBA Shenzhen",
        "MBA",
        "MFB",
        "MPM",
        "IMBA"
    ],
    "College of Education": [
        "Department of Education and Learning Technology",
        "Department of Early Childhood Education",
        "Department of Special Education",
        "Department of Educational Psychology and Counseling",
        "Department of Kinesiology",
        "Department of English Instruction",
        "Department of Environmental and Cultural Resources",
        "Interdisciplinary Program of Education",
        "Institute of Taiwan Languages and Language Teaching",
        "Graduate Institute of Mathematics and Science Education",
        "Institute of Learning Sciences and Technologies",
        "Center for English Education"
    ],
    "College of Arts": [
        "Department of Music",
        "Department of Arts and Design",
        "Interdisciplinary Program of Technology and Art"
    ],
    "Taipei School of Economics and Political Science (TSE)": [
        "Taipei School of Economics and Political Science"
    ],
    "College of Semiconductor Research": [
        "College of Semiconductor Research"
    ],
    "Tsing Hua College": [
        "Tsing Hua College (residential / interdisciplinary / liberal arts)",
        "Tsing Hua Interdisciplinary Program",
        "Tsing Hua College International Bachelor's Program",
        "Residential College (within Tsing Hua College)"
    ],
    "Other Centers": [
        "Center for General Education",
        "Center for Teacher Education", 
        "Center for Language Education",
        "Research Center for Technology and Art",
        "Arts Center",
        "Military Instructors' Office",
        "Physical Education Office"
    ]
}

# Authentication decorator


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)

    return decorated_function


# Helper functions


def get_all_unique_features():
    all_courses = set()
    all_spots = set()
    all_times = set()

    for student in students_collection.find():
        all_courses.update(student.get("course_ids", []))
        all_spots.update(student.get("study_spots", []))
        all_times.update(student.get("study_times", []))
    return list(all_courses), list(all_spots), list(all_times)


def encode_features(student, all_courses, all_spots, all_times):
    vector = []
    vector += [1 if c in student.get("course_ids", []) else 0 for c in all_courses]
    vector += [1 if s in student.get("study_spots", []) else 0 for s in all_spots]
    vector += [1 if t in student.get("study_times", []) else 0 for t in all_times]
    return np.array(vector)


def calculate_weighted_similarity(
    vector1, vector2, all_courses, all_spots, course_weight=3.0, spot_weight=1.0, time_weight=1.5
):
    len_courses = len(all_courses)
    len_spots = len(all_spots)

    weighted_v1 = vector1.copy().astype(float)
    weighted_v2 = vector2.copy().astype(float)

    weighted_v1[:len_courses] *= course_weight
    weighted_v2[:len_courses] *= course_weight

    weighted_v1[len_courses : len_courses + len_spots] *= spot_weight
    weighted_v2[len_courses : len_courses + len_spots] *= spot_weight

    weighted_v1[len_courses + len_spots :] *= time_weight
    weighted_v2[len_courses + len_spots :] *= time_weight

    return cosine_similarity([weighted_v1], [weighted_v2])[0][0]


def is_valid_nthu_email(email):
    """Check if email is a valid NTHU email address"""
    if not email:
        return False
    email = email.strip().lower()
    return email.endswith('.nthu.edu.tw')


MATCH_LIMIT = 6
OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5            # wrong guesses allowed per code
OTP_RESEND_COOLDOWN = timedelta(seconds=60)
OTP_MAX_SENDS_PER_HOUR = 5


def json_body():
    """Return the request's JSON object, or {} if missing or not an object."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def get_str(data, key, max_len=200):
    """Read a string field; anything else (dicts, lists, numbers) becomes ''."""
    value = data.get(key)
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_len]


def parse_object_id(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def validate_course_ids(course_ids):
    if not isinstance(course_ids, list) or len(course_ids) > 30:
        return False
    return all(isinstance(c, str) and 0 < len(c.strip()) <= 30 for c in course_ids)


def public_profile(student):
    """Fields of a student that other students may see (no email)."""
    return {
        "student_id": str(student["_id"]),
        "name": student.get("name", ""),
        "college": student.get("college", ""),
        "department": student.get("department", ""),
        "course_ids": student.get("course_ids", []),
        "study_spots": student.get("study_spots", []),
        "study_times": student.get("study_times", []),
    }


def generate_otp():
    """Generate a 6-digit OTP using a cryptographically secure source"""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(email, otp):
    return hmac.new(app.config["SECRET_KEY"].encode(), f"{email}:{otp}".encode(), hashlib.sha256).hexdigest()


def send_otp_email_async(app_instance, email, otp):
    """Send OTP via email asynchronously in a separate thread with app context"""
    import socket
    import smtplib
    
    def send_email():
        print(f"🔄 Background email thread started for {email}", flush=True)
        try:
            with app_instance.app_context():
                print(f"🔗 Connecting to Gmail SMTP server...", flush=True)
                
                # Set socket timeout to prevent hanging
                socket.setdefaulttimeout(30)
                
                msg = Message(
                    subject='StudyBuddy - Email Verification Code',
                    recipients=[email],
                    html=f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background-color: #6366f1; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">StudyBuddy</h1>
                                <p style="margin: 10px 0 0 0; font-size: 16px;">Email Verification</p>
                            </div>
                            
                            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                                <h2 style="color: #333; margin-top: 0;">Verify Your NTHU Email</h2>
                                
                                <p style="color: #666; font-size: 16px; line-height: 1.5;">
                                    Thank you for joining StudyBuddy! To complete your registration, please use the verification code below:
                                </p>
                                
                                <div style="background-color: white; border: 2px solid #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                                    <span style="font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 5px;">{otp}</span>
                                </div>
                                
                                <p style="color: #666; font-size: 14px; line-height: 1.5;">
                                    This code will expire in <strong>10 minutes</strong>. If you didn't request this verification, please ignore this email.
                                </p>
                                
                                <hr style="border: none; border-top: 1px solid #e9ecef; margin: 25px 0;">
                                
                                <p style="color: #999; font-size: 12px; text-align: center;">
                                    This is an automated message from StudyBuddy. Please do not reply to this email.
                                </p>
                            </div>
                        </body>
                    </html>
                    """
                )
                
                print(f"📧 Sending email via Flask-Mail...", flush=True)
                mail.send(msg)
                print(f"✅ Email sent successfully to {email}!", flush=True)
                
        except socket.timeout:
            print(f"❌ Email sending timed out after 30s for {email}", flush=True)
        except smtplib.SMTPAuthenticationError as e:
            print(f"❌ SMTP Authentication failed: {str(e)}", flush=True)
            print(f"⚠️ Check your MAIL_USERNAME and MAIL_PASSWORD in Render env vars", flush=True)
        except smtplib.SMTPException as e:
            print(f"❌ SMTP Error: {str(e)}", flush=True)
        except Exception as e:
            print(f"❌ Unexpected error sending email: {str(e)}", flush=True)
            import traceback
            traceback.print_exc()
        finally:
            print(f"🏁 Background email thread finished for {email}", flush=True)
    
    # Start email sending in background thread
    thread = threading.Thread(target=send_email)
    thread.daemon = True
    thread.start()

def send_otp_email(email, otp):
    """Send the OTP by email in the background. The code is only printed in development."""
    if IS_DEV:
        print(f"\n🔑 [DEV ONLY] Login code for {email}: {otp}\n", flush=True)
        if not os.getenv("MAIL_USERNAME") or not os.getenv("MAIL_PASSWORD"):
            return True  # no mail credentials locally; use the printed code
    print("📤 Sending verification email in background...", flush=True)
    send_otp_email_async(app, email, otp)
    return True


def store_otp(email, otp):
    """Store a new OTP (hashed). Returns an error message if the email is rate-limited."""
    now = datetime.utcnow()
    existing = otp_collection.find_one({"email": email})
    window_start = now
    send_count = 1
    if existing:
        if existing.get("created_at") and now - existing["created_at"] < OTP_RESEND_COOLDOWN:
            return "Please wait a minute before requesting another code."
        if existing.get("window_start") and now - existing["window_start"] < timedelta(hours=1):
            window_start = existing["window_start"]
            send_count = existing.get("send_count", 0) + 1
            if send_count > OTP_MAX_SENDS_PER_HOUR:
                return "Too many codes requested. Please try again in an hour."
    otp_collection.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "otp_hash": hash_otp(email, otp),
                "created_at": now,
                "expires_at": now + OTP_TTL,
                "attempts": 0,
                "verified": False,
                "window_start": window_start,
                "send_count": send_count,
            },
            "$unset": {"otp": ""},
        },
        upsert=True
    )
    return None


def verify_otp(email, otp):
    """Check an OTP. Wrong guesses are counted; the code is burned after too many."""
    if not re.fullmatch(r"\d{6}", otp):
        return False
    otp_doc = otp_collection.find_one({
        "email": email,
        "verified": False,
        "expires_at": {"$gt": datetime.utcnow()},
    })
    if not otp_doc or otp_doc.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        return False
    if not hmac.compare_digest(otp_doc.get("otp_hash", ""), hash_otp(email, otp)):
        otp_collection.update_one({"_id": otp_doc["_id"]}, {"$inc": {"attempts": 1}})
        return False
    # Only one request can flip verified False -> True for this code.
    result = otp_collection.update_one(
        {"_id": otp_doc["_id"], "verified": False},
        {"$set": {"verified": True, "expires_at": datetime.utcnow() + OTP_TTL}},
    )
    return result.modified_count == 1


def consume_verified_otp(email):
    """Use up a verified OTP for this email. Returns True once per verification.

    The browser that verified the code must be the one using it (checked via the
    signed session), so nobody else can race to use someone's verified code.
    """
    if session.get("otp_verified_email") != email:
        return False
    doc = otp_collection.find_one_and_delete({
        "email": email,
        "verified": True,
        "expires_at": {"$gt": datetime.utcnow()},
    })
    session.pop("otp_verified_email", None)
    return doc is not None


def clean_student_data(data):
    """Validate registration input and return (student_doc, error)."""
    name = " ".join(get_str(data, "name", 80).split())  # also removes newlines
    email = get_str(data, "email").lower()
    college = get_str(data, "college")
    department = get_str(data, "department")
    course_ids = data.get("course_ids")
    study_spots = data.get("study_spots")
    study_times = data.get("study_times")

    if not name:
        return None, "Name is required"
    if not is_valid_nthu_email(email):
        return None, "Please use a valid NTHU email address ending with .nthu.edu.tw"
    if college not in COLLEGE_DEPARTMENTS:
        return None, "Invalid college selected"
    if department not in COLLEGE_DEPARTMENTS[college]:
        return None, "Invalid department for selected college"
    if not validate_course_ids(course_ids) or not course_ids:
        return None, "Please select between 1 and 30 courses"
    if not isinstance(study_spots, list) or not study_spots or any(s not in STUDY_SPOTS for s in study_spots):
        return None, "Please select valid study spots"
    if not isinstance(study_times, list) or not study_times or any(t not in STUDY_TIMES for t in study_times):
        return None, "Please select valid study times"

    return {
        "name": name,
        "email": email,
        "college": college,
        "department": department,
        "course_ids": list(dict.fromkeys(c.strip() for c in course_ids)),
        "study_spots": list(dict.fromkeys(study_spots)),
        "study_times": list(dict.fromkeys(study_times)),
    }, None


# Authentication routes


@app.route("/login", methods=["POST"])
def login():
    data = json_body()
    email = get_str(data, "email").lower()

    if not is_valid_nthu_email(email):
        return jsonify({"error": "Please use a valid NTHU email address ending with .nthu.edu.tw"}), 401

    user = students_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "No account found with this NTHU email. Please register first."}), 401

    # The server, not the frontend, decides whether the email was verified.
    if not consume_verified_otp(email):
        return jsonify({"error": "Please verify your email with the code we sent you."}), 401

    session.clear()  # drop any pre-login session data
    session.permanent = True  # Make session persistent (better for mobile)
    session["user_id"] = str(user["_id"])
    session["user_email"] = user["email"]
    session["user_name"] = user["name"]
    return jsonify(
        {"message": "Login successful", "user_id": session["user_id"], "name": session["user_name"]}
    )


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"})


@app.route("/me", methods=["GET"])
@login_required
def me():
    try:
        user_id = session.get("user_id")
        user = students_collection.find_one({"_id": ObjectId(user_id)})
        if user:
            user["_id"] = str(user["_id"])
            return jsonify(user)
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        print(f"Error in /me: {e}")
        return jsonify({"error": "Error fetching user data"}), 500


# Main endpoints


@app.route("/")
def home():
    return jsonify(
        {
            "message": "Welcome to the Study Partner Finder!",
            "endpoints": {
                "register": "POST /register",
                "login": "POST /login",
                "logout": "POST /logout",
                "me": "GET /me",
                "stats": "GET /stats (requires auth)",
                "get_student": "GET /get_student/<student_id> (requires auth)",
                "get_matches": "GET /get_matches (requires auth)",
                "search_courses": "GET /search_courses?q=your_search_term",
                "get_options": "GET /get_options",
            },
        }
    )


@app.route("/get_options", methods=["GET"])
def get_options():
    return jsonify(
        {
            "college_departments": COLLEGE_DEPARTMENTS,
            "colleges": list(COLLEGE_DEPARTMENTS.keys()),
            "study_spots": STUDY_SPOTS,
            "study_times": STUDY_TIMES,
            "courses": [],
        }
    )


@app.route("/get_departments/<college>", methods=["GET"])
def get_departments(college):
    """Get departments for a specific college"""
    departments = COLLEGE_DEPARTMENTS.get(college, [])
    return jsonify({"departments": departments})


@app.route("/search_courses", methods=["GET"])
def search_courses():
    query = request.args.get("q", "").strip()
    if len(query) < 2:
        return jsonify({"courses": []})

    # Search across code and names with partial match, case insensitive
    regex = {"$regex": re.escape(query), "$options": "i"}
    filter_condition = {
        "$or": [{"科號": regex}, {"課程英文名稱": regex}, {"課程中文名稱": regex}]
    }

    courses = courses_collection.find(filter_condition, {"_id": 0, "科號": 1, "課程中文名稱": 1, "課程英文名稱": 1}).limit(
        50
    )

    results = []
    for c in courses:
        code = c.get("科號", "")
        name_en = c.get("課程英文名稱", "")
        name_zh = c.get("課程中文名稱", "")
        display = f"{code} - {name_en or name_zh}"
        results.append({"code": code, "name_en": name_en, "name_zh": name_zh, "display": display})

    return jsonify({"courses": results})


@app.route("/get_course_names", methods=["POST"])
def get_course_names():
    """Get course names for an array of course codes"""
    course_codes = json_body().get("course_codes", [])

    if not course_codes:
        return jsonify({"courses": {}})
    if not isinstance(course_codes, list) or len(course_codes) > 100:
        return jsonify({"error": "course_codes must be a list of up to 100 codes"}), 400
    course_codes = [c for c in course_codes if isinstance(c, str)]
    
    # Fetch course details from database
    courses = courses_collection.find(
        {"科號": {"$in": course_codes}},
        {"_id": 0, "科號": 1, "課程中文名稱": 1, "課程英文名稱": 1}
    )
    
    # Create a mapping of course code to name
    course_map = {}
    for c in courses:
        code = c.get("科號", "")
        name_en = c.get("課程英文名稱", "")
        name_zh = c.get("課程中文名稱", "")
        # Use English name if available, otherwise Chinese name
        display_name = name_en or name_zh or code
        course_map[code] = display_name
    
    return jsonify({"courses": course_map})


@app.route("/send_otp", methods=["POST"])
def send_otp():
    """Send OTP to email for verification"""
    email = get_str(json_body(), "email").lower()

    if not is_valid_nthu_email(email):
        return jsonify({"error": "Please use a valid NTHU email address ending with .nthu.edu.tw"}), 400

    otp = generate_otp()
    limit_error = store_otp(email, otp)
    if limit_error:
        return jsonify({"error": limit_error}), 429

    send_otp_email(email, otp)
    return jsonify({"message": "OTP sent successfully to your email"}), 200


@app.route("/verify_otp", methods=["POST"])
def verify_otp_endpoint():
    """Verify OTP for email"""
    data = json_body()
    email = get_str(data, "email").lower()
    otp = get_str(data, "otp", 10)

    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400

    if verify_otp(email, otp):
        # Remember in this browser's signed session which email it proved it owns.
        session["otp_verified_email"] = email
        return jsonify({"message": "Email verified successfully"}), 200
    return jsonify({"error": "Invalid or expired code. After 5 wrong tries, request a new one."}), 400


@app.route("/register", methods=["POST"])
def register():
    student, error = clean_student_data(json_body())
    if error:
        return jsonify({"error": error}), 400

    if students_collection.find_one({"email": student["email"]}):
        return jsonify({"error": "Email already registered"}), 400

    if not consume_verified_otp(student["email"]):
        return jsonify({"error": "Email not verified. Please verify your email first."}), 400

    student["created_at"] = datetime.utcnow()
    student["email_verified"] = True
    try:
        result = students_collection.insert_one(student)
        return jsonify({"message": "Registration successful", "student_id": str(result.inserted_id)}), 201
    except Exception as e:
        print(f"Error saving student: {e}")
        return jsonify({"error": "Error saving your profile. Please try again."}), 500


@app.route("/stats", methods=["GET"])
@login_required
def stats():
    return jsonify({"total_students": students_collection.count_documents({})})


@app.route("/get_student/<student_id>", methods=["GET"])
@login_required
def get_student(student_id):
    oid = parse_object_id(student_id)
    student = students_collection.find_one({"_id": oid}) if oid else None
    if not student:
        return jsonify({"error": "Student not found"}), 404
    return jsonify(public_profile(student))


@app.route("/get_matches", methods=["GET"])
@app.route("/get_matches/<student_id>", methods=["GET"])
@login_required
def get_matches(student_id=None):
    # Matches are only ever computed for the logged-in student.
    student_id = session["user_id"]
    if request.view_args.get("student_id") not in (None, student_id):
        return jsonify({"error": "You can only view your own matches"}), 403
    try:
        target = students_collection.find_one({"_id": ObjectId(student_id)})
        if not target:
            return jsonify({"error": "Student not found"}), 404
        all_courses, all_spots, all_times = get_all_unique_features()
        if not all_courses:
            return jsonify({"error": "No course data available"}), 400

        me_oid = ObjectId(student_id)
        hidden = social.blocked_ids(me_oid) | {me_oid}
        others = list(students_collection.find({"_id": {"$nin": list(hidden)}}, {"email": 0}))
        if not others:
            return jsonify({"message": "No other students available", "matches": []}), 200

        tf = encode_features(target, all_courses, all_spots, all_times)
        matches = []
        for student in others:
            sf = encode_features(student, all_courses, all_spots, all_times)
            similarity = calculate_weighted_similarity(tf, sf, all_courses, all_spots)
            matches.append(
                {
                    "student_id": str(student["_id"]),
                    "name": student["name"],
                    "department": student.get("department", ""),
                    "similarity": round(similarity * 100, 1),
                    "shared_courses": list(set(target.get("course_ids", [])) & set(student.get("course_ids", []))),
                    "shared_spots": list(set(target.get("study_spots", [])) & set(student.get("study_spots", []))),
                    "shared_times": list(set(target.get("study_times", [])) & set(student.get("study_times", []))),
                }
            )
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        top_matches = matches[:MATCH_LIMIT]
        states = social.connection_states(me_oid, [ObjectId(m["student_id"]) for m in top_matches])
        for m in top_matches:
            m["connection"] = states.get(ObjectId(m["student_id"]))
        return jsonify({"target_student": target["name"], "matches": top_matches, "total_checked": len(others)})
    except Exception as e:
        print(f"Error computing matches: {e}")
        return jsonify({"error": "Error computing matches"}), 500


@app.route("/update_courses_from_nthu", methods=["POST"])
@login_required
def update_courses_from_nthu():
    """Fetch latest course data from NTHU's live JSON endpoint and update database"""
    if session.get("user_email", "").lower() not in ADMIN_EMAILS:
        return jsonify({"error": "Admin access required"}), 403
    try:
        NTHU_COURSE_URL = "https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/OPENDATA/open_course_data.json"
        
        print(f"🔄 Fetching course data from NTHU...")
        response = requests.get(NTHU_COURSE_URL, timeout=30)
        
        if response.status_code != 200:
            return jsonify({"error": f"Failed to fetch from NTHU: {response.status_code}"}), 500
        
        # Parse JSON data
        courses_data = response.json()
        
        if not isinstance(courses_data, list):
            return jsonify({"error": "Invalid course data format from NTHU"}), 500
        
        # Process and update courses
        updated_count = 0
        new_count = 0
        
        for course in courses_data:
            if not isinstance(course, dict):
                continue
                
            # NTHU JSON uses Chinese field names
            course_code = course.get('科號', '').strip()
            course_name_zh = course.get('課程中文名稱', '').strip()
            course_name_en = course.get('課程英文名稱', '').strip()
            
            if not course_code or not course_name_zh:
                continue
            
            # Use the same Chinese field names that /search_courses and /get_course_names read
            course_doc = {
                "科號": course_code,
                "課程中文名稱": course_name_zh,
                "課程英文名稱": course_name_en,
                "updated_at": datetime.utcnow()
            }

            # Upsert course (update if exists, insert if new)
            result = courses_collection.update_one(
                {"科號": course_code},
                {"$set": course_doc},
                upsert=True
            )
            
            if result.upserted_id:
                new_count += 1
            elif result.modified_count > 0:
                updated_count += 1
        
        total_courses = courses_collection.count_documents({})
        
        print(f"✅ Course update complete: {new_count} new, {updated_count} updated, {total_courses} total")
        
        return jsonify({
            "message": "Courses updated successfully from NTHU",
            "new_courses": new_count,
            "updated_courses": updated_count,
            "total_courses": total_courses
        }), 200
        
    except requests.Timeout:
        return jsonify({"error": "Timeout fetching from NTHU server"}), 500
    except Exception as e:
        print(f"❌ Error updating courses: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Error updating courses"}), 500


@app.route("/update_profile", methods=["PUT"])
@login_required
def update_profile():
    """Update user profile - courses, study spots, and study times"""
    try:
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        data = json_body()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Build update document with only allowed fields
        update_fields = {}

        # Update courses if provided
        if "course_ids" in data:
            course_ids = data["course_ids"]
            if not validate_course_ids(course_ids):
                return jsonify({"error": "course_ids must be a list of up to 30 course codes"}), 400
            update_fields["course_ids"] = list(dict.fromkeys(c.strip() for c in course_ids))
        
        # Update study spots if provided
        if "study_spots" in data:
            study_spots = data["study_spots"]
            if not isinstance(study_spots, list):
                return jsonify({"error": "study_spots must be a list"}), 400
            if any(spot not in STUDY_SPOTS for spot in study_spots):
                return jsonify({"error": "Invalid study spot"}), 400
            update_fields["study_spots"] = study_spots
        
        # Update study times if provided
        if "study_times" in data:
            study_times = data["study_times"]
            if not isinstance(study_times, list):
                return jsonify({"error": "study_times must be a list"}), 400
            if any(t not in STUDY_TIMES for t in study_times):
                return jsonify({"error": "Invalid study time"}), 400
            update_fields["study_times"] = study_times
        
        if not update_fields:
            return jsonify({"error": "No valid fields to update"}), 400
        
        # Add updated_at timestamp
        update_fields["updated_at"] = datetime.utcnow()
        
        # Update the user in database
        result = students_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "User not found"}), 404
        
        # Fetch and return updated user data
        updated_user = students_collection.find_one({"_id": ObjectId(user_id)})
        updated_user["_id"] = str(updated_user["_id"])
        
        return jsonify({
            "message": "Profile updated successfully",
            "user": updated_user
        }), 200
        
    except Exception as e:
        print(f"Error updating profile: {e}")
        return jsonify({"error": "Error updating profile"}), 500


def send_email(to, subject, html_body, text_body):
    """Send a notification email in the background. In development without mail
    credentials it is only printed."""
    if IS_DEV and (not os.getenv("MAIL_USERNAME") or not os.getenv("MAIL_PASSWORD")):
        print(f"📧 [DEV ONLY] Email to {to}: {subject}", flush=True)
        return

    def worker():
        try:
            with app.app_context():
                mail.send(Message(subject=subject, recipients=[to], html=html_body, body=text_body))
        except Exception as e:
            print(f"❌ Notification email failed: {type(e).__name__}", flush=True)

    threading.Thread(target=worker, daemon=True).start()


SITE_URL = os.getenv("SITE_URL", "http://localhost:3000" if IS_DEV else "https://studybuddynthu.org").rstrip("/")

social = init_social(
    app, db,
    login_required=login_required,
    json_body=json_body,
    get_str=get_str,
    parse_object_id=parse_object_id,
    send_email=send_email,
    site_url=SITE_URL,
)


# Error handlers (details are logged, never sent to the client)
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(Exception)
def handle_exception(error):
    if isinstance(error, HTTPException):  # 400/405/415 etc. keep their own status
        return jsonify({"error": error.name}), error.code
    print(f"Unhandled exception: {error}")
    import traceback
    traceback.print_exc()
    return jsonify({"error": "An unexpected error occurred"}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=IS_DEV)
