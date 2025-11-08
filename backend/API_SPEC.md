# 📘 Study Partner Finder – API Specification

## Base URL
`http://localhost:5000/api` (change to actual backend URL when deployed)

---

## 1. Register User

**POST** `/users`

### Request JSON:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "department": "CS",
  "course_ids": ["CS101", "CS201"],
  "study_spots": ["Library", "Café"],
  "study_times": ["Morning", "Evening"]
}
