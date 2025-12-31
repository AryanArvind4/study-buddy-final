from flask import Flask, request, jsonify, session
from flask_mail import Mail, Message
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from bson import ObjectId
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from datetime import datetime, timedelta
from functools import wraps
import re
import random
import string
import threading
import requests
import json

load_dotenv()

# Setup MongoDB connection
MONGO_URI = os.getenv("MONGO_URI")
print(f"🔄 Connecting to MongoDB Atlas...")
print(f"URI: {MONGO_URI[:50]}..." if MONGO_URI and len(MONGO_URI) > 50 else f"URI: {MONGO_URI}")

# Ensure URI has tlsAllowInvalidCertificates parameter for Render compatibility
if MONGO_URI:
    if "tlsAllowInvalidCertificates" not in MONGO_URI:
        separator = "&" if "?" in MONGO_URI else "?"
        MONGO_URI = f"{MONGO_URI}{separator}tls=true&tlsAllowInvalidCertificates=true"
        print("Added TLS parameters to connection string")

try:
    # Simplified connection - let the URI parameters handle all TLS settings
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=20000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000
    )
    # Test the connection
    client.server_info()
    print("✅ MongoDB connected successfully!")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    print("\n🔍 Troubleshooting:")
    print("1. Check MongoDB Atlas Network Access - whitelist 0.0.0.0/0")
    print("2. Verify credentials in MONGO_URI")
    print("3. Current URI format:", MONGO_URI[:80] if MONGO_URI else "None")
    exit(1)

db = client["study_partner"]
students_collection = db["students"]
courses_collection = db["courses"]
otp_collection = db["otps"]  # New collection for storing OTPs

# Initialize Flask app
app = Flask(__name__)

# Manual CORS handler - allows all Vercel domains and localhost
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    
    # Allow localhost, Vercel domains, and the new custom domain
    if origin and (
        origin.startswith('http://localhost:') or
        origin.startswith('http://127.0.0.1:') or
        '.vercel.app' in origin or
        'studybuddynthu.org' in origin
    ):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Max-Age'] = '3600'
        response.headers['Vary'] = 'Origin'
    
    return response

# Handle preflight OPTIONS requests
@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        origin = request.headers.get('Origin')
        
        if origin and (
            origin.startswith('http://localhost:') or
            origin.startswith('http://127.0.0.1:') or
            '.vercel.app' in origin or
            'studybuddynthu.org' in origin
        ):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Max-Age'] = '3600'
        
        return response

# Session configuration
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "b7328b8e99a64cc38dc6b1b52d4f553a")
app.config["SESSION_COOKIE_SECURE"] = True  # Only send cookies over HTTPS
app.config["SESSION_COOKIE_HTTPONLY"] = True  # Prevent JavaScript access to session cookie
app.config["SESSION_COOKIE_SAMESITE"] = "None"  # Allow cross-site cookies for CORS
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


def generate_otp():
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))


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
    """Send OTP via email - always prints to console and tries email async"""
    # Always print OTP to console/logs as backup
    print("\n" + "="*80, flush=True)
    print(f"📧 OTP for {email}: {otp}", flush=True)
    print(f"⏰ Valid for 10 minutes", flush=True)
    print("="*80 + "\n", flush=True)
    
    # Also write to stderr for visibility
    import sys
    sys.stderr.write(f"\n{'='*80}\n")
    sys.stderr.write(f"📧 OTP for {email}: {otp}\n")
    sys.stderr.write(f"⏰ Valid for 10 minutes\n")
    sys.stderr.write(f"{'='*80}\n\n")
    sys.stderr.flush()
    
    # Try to send email asynchronously (non-blocking) with proper app context
    if mail is not None:
        print(f"📤 Attempting to send email to {email} in background...", flush=True)
        send_otp_email_async(app, email, otp)
    
    # Always return True immediately (don't wait for email)
    return True


def store_otp(email, otp):
    """Store OTP in database with expiration"""
    expiry_time = datetime.utcnow() + timedelta(minutes=10)  # 10 minutes expiry
    otp_collection.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "otp": otp,
                "created_at": datetime.utcnow(),
                "expires_at": expiry_time,
                "verified": False
            }
        },
        upsert=True
    )


