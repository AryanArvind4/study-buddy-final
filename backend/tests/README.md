Backend tests run against an in-memory fake database (mongomock), never a real one.

From the backend folder:

    pip install -r requirements.txt -r requirements-dev.txt
    python tests/test_security.py
    python tests/test_social.py
    python tests/test_dev_mode.py

Each script prints PASS/FAIL per check and exits non-zero if anything fails.
