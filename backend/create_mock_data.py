import requests
import json
from datetime import datetime
import random

# Updated mock data using actual NTHU course IDs from your database
mock_students = [
    {
        "name": "Alice Johnson",
        "email": "alice@university.edu",
        "department": "Computer Science",
        "course_ids": ["1132OAES 510000", "1132OAES 520200", "1132OA1A 100200"],  # Real course IDs
        "study_spots": ["Main Library", "Computer Lab"],
        "study_times": ["Morning (9-12 PM)", "Evening (6-9 PM)"]
    },
    {
        "name": "Bob Smith", 
        "email": "bob@university.edu",
        "department": "Computer Science",
        "course_ids": ["1132OAES 510000", "1132OAES 560100"],  # Overlapping with Alice
        "study_spots": ["Main Library", "Coffee Shop"],
        "study_times": ["Morning (9-12 PM)", "Afternoon (12-3 PM)"]
    },
    {
        "name": "Carol Davis",
        "email": "carol@university.edu", 
        "department": "Mathematics",
        "course_ids": ["1132OAES 560100", "1132OAES 520200"],  # Environmental Bioremediation + Green technology
        "study_spots": ["Department Library", "Quiet Study Area"],
        "study_times": ["Evening (6-9 PM)", "Weekend Morning"]
    },
    {
        "name": "David Wilson",
        "email": "david@university.edu",
        "department": "Computer Science", 
        "course_ids": ["1132OA1A 100200", "1132OAES 611100"],  # AI Ethics + Seminar
        "study_spots": ["Main Library", "Group Study Room"],
        "study_times": ["Afternoon (12-3 PM)", "Evening (6-9 PM)"]
    },
    {
        "name": "Emma Chen",
        "email": "emma@university.edu",
        "department": "Physics",
        "course_ids": ["1132OAES 560100", "1132OAES 611100"],  # Good overlap potential
        "study_spots": ["Coffee Shop", "Student Center"],
        "study_times": ["Morning (9-12 PM)", "Weekend Morning"]
    },
    {
        "name": "Frank Liu",
        "email": "frank@university.edu",
        "department": "Computer Science",
        "course_ids": ["1132OAES 510000", "1132OA1A 100200"],  # CS + Ethics combo
        "study_spots": ["Main Library", "Computer Lab"],
        "study_times": ["Evening (6-9 PM)", "Night (9-12 AM)"]
    }
]

def add_mock_students():
    """Add mock students to the database via API"""
    base_url = "http://127.0.0.1:5001"
    
    for student in mock_students:
        try:
            response = requests.post(f"{base_url}/add_student", json=student)
            if response.status_code == 201:
                result = response.json()
                print(f"✓ Added {student['name']} (ID: {result.get('student_id', 'N/A')})")
            else:
                print(f"✗ Failed to add {student['name']}: {response.text}")
        except Exception as e:
            print(f"✗ Error adding {student['name']}: {e}")

def test_matching():
    """Test the matching functionality after adding students"""
    base_url = "http://127.0.0.1:5001"
    
    try:
        # Get all students first
        response = requests.get(f"{base_url}/get_students")
        if response.status_code == 200:
            students = response.json()['students']
            if students:
                # Test matching with the first student
                first_student = students[0]
                print(f"\n🔍 Testing matches for {first_student['name']}...")
                
                # When you implement matching endpoint later:
                # match_response = requests.get(f"{base_url}/get_matches?userId={first_student['_id']}")
                # print(f"Match results: {match_response.json()}")
            else:
                print("No students found for testing matches")
    except Exception as e:
        print(f"Error testing matches: {e}")

if __name__ == "__main__":
    print("Adding mock students with real NTHU course IDs...")
    add_mock_students()
    print("\n" + "="*50)
    test_matching()
    print("Done!")