def verify_otp(email, otp):
    """Verify OTP for given email"""
    otp_doc = otp_collection.find_one({
        "email": email,
        "otp": otp,
        "verified": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if otp_doc:
        # Mark OTP as verified
        otp_collection.update_one(
            {"_id": otp_doc["_id"]},
            {"$set": {"verified": True}}
        )
        return True
    return False


def validate_student_data(data):
    required_fields = ["name", "email", "college", "department", "course_ids", "study_spots", "study_times"]

    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"
    
    # Validate NTHU email
    email = data.get("email", "").strip().lower()
    if not is_valid_nthu_email(email):
        return False, "Please use a valid NTHU email address ending with .nthu.edu.tw"
    
    # Only check email uniqueness on registration
    if students_collection.find_one({"email": email}):
        return False, "Email already registered"

    for field in ["course_ids", "study_spots", "study_times"]:
        if not isinstance(data[field], list) or len(data[field]) == 0:
            return False, f"{field} must be a non-empty list"

    # Validate college and department
    college = data.get("college")
    department = data.get("department")
    
    if college not in COLLEGE_DEPARTMENTS:
        return False, "Invalid college selected"
    
    if department not in COLLEGE_DEPARTMENTS[college]:
        return False, "Invalid department for selected college"

    return True, "Valid"


# Authentication routes


@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = (data.get("email") or "").strip().lower()
    
    # Validate NTHU email format
    if not is_valid_nthu_email(email):
        return jsonify({"error": "Please use a valid NTHU email address ending with .nthu.edu.tw"}), 401
    
    # Check if user exists
    user = students_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "No account found with this NTHU email. Please register first."}), 401
    
    # Create session and login (frontend should call this AFTER OTP verification)
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
        return jsonify({"error": f"Error fetching user data: {str(e)}"}), 500


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
                "add_student": "POST /add_student (requires auth)",
                "get_students": "GET /get_students (requires auth)",
                "get_student": "GET /get_student/<student_id> (requires auth)",
                "get_matches": "GET /get_matches/<student_id> (requires auth)",
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
    data = request.json
    course_codes = data.get("course_codes", [])
    
    if not course_codes:
        return jsonify({"courses": {}})
    
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
    data = request.json
    email = (data.get("email") or "").strip().lower()
    
    if not is_valid_nthu_email(email):
        return jsonify({"error": "Please use a valid NTHU email address ending with .nthu.edu.tw"}), 400
    
    # Generate and store OTP
    otp = generate_otp()
    store_otp(email, otp)
    
    # Send OTP via email
    if send_otp_email(email, otp):
        return jsonify({"message": "OTP sent successfully to your email"}), 200
    else:
        return jsonify({"error": "Failed to send OTP. Please check your email address and try again."}), 500


@app.route("/verify_otp", methods=["POST"])
def verify_otp_endpoint():
    """Verify OTP for email"""
    data = request.json
    email = (data.get("email") or "").strip().lower()
    otp = data.get("otp", "").strip()
    
    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400
    
    if verify_otp(email, otp):
        return jsonify({"message": "Email verified successfully"}), 200
    else:
        return jsonify({"error": "Invalid or expired OTP"}), 400


