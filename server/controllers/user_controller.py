from datetime import datetime, timedelta, timezone

from flask import request, jsonify

from server.services.db import get_connection, now_iso


ONLINE_THRESHOLD_SECONDS = 35


def _get_current_user():
    auth_header = request.headers.get("Authorization", "").strip()

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "", 1).strip()

    if not token:
        return None

    conn = get_connection()
    cursor = conn.cursor()

    user = cursor.execute("""
        SELECT users.id, users.username, users.invite_code
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
    """, (token,)).fetchone()

    conn.close()
    return user


def _parse_iso_datetime(value):
    if not value:
        return None

    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _build_presence_payload(user_row):
    if not user_row:
        return {
            "is_visible": False,
            "is_online": False,
            "last_seen_at": None
        }

    is_visible = bool(user_row["show_online_status"])
    last_seen_at = user_row["last_seen_at"]

    if not is_visible:
        return {
            "is_visible": False,
            "is_online": False,
            "last_seen_at": None
        }

    is_online = False
    last_seen_dt = _parse_iso_datetime(last_seen_at)

    if last_seen_dt:
        threshold_dt = datetime.now(timezone.utc) - timedelta(seconds=ONLINE_THRESHOLD_SECONDS)
        is_online = last_seen_dt >= threshold_dt

    return {
        "is_visible": True,
        "is_online": is_online,
        "last_seen_at": last_seen_at
    }


def add_contact():
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    data = request.get_json(silent=True) or {}
    invite_code = (data.get("invite_code") or "").strip().upper()

    if not invite_code:
        return jsonify({
            "ok": False,
            "message": "Invite code is required."
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    target_user = cursor.execute("""
        SELECT id, username, invite_code
        FROM users
        WHERE invite_code = ?
    """, (invite_code,)).fetchone()

    if not target_user:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "User not found."
        }), 404

    if target_user["id"] == current_user["id"]:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "You cannot add yourself."
        }), 400

    existing = cursor.execute("""
        SELECT id
        FROM contacts
        WHERE user_id = ? AND contact_user_id = ?
    """, (current_user["id"], target_user["id"])).fetchone()

    if existing:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "Contact already added."
        }), 409

    created_at = now_iso()

    cursor.execute("""
        INSERT INTO contacts (user_id, contact_user_id, created_at)
        VALUES (?, ?, ?)
    """, (current_user["id"], target_user["id"], created_at))

    cursor.execute("""
        INSERT INTO contacts (user_id, contact_user_id, created_at)
        VALUES (?, ?, ?)
    """, (target_user["id"], current_user["id"], created_at))

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "message": "Contact added successfully.",
        "contact": {
            "id": target_user["id"],
            "username": target_user["username"],
            "invite_code": target_user["invite_code"]
        }
    }), 201


def list_contacts():
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    conn = get_connection()
    cursor = conn.cursor()

    contacts = cursor.execute("""
        SELECT
            users.id,
            users.username,
            users.invite_code,
            users.last_seen_at,
            users.show_online_status,
            contacts.created_at
        FROM contacts
        JOIN users ON users.id = contacts.contact_user_id
        WHERE contacts.user_id = ?
        ORDER BY users.username ASC
    """, (current_user["id"],)).fetchall()

    conn.close()

    result = []
    for row in contacts:
        result.append({
            "id": row["id"],
            "username": row["username"],
            "invite_code": row["invite_code"],
            "created_at": row["created_at"],
            "presence": _build_presence_payload(row)
        })

    return jsonify({
        "ok": True,
        "contacts": result
    }), 200


def ping_presence():
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    conn = get_connection()
    cursor = conn.cursor()

    last_seen_at = now_iso()

    cursor.execute("""
        UPDATE users
        SET last_seen_at = ?
        WHERE id = ?
    """, (last_seen_at, current_user["id"]))

    user_row = cursor.execute("""
        SELECT id, username, last_seen_at, show_online_status
        FROM users
        WHERE id = ?
    """, (current_user["id"],)).fetchone()

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "presence": _build_presence_payload(user_row)
    }), 200


def update_presence_visibility():
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    data = request.get_json(silent=True) or {}

    if "show_online_status" not in data:
        return jsonify({
            "ok": False,
            "message": "show_online_status is required."
        }), 400

    show_online_status = 1 if bool(data.get("show_online_status")) else 0

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users
        SET show_online_status = ?
        WHERE id = ?
    """, (show_online_status, current_user["id"]))

    user_row = cursor.execute("""
        SELECT id, username, last_seen_at, show_online_status
        FROM users
        WHERE id = ?
    """, (current_user["id"],)).fetchone()

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "presence": _build_presence_payload(user_row)
    }), 200


def get_contact_presence(contact_id):
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    conn = get_connection()
    cursor = conn.cursor()

    contact = cursor.execute("""
        SELECT users.id, users.username, users.last_seen_at, users.show_online_status
        FROM contacts
        JOIN users ON users.id = contacts.contact_user_id
        WHERE contacts.user_id = ? AND contacts.contact_user_id = ?
    """, (current_user["id"], contact_id)).fetchone()

    if not contact:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "Contact not found."
        }), 404

    conn.close()

    return jsonify({
        "ok": True,
        "user": {
            "id": contact["id"],
            "username": contact["username"]
        },
        "presence": _build_presence_payload(contact)
    }), 200