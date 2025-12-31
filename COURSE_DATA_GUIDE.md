# 📚 Course Data Management Guide

## Overview
Your StudyBuddy platform now has **two powerful strategies** for handling course data:

### ✅ Strategy 1: Live NTHU Course Data (Automated)
Automatically fetch the latest courses from NTHU's official endpoint

### ✅ Strategy 3: Manual Course Entry (Fallback)
Users can add custom course names if not found in the database

---

## 🚀 Quick Start: Update Courses from NTHU

### Option A: Using the Python Script

```bash
cd backend
source venv/bin/activate
python update_courses.py
```

This will:
- ✅ Fetch 2960+ courses from NTHU's live endpoint
- ✅ Show you the connection is working
- ✅ Give you instructions to update your database

### Option B: Using the API Endpoint Directly

1. **Login to StudyBuddy** at `http://localhost:3000`
2. **Open Browser Console** (F12 → Console tab)
3. **Run this command:**

```javascript
fetch('http://localhost:5001/update_courses_from_nthu', {
  method: 'POST',
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('✅ Courses updated!', data);
  alert(`Updated ${data.new_courses} new courses, ${data.updated_courses} existing courses`);
});
```

---

## 🎯 Manual Course Entry Feature

### How It Works

**For Students:**
1. When registering or editing profile
2. Search for a course (type at least 2 characters)
3. If course not found → **"✚ Add [course name]"** option appears
4. Click it or press **Enter** to add custom course
5. Course is saved with the exact name you typed

### User Experience

```
┌─────────────────────────────────────┐
│ Search for courses...               │
│ "Data Structures"                   │
└─────────────────────────────────────┘
         ↓
   [Course not found?]
         ↓
┌─────────────────────────────────────┐
│ ✚ Add "Data Structures"             │
│ Course not found? Add it manually   │
└─────────────────────────────────────┘
```

### Benefits
- ✅ Never miss a course (especially new ones)
- ✅ Works even if NTHU data isn't updated yet
- ✅ Simple, intuitive UX
- ✅ No course codes needed - just type the name!

---

## 📊 NTHU Course Data Details

### Data Source
- **URL:** `https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/OPENDATA/open_course_data.json`
- **Update Frequency:** Daily (according to NTHU)
- **Total Courses:** ~2960 courses per semester

### Data Structure
```json
{
  "科號": "11420AES 470100",
  "課程中文名稱": "環境科學與工程",
  "課程英文名稱": "Environmental Science and Engineering",
  "學分數": "3",
  "授課語言": "中"
}
```

### How We Store It
```javascript
{
  code: "11420AES 470100",
  name_zh: "環境科學與工程",
  name_en: "Environmental Science and Engineering",
  display: "11420AES 470100 - 環境科學與工程",
  updated_at: ISODate("2025-01-30T...")
}
```

---

## 🔄 Recommended Update Schedule

### Before Semester Starts (CRITICAL)
- 2 months before: ✅ Update courses from NTHU
- 1 month before: ✅ Update again (new courses might be added)
- 1 week before: ✅ Final update

### During Semester
- Weekly: Check for new courses
- After add/drop period: Update again

### Quick Update Command
```bash
# Add to your crontab for weekly updates
0 2 * * 1 cd /path/to/backend && venv/bin/python -c "import requests; requests.post('http://localhost:5001/update_courses_from_nthu')"
```

---

## 🎓 For Instagram Promotions

### Messaging Points

**Before Promotions:**
1. ✅ Update course database from NTHU
2. ✅ Test manual course entry works
3. ✅ Verify both frontend and backend are deployed

**Key Selling Points:**
- "All NTHU courses included - updated daily!"
- "Can't find your course? Just type the name and we'll add it!"
- "Spring 2025 courses ready - register now!"

---

## 🐛 Troubleshooting

### Issue: "Course not found" for common courses
**Solution:** Run the course updater
```bash
cd backend
source venv/bin/activate
python update_courses.py
```

### Issue: NTHU endpoint timeout
**Solution:** It's normal - NTHU server can be slow. Try again in a few minutes.

### Issue: Manual entry not working
**Check:**
1. Is frontend compiled? Look for "Compiled successfully!" in terminal
2. Is backend running? Check `http://localhost:5001/health`
3. Clear browser cache and reload

---

## 📈 Deployment Checklist

Before going live with Instagram promotions:

- [ ] Update courses from NTHU (run `update_courses.py`)
- [ ] Test manual course entry on Register page
- [ ] Test manual course entry on Edit Profile page
- [ ] Verify email sending works
- [ ] Test on mobile (responsive design)
- [ ] Deploy backend to Railway
- [ ] Deploy frontend to Vercel
- [ ] Update CORS settings for production domains
- [ ] Test production site
- [ ] **GO LIVE!** 🚀

---

## 🎉 Success Metrics

After implementation:
- ✅ **2960+ courses** available for search
- ✅ **Fallback system** for any missing courses
- ✅ **Zero barriers** to student registration
- ✅ **Future-proof** - always up-to-date

---

## 💡 Pro Tips

1. **Run course update weekly** during semester
2. **Before major registration periods** (add/drop), update courses
3. **Monitor user feedback** - if multiple users add the same "custom" course, it might be missing from NTHU data
4. **Keep the manual entry feature** even after updating - it's your safety net!

---

## 🚀 Next Steps

1. **NOW:** Test the manual course entry locally
2. **Before promo:** Update courses from NTHU
3. **Deploy:** Push to Railway + Vercel
4. **Launch:** Start Instagram promotions
5. **Monitor:** Watch for user feedback and course additions

---

## 📞 Technical Notes

### Backend Files Modified
- `app.py` - Added `/update_courses_from_nthu` endpoint
- `requirements.txt` - Added `requests` library
- `update_courses.py` - Standalone updater script

### Frontend Files Modified
- `Register.js` - Added manual course entry UI
- `EditProfile.js` - Added manual course entry UI

### Database Collections
- `courses` - Auto-updated from NTHU
- `students_collection` - Stores user-added custom courses in `course_ids`

---

**Ready to launch! 🎓🚀**

