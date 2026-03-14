import secrets
from flask import request, jsonify

from server.services.db import get_connection


def generate_token():
    return secrets.token_hex(32)


def generate_invite_code():
    return secrets.token_hex(4).upper()


def require_auth():
    auth = request.headers.get("Authorization", "")

    if not auth.startswith("Bearer "):
        return _auth_error()

    token = auth.split(" ", 1)[1]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT users.*
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
    """, (token,))

    row = cur.fetchone()
    conn.close()

    if not row:
        return _auth_error()

    return dict(row)


def _auth_error():
    response = jsonify({
        "ok": False,
        "message": "Unauthorized"
    })
    response.status_code = 401
    raise Exception(response)