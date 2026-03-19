import os
import sqlite3
from datetime import datetime


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "database.db")

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso():
    return datetime.utcnow().isoformat()


def _get_columns(cursor, table_name):
    rows = cursor.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row["name"] for row in rows}


def _ensure_column(cursor, table_name, column_name, column_sql):
    columns = _get_columns(cursor, table_name)
    if column_name not in columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}")


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_reads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            last_read_at TEXT,
            UNIQUE(user_id, group_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS typing_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, contact_id)
        )
    """)

    # user presence

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            contact_user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(user_id, contact_user_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            encoded_text TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS groups_chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            added_at TEXT NOT NULL,
            UNIQUE(group_id, user_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            encoded_text TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER,
            group_id INTEGER,
            filename TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            file_size INTEGER,
            mime_type TEXT,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hidden_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_user_id INTEGER NOT NULL,
            chat_type TEXT NOT NULL,
            item_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            hidden_at TEXT NOT NULL,
            UNIQUE(owner_user_id, chat_type, item_type, item_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS deleted_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_type TEXT NOT NULL,
            item_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            deleted_by_user_id INTEGER NOT NULL,
            deleted_at TEXT NOT NULL,
            UNIQUE(chat_type, item_type, item_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_type TEXT NOT NULL,
            item_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            emoji TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(chat_type, item_type, item_id, user_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS direct_reads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_user_id INTEGER NOT NULL,
            contact_user_id INTEGER NOT NULL,
            last_read_at TEXT,
            UNIQUE(owner_user_id, contact_user_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_reads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            last_read_at TEXT,
            UNIQUE(user_id, group_id)
        )
    """)

    # user presence
    _ensure_column(cursor, "users", "last_seen_at", "last_seen_at TEXT")
    _ensure_column(cursor, "users", "show_online_status", "show_online_status INTEGER NOT NULL DEFAULT 1")

    # reply
    _ensure_column(cursor, "messages", "reply_to_message_id", "reply_to_message_id INTEGER")
    _ensure_column(cursor, "group_messages", "reply_to_message_id", "reply_to_message_id INTEGER")

    # delivery
    _ensure_column(cursor, "messages", "delivered_at", "delivered_at TEXT")
    _ensure_column(cursor, "messages", "seen_at", "seen_at TEXT")
    _ensure_column(cursor, "uploads", "delivered_at", "delivered_at TEXT")
    _ensure_column(cursor, "uploads", "seen_at", "seen_at TEXT")

    # forward flags
    _ensure_column(cursor, "messages", "is_forwarded", "is_forwarded INTEGER NOT NULL DEFAULT 0")
    _ensure_column(cursor, "group_messages", "is_forwarded", "is_forwarded INTEGER NOT NULL DEFAULT 0")
    _ensure_column(cursor, "uploads", "is_forwarded", "is_forwarded INTEGER NOT NULL DEFAULT 0")

    # forward metadata
    _ensure_column(cursor, "messages", "forwarded_from_sender_id", "forwarded_from_sender_id INTEGER")
    _ensure_column(cursor, "messages", "forwarded_from_message_id", "forwarded_from_message_id INTEGER")

    _ensure_column(cursor, "group_messages", "forwarded_from_sender_id", "forwarded_from_sender_id INTEGER")
    _ensure_column(cursor, "group_messages", "forwarded_from_message_id", "forwarded_from_message_id INTEGER")

    _ensure_column(cursor, "uploads", "forwarded_from_sender_id", "forwarded_from_sender_id INTEGER")
    _ensure_column(cursor, "uploads", "forwarded_from_item_id", "forwarded_from_item_id INTEGER")

    conn.commit()
    conn.close()
