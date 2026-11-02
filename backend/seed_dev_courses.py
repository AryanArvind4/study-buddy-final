"""Copy the course list from the production database into your dev database.

Only READS from production; only WRITES to MONGO_DB_NAME (which must not be production).
Students are not copied, so your dev database starts with no real users.

Usage (from the backend folder, with backend/.env set up):
    python seed_dev_courses.py
"""
import os
import sys

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient, ReplaceOne

PROD_DB = "study_partner"

load_dotenv()
uri = os.getenv("MONGO_URI")
target = os.getenv("MONGO_DB_NAME")

if not uri:
    sys.exit("MONGO_URI is not set in backend/.env")
if not target or target == PROD_DB:
    sys.exit(f"Set MONGO_DB_NAME in backend/.env to a dev database (not '{PROD_DB}').")

client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=20000)
source = client[PROD_DB]["courses"]
dest = client[target]["courses"]

ops = [ReplaceOne({"_id": c["_id"]}, c, upsert=True) for c in source.find()]
if not ops:
    sys.exit("No courses found in production database.")
dest.bulk_write(ops)
print(f"✅ Copied {len(ops)} courses into '{target}'.")
