import sqlite3
from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from server.services.db import get_connection, now_iso
from server.services.session import generate_token, generate_invite_code


def register():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({
            "ok": False,
            "message": "Username and password are required."
        }), 400

    if len(username) < 3:
        return jsonify({
            "ok": False,
            "message": "Username must be at least 3 characters."
        }), 400

    if len(password) < 4:
        return jsonify({
            "ok": False,
            "message": "Password must be at least 4 characters."
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    invite_code = generate_invite_code()
    while cursor.execute(
        "SELECT id FROM users WHERE invite_code = ?",
        (invite_code,)
    ).fetchone():
        invite_code = generate_invite_code()

    try:
        cursor.execute("""
            INSERT INTO users (username, password_hash, invite_code, created_at)
            VALUES (?, ?, ?, ?)
        """, (
            username,
            generate_password_hash(password),
            invite_code,
            now_iso()
        ))
        conn.commit()

        user_id = cursor.lastrowid
        token = generate_token()

        cursor.execute("""
            INSERT INTO sessions (user_id, token, created_at)
            VALUES (?, ?, ?)
        """, (user_id, token, now_iso()))
        conn.commit()

        return jsonify({
            "ok": True,
            "message": "Registration successful.",
            "token": token,
            "user": {
                "id": user_id,
                "username": username,
                "invite_code": invite_code
            }
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({
            "ok": False,
            "message": "Username already exists."
        }), 409

    finally:
        conn.close()


def login():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({
            "ok": False,
            "message": "Username and password are required."
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    user = cursor.execute("""
        SELECT id, username, password_hash, invite_code
        FROM users
        WHERE username = ?
    """, (username,)).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        conn.close()
        return jsonify({
            "ok": False,
            "message": "Invalid username or password."
        }), 401

    token = generate_token()

    cursor.execute("""
        INSERT INTO sessions (user_id, token, created_at)
        VALUES (?, ?, ?)
    """, (user["id"], token, now_iso()))
    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "invite_code": user["invite_code"]
        }
    }), 200


def me():
    auth_header = request.headers.get("Authorization", "").strip()

    if not auth_header.startswith("Bearer "):
        return jsonify({
            "ok": False,
            "message": "Missing token."
        }), 401

    token = auth_header.replace("Bearer ", "", 1).strip()

    conn = get_connection()
    cursor = conn.cursor()

    session = cursor.execute("""
        SELECT users.id, users.username, users.invite_code
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
    """, (token,)).fetchone()

    conn.close()

    if not session:
        return jsonify({
            "ok": False,
            "message": "Invalid session."
        }), 401

    return jsonify({
        "ok": True,
        "user": {
            "id": session["id"],
            "username": session["username"],
            "invite_code": session["invite_code"]
        }
    }), 200