import os
import psycopg2
from datetime import datetime

_conn = None

def init_telemetry():
    global _conn
    try:
        db_url = os.environ.get("POSTGRES_URL")
        if db_url:
            _conn = psycopg2.connect(db_url)
            _conn.autocommit = True
            print("Telemetry DB connected")
    except Exception as e:
        print("Telemetry DB connection failed:", e)

def emit_telemetry(bot_id, status, currently_thinking, last_task, task_status):
    global _conn
    if not _conn:
        return
    try:
        with _conn.cursor() as cur:
            query = """
                INSERT INTO bot_telemetry (bot_id, status, currently_thinking, last_task, task_status, last_active_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (bot_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    currently_thinking = EXCLUDED.currently_thinking,
                    last_task = EXCLUDED.last_task,
                    task_status = EXCLUDED.task_status,
                    last_active_at = NOW();
            """
            cur.execute(query, (bot_id, status, currently_thinking, last_task, task_status))
    except Exception as e:
        print("Failed to emit telemetry:", e)
