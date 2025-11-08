from flask import Flask, request, jsonify, session
from flask_mail import Mail, Message
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from bson import ObjectId
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from datetime import datetime, timedelta
from flask_cors import CORS
from functools import wraps
import re
import random
import string

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

# CORS configuration - allow localhost and all Vercel domains
CORS(app, 
     supports_credentials=True,
     resources={r"/*": {
         "origins": [
             "http://localhost:3000",
             "http://localhost:3001",
             "https://study-buddy-final-orcin.vercel.app",
             "https://study-buddy-final-orcin-aryans-projects-a94e56f2.vercel.app",
             r"https://.*\.vercel\.app$"  # Allow any Vercel domain
         ],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type"],
         "supports_credentials": True,
         "max_age": 3600
     }}
)

# Session configuration
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "b7328b8e99a64cc38dc6b1b52d4f553a")
app.config["SESSION_COOKIE_SECURE"] = True  # Only send cookies over HTTPS
app.config["SESSION_COOKIE_HTTPONLY"] = True  # Prevent JavaScript access to session cookie
app.config["SESSION_COOKIE_SAMESITE"] = "None"  # Allow cross-site cookies for CORS
app.config["SESSION_COOKIE_DOMAIN"] = None  # Allow cookies from any domain
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)

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


def send_otp_email(email, otp):
    """Send OTP via email (or print to console if email is disabled)"""
    # If mail is not configured, print OTP to console instead
    if mail is None:
        print("\n" + "="*60, flush=True)
        print(f"📧 [DEV MODE] OTP for {email}: {otp}", flush=True)
        print("="*60 + "\n", flush=True)
        # Also write to a temporary file for easy access
        import sys
        sys.stderr.write(f"\n{'='*60}\n")
        sys.stderr.write(f"📧 OTP for {email}: {otp}\n")
        sys.stderr.write(f"{'='*60}\n\n")
        sys.stderr.flush()
        return True
    
    try:
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
        mail.send(msg)
        print(f"✅ Email sent successfully to {email}", flush=True)
        return True
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}", flush=True)
        return False


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
