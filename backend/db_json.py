import requests
import json
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# Setup MongoDB connection
client = MongoClient(os.getenv('MONGO_URI'))
db = client['study_partner']
courses_collection = db['courses']

def fetch_and_store_courses():
    """Fetch course data and store in MongoDB"""
    url = "https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/OPENDATA/open_course_data.json"
    
    try:
        response = requests.get(url)
        course_data = response.json()
        
        # Clear existing courses
        courses_collection.delete_many({})
        
        # Insert new course data
        if isinstance(course_data, list):
            courses_collection.insert_many(course_data)
        else:
            courses_collection.insert_one(course_data)
            
        print(f"Successfully stored {courses_collection.count_documents({})} courses")
        
        # Display sample course structure
        sample_course = courses_collection.find_one()
        print("Sample course structure:")
        print(json.dumps(sample_course, indent=2, default=str))
        
    except Exception as e:
        print(f"Error fetching course data: {e}")

def get_course_codes():
    """Extract unique course codes using the correct Chinese field name"""
    course_codes = courses_collection.distinct("科號")  # ✅ Correct field name in Chinese
    return course_codes

if __name__ == "__main__":
    fetch_and_store_courses()
    course_codes = get_course_codes()
    print(f"Found {len(course_codes)} unique courses")
    
    # Show first 10 course codes as examples
    if course_codes:
        print("Sample course codes:")
        for i, code in enumerate(course_codes[:10]):
            print(f"  {i+1}. {code}")