@app.route("/register", methods=["POST"])
def register():
    data = request.json
    email = (data.get("email") or "").strip().lower()
    
    # Check if email is verified
    otp_doc = otp_collection.find_one({
        "email": email,
        "verified": True,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not otp_doc:
        return jsonify({"error": "Email not verified. Please verify your email first."}), 400
    
    is_valid, message = validate_student_data(data)
    if not is_valid:
        return jsonify({"error": message}), 400
    data["created_at"] = datetime.utcnow()
    data["email_verified"] = True  # Mark as verified
    try:
        result = students_collection.insert_one(data)
        # Clean up OTP after successful registration
        otp_collection.delete_one({"email": email})
        return jsonify({"message": "Registration successful", "student_id": str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({"error": f"Error saving student: {str(e)}"}), 500


@app.route("/add_student", methods=["POST"])
@login_required
def add_student():
    data = request.json
    is_valid, message = validate_student_data(data)
    if not is_valid:
        return jsonify({"error": message}), 400
    data["created_at"] = datetime.utcnow()
    try:
        result = students_collection.insert_one(data)
        return jsonify({"message": "Student added successfully", "student_id": str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({"error": f"Error saving student: {str(e)}"}), 500


@app.route("/get_students", methods=["GET"])
@login_required
def get_students():
    try:
        students = []
        for s in students_collection.find():
            s["_id"] = str(s["_id"])
            students.append(s)
        return jsonify({"students": students, "count": len(students)})
    except Exception as e:
        return jsonify({"error": f"Error fetching students: {str(e)}"}), 500


@app.route("/get_student/<student_id>", methods=["GET"])
@login_required
def get_student(student_id):
    try:
        student = students_collection.find_one({"_id": ObjectId(student_id)})
        if not student:
            return jsonify({"error": "Student not found"}), 404
        student["_id"] = str(student["_id"])
        return jsonify(student)
    except Exception as e:
        return jsonify({"error": f"Error fetching student: {str(e)}"}), 500


@app.route("/get_matches/<student_id>", methods=["GET"])
@login_required
def get_matches(student_id):
    try:
        target = students_collection.find_one({"_id": ObjectId(student_id)})
        if not target:
            return jsonify({"error": "Student not found"}), 404
        all_courses, all_spots, all_times = get_all_unique_features()
        if not all_courses:
            return jsonify({"error": "No course data available"}), 400

        others = list(students_collection.find({"_id": {"$ne": ObjectId(student_id)}}))
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
                    "email": student["email"],
                    "department": student["department"],
                    "similarity": round(similarity * 100, 1),
                    "shared_courses": list(set(target.get("course_ids", [])) & set(student.get("course_ids", []))),
                    "shared_spots": list(set(target.get("study_spots", [])) & set(student.get("study_spots", []))),
                    "shared_times": list(set(target.get("study_times", [])) & set(student.get("study_times", []))),
                }
            )
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        top_matches = matches[:3]
        return jsonify({"target_student": target["name"], "matches": top_matches, "total_checked": len(others)})
    except Exception as e:
        return jsonify({"error": f"Error computing matches: {str(e)}"}), 500


@app.route("/send_partner_email", methods=["POST"])
@login_required
def send_partner_email():
    """Send an email to a potential study partner"""
    try:
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Get the current user
        current_user = students_collection.find_one({"_id": ObjectId(user_id)})
        if not current_user:
            return jsonify({"error": "User not found"}), 404
        
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        partner_email = data.get("partner_email", "").strip()
        partner_name = data.get("partner_name", "").strip()
        shared_courses = data.get("shared_courses", [])
        shared_spots = data.get("shared_spots", [])
        shared_times = data.get("shared_times", [])
        
        if not partner_email:
            return jsonify({"error": "Partner email is required"}), 400
        
        # Validate partner email is NTHU
        if not is_valid_nthu_email(partner_email):
            return jsonify({"error": "Invalid partner email"}), 400
        
        # Format shared items for email
        shared_courses_str = ", ".join(shared_courses) if shared_courses else "various courses"
        shared_spots_str = ", ".join(shared_spots) if shared_spots else "study locations"
        shared_times_str = ", ".join(shared_times) if shared_times else "study times"
        
        # Build email content
        sender_name = current_user.get("name", "A fellow student")
        sender_email = current_user.get("email", "")
        sender_department = current_user.get("department", "")
        
        subject = f"🎓 Study Partner Request from {sender_name} - StudyBuddy"
        
        # Build the shared items section
        shared_items_html = ""
        if shared_courses:
            shared_items_html += f"<li><strong>Shared Courses:</strong> {shared_courses_str}</li>"
        if shared_spots:
            shared_items_html += f"<li><strong>Preferred Study Spots:</strong> {shared_spots_str}</li>"
        if shared_times:
            shared_items_html += f"<li><strong>Available Study Times:</strong> {shared_times_str}</li>"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">📚 StudyBuddy</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Study Partner Connection</p>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <h2 style="color: #1f2937; margin-top: 0;">Hi {partner_name}! 👋</h2>
                
                <p style="font-size: 16px;">
                    <strong>{sender_name}</strong> from <strong>{sender_department}</strong> found your profile on StudyBuddy and would like to connect with you as a study partner!
                </p>
                
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #6366f1;">🤝 What You Have in Common:</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                        {shared_items_html if shared_items_html else "<li>Similar academic interests and study preferences</li>"}
                    </ul>
                </div>
                
                <p style="font-size: 16px;">
                    {sender_name} thinks you'd be great study partners! You could help each other with coursework, prepare for exams, or just have productive study sessions together.
                </p>
                
                <div style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #6366f1; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;">
                        <strong>💬 To respond:</strong> Simply reply to this email to get in touch with {sender_name}!
                    </p>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    This message was sent via <strong>StudyBuddy</strong> - the study partner matching platform for NTHU students.<br>
                    <a href="https://studybuddynthu.org" style="color: #6366f1;">studybuddynthu.org</a>
                </p>
            </div>
        </body>
        </html>
        """
        
        plain_body = f"""
Hi {partner_name}!

{sender_name} from {sender_department} found your profile on StudyBuddy and would like to connect with you as a study partner!

What You Have in Common:
- Shared Courses: {shared_courses_str}
- Preferred Study Spots: {shared_spots_str}
- Available Study Times: {shared_times_str}

{sender_name} thinks you'd be great study partners! You could help each other with coursework, prepare for exams, or just have productive study sessions together.

To respond: Simply reply to this email to get in touch with {sender_name}!

---
This message was sent via StudyBuddy - the study partner matching platform for NTHU students.
https://studybuddynthu.org
        """
        
        # Send the email
        try:
            msg = Message(
                subject=subject,
                recipients=[partner_email],
                body=plain_body,
                html=html_body,
                reply_to=sender_email  # KEY: Replies go to the sender, not StudyBuddy
            )
            mail.send(msg)
            
            print(f"✅ Partner email sent from {sender_email} to {partner_email}")
            return jsonify({
                "message": "Email sent successfully! Your study partner will receive your connection request.",
                "sent_to": partner_email
            }), 200
            
        except Exception as email_error:
            print(f"❌ Error sending partner email: {email_error}")
            return jsonify({"error": "Failed to send email. Please try again later."}), 500
        
    except Exception as e:
        print(f"Error in send_partner_email: {e}")
        return jsonify({"error": f"Error sending email: {str(e)}"}), 500


@app.route("/update_courses_from_nthu", methods=["POST"])
@login_required
def update_courses_from_nthu():
    """Fetch latest course data from NTHU's live JSON endpoint and update database"""
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
            
            # Create course document
            course_doc = {
                "code": course_code,
                "name_zh": course_name_zh,
                "name_en": course_name_en,
                "display": f"{course_code} - {course_name_zh}",
                "updated_at": datetime.utcnow()
            }
            
            # Upsert course (update if exists, insert if new)
            result = courses_collection.update_one(
                {"code": course_code},
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
        return jsonify({"error": f"Error updating courses: {str(e)}"}), 500


@app.route("/update_profile", methods=["PUT"])
@login_required
def update_profile():
    """Update user profile - courses, study spots, and study times"""
    try:
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Build update document with only allowed fields
        update_fields = {}
        
        # Update courses if provided
        if "course_ids" in data:
            course_ids = data["course_ids"]
            if not isinstance(course_ids, list):
                return jsonify({"error": "course_ids must be a list"}), 400
            update_fields["course_ids"] = course_ids
        
        # Update study spots if provided
        if "study_spots" in data:
            study_spots = data["study_spots"]
            if not isinstance(study_spots, list):
                return jsonify({"error": "study_spots must be a list"}), 400
            # Validate study spots against allowed values
            for spot in study_spots:
                if spot not in STUDY_SPOTS:
                    return jsonify({"error": f"Invalid study spot: {spot}"}), 400
            update_fields["study_spots"] = study_spots
        
        # Update study times if provided
        if "study_times" in data:
            study_times = data["study_times"]
            if not isinstance(study_times, list):
                return jsonify({"error": "study_times must be a list"}), 400
            # Validate study times against allowed values
            for time in study_times:
                if time not in STUDY_TIMES:
                    return jsonify({"error": f"Invalid study time: {time}"}), 400
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
        return jsonify({"error": f"Error updating profile: {str(e)}"}), 500


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error", "message": str(error)}), 500

@app.errorhandler(Exception)
def handle_exception(error):
    # Log the error for debugging
    print(f"Unhandled exception: {error}")
    import traceback
    traceback.print_exc()
    return jsonify({"error": "An unexpected error occurred", "message": str(error)}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") == "development")
