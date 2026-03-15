import sqlite3
import os

db_path = "../api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/42cbb3a5d5341bb62286ff1beaece85996dc9c640fa5af541a0702f2c1be74b2.sqlite"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM conversations;")
    count = cursor.fetchone()[0]
    print(f"Total conversations in DB: {count}")
    
    # Check if FTS index is populated
    cursor.execute("SELECT COUNT(*) FROM prompts_fts;")
    fts_count = cursor.fetchone()[0]
    print(f"Total prompts in FTS: {fts_count}")
    
    conn.close()
else:
    print(f"Database not found at {db_path}")
