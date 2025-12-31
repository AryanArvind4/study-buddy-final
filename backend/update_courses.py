#!/usr/bin/env python3
"""
Script to update course data from NTHU's live JSON endpoint.
Run this script whenever you want to refresh the course database.

Usage:
    python update_courses.py
"""

import requests
import json
from datetime import datetime

def update_courses_from_nthu():
    """Fetch and display course data from NTHU's live JSON endpoint"""
    NTHU_COURSE_URL = "https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/OPENDATA/open_course_data.json"
    
    print("=" * 60)
    print("📚 NTHU Course Data Updater")
    print("=" * 60)
    print(f"\n🔄 Fetching course data from NTHU...")
    print(f"   URL: {NTHU_COURSE_URL}")
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        response = requests.get(NTHU_COURSE_URL, timeout=30)
        
        if response.status_code != 200:
            print(f"\n❌ Error: Failed to fetch from NTHU (Status {response.status_code})")
            return False
        
        # Parse JSON data
        courses_data = response.json()
        
        if not isinstance(courses_data, list):
            print(f"\n❌ Error: Invalid course data format")
            return False
        
        print(f"\n✅ Successfully fetched {len(courses_data)} courses from NTHU!")
        
        # NTHU JSON uses Chinese field names
        print(f"\n📊 Sample courses (first 5):")
        for i, course in enumerate(courses_data[:5]):
            if isinstance(course, dict):
                code = course.get('科號', '')
                name_zh = course.get('課程中文名稱', '')
                name_en = course.get('課程英文名稱', '')
                print(f"   {i+1}. {code}")
                print(f"      中文: {name_zh}")
                print(f"      English: {name_en}")
        
        if len(courses_data) > 5:
            print(f"\n   ... and {len(courses_data) - 5} more courses")
        
        print("\n" + "=" * 60)
        print("✅ Course data fetched successfully!")
        print("\n📝 Next steps:")
        print("   1. Make sure you're logged in to StudyBuddy")
        print("   2. Open your browser to http://localhost:3000")
        print("   3. Go to your Dashboard")
        print("   4. Use the browser console to run:")
        print("      fetch('http://localhost:5001/update_courses_from_nthu', {")
        print("        method: 'POST',")
        print("        credentials: 'include'")
        print("      }).then(r => r.json()).then(console.log)")
        print("=" * 60)
        
        return True
        
    except requests.Timeout:
        print(f"\n❌ Error: Timeout fetching from NTHU server")
        return False
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    update_courses_from_nthu()

