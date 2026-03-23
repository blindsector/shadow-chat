import os
import uuid
from flask import request, jsonify, send_from_directory

from server.services.db import (
    get_connection,
    now_iso,
    UPLOAD_DIR
)
from server.services.session import require_auth
from server.services.push import send_push_to_user


ALLOWED_REACTION_EMOJIS = {"👍", "❤️", "😂", "😮", "😢", "👎"}


def _build_reaction_summary(cur, chat_type, item_type, item_id, current_user_id):
    rows = cur.execute("""
        SELECT
            emoji,
            COUNT(*) AS count,
            MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS me
        FROM reactions
        WHERE chat_type = ?
          AND item_type = ?
          AND item_id = ?
        GROUP BY emoji
        ORDER BY count DESC, emoji ASC
    """, (
        current_user_id,
        chat_type,
        item_type,
        item_id
    )).fetchall()

    return [{
        "emoji": row["emoji"],
        "count": row["count"],
        "me": bool(row["me"])
    } for row in rows]


def _get_hidden_keys(cur, owner_user_id, chat_type):
    rows = cur.execute("""
        SELECT item_type, item_id
        FROM hidden_items
        WHERE owner_user_id = ?
          AND chat_type = ?
    """, (owner_user_id, chat_type)).fetchall()

    return {(row["item_type"], row["item_id"]) for row in rows}


def _get_deleted_map(cur, chat_type):
    rows = cur.execute("""
        SELECT item_type, item_id, deleted_by_user_id, deleted_at
        FROM deleted_items
        WHERE chat_type = ?
    """, (chat_type,)).fetchall()

    result = {}
    for row in rows:
        result[(row["item_type"], row["item_id"])] = {
            "deleted_for_everyone": True,
            "deleted_by_user_id": row["deleted_by_user_id"],
            "deleted_at": row["deleted_at"]
        }
    return result


def _get_direct_item(cur, item_type, item_id):
    if item_type == "text":
        return cur.execute("""
            SELECT id, sender_id, receiver_id, encoded_text, created_at, is_forwarded
            FROM messages
            WHERE id = ?
        """, (item_id,)).fetchone()

    if item_type == "file":
        return cur.execute("""
            SELECT *
            FROM uploads
            WHERE id = ?
              AND receiver_id IS NOT NULL
        """, (item_id,)).fetchone()

    return None


def _get_group_item(cur, item_type, item_id):
    if item_type == "text":
        return cur.execute("""
            SELECT id, group_id, sender_id, encoded_text, created_at, is_forwarded
            FROM group_messages
            WHERE id = ?
        """, (item_id,)).fetchone()

    if item_type == "file":
        return cur.execute("""
            SELECT *
            FROM uploads
            WHERE id = ?
              AND group_id IS NOT NULL
        """, (item_id,)).fetchone()

    return None


def _user_in_group(cur, group_id, user_id):
    row = cur.execute("""
        SELECT id
        FROM group_members
        WHERE group_id = ?
          AND user_id = ?
    """, (group_id, user_id)).fetchone()
    return bool(row)


def _validate_direct_item_access(cur, user_id, item_type, item_id):
    row = _get_direct_item(cur, item_type, item_id)
    if not row:
        return None

    if user_id not in (row["sender_id"], row["receiver_id"]):
        return None

    return row


def _validate_group_item_access(cur, user_id, item_type, item_id):
    row = _get_group_item(cur, item_type, item_id)
    if not row:
        return None

    if not _user_in_group(cur, row["group_id"], user_id):
        return None

    return row


def _is_deleted_for_everyone(cur, chat_type, item_type, item_id):
    row = cur.execute("""
        SELECT id
        FROM deleted_items
        WHERE chat_type = ?
          AND item_type = ?
          AND item_id = ?
    """, (chat_type, item_type, item_id)).fetchone()
    return bool(row)


def send_message():
    user = require_auth()

    data = request.get_json() or {}
    receiver_id = data.get("receiver_id")
    encoded_text = data.get("encoded_text")

    if not receiver_id or not encoded_text:
        return jsonify({"ok": False, "message": "Invalid payload"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO messages (sender_id, receiver_id, encoded_text, created_at)
        VALUES (?, ?, ?, ?)
    """, (
        user["id"],
        receiver_id,
        encoded_text,
        now_iso()
    ))

    message_id = cur.lastrowid

    conn.commit()
    conn.close()

    try:
        sender_name = user.get("username") or "Shadow Chat"
    except Exception:
        sender_name = "Shadow Chat"

    try:
        send_push_to_user(
            int(receiver_id),
            sender_name,
            encoded_text,
            chat_id=int(user["id"]),
            chat_type="direct"
        )
    except Exception:
        pass

    return jsonify({
        "ok": True,
        "message_id": message_id
    })


def get_conversation():
    user = require_auth()
    contact_id = request.args.get("contact_id", type=int)

    if not contact_id:
        return jsonify({"ok": False, "message": "Missing contact_id"}), 400

    conn = get_connection()
    cur = conn.cursor()

    hidden_keys = _get_hidden_keys(cur, user["id"], "direct")
    deleted_map = _get_deleted_map(cur, "direct")
    delivered_now = now_iso()

    cur.execute("""
        UPDATE messages
        SET delivered_at = ?
        WHERE receiver_id = ?
          AND sender_id = ?
          AND delivered_at IS NULL
    """, (
        delivered_now,
        user["id"],
        contact_id
    ))

    cur.execute("""
        UPDATE uploads
        SET delivered_at = ?
        WHERE receiver_id = ?
          AND sender_id = ?
          AND delivered_at IS NULL
    """, (
        delivered_now,
        user["id"],
        contact_id
    ))

    conn.commit()

    messages = []

    text_rows = cur.execute("""
        SELECT m.*, u.username AS sender_username
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE
            (m.sender_id = ? AND m.receiver_id = ?)
            OR
            (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
    """, (
        user["id"], contact_id,
        contact_id, user["id"]
    )).fetchall()

    for row in text_rows:
        if ("text", row["id"]) in hidden_keys:
            continue

        item = dict(row)
        item["type"] = "text"
        item["is_forwarded"] = bool(item.get("is_forwarded", 0))

        deleted_meta = deleted_map.get(("text", item["id"]))
        if deleted_meta:
            item["encoded_text"] = ""
            item["reactions"] = []
            item.update(deleted_meta)
        else:
            item["deleted_for_everyone"] = False
            item["reactions"] = _build_reaction_summary(
                cur, "direct", "text", item["id"], user["id"]
            )

        messages.append(item)

    file_rows = cur.execute("""
        SELECT *
        FROM uploads
        WHERE
            (sender_id = ? AND receiver_id = ?)
            OR
            (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
    """, (
        user["id"], contact_id,
        contact_id, user["id"]
    )).fetchall()

    for row in file_rows:
        if ("file", row["id"]) in hidden_keys:
            continue

        item = dict(row)
        item["type"] = "file"
        item["is_forwarded"] = bool(item.get("is_forwarded", 0))

        deleted_meta = deleted_map.get(("file", item["id"]))
        if deleted_meta:
            item["file_url"] = None
            item["file_name"] = ""
            item["reactions"] = []
            item.update(deleted_meta)
        else:
            item["file_url"] = f"/api/messages/file/{item['stored_name']}"
            item["file_name"] = item["filename"]
            item["deleted_for_everyone"] = False
            item["reactions"] = _build_reaction_summary(
                cur, "direct", "file", item["id"], user["id"]
            )

        messages.append(item)

    messages.sort(key=lambda x: x["created_at"])
    conn.close()

    return jsonify({
        "ok": True,
        "messages": messages
    })


def upload_file():
    user = require_auth()

    file = request.files.get("file")
    if not file:
        return jsonify({"ok": False, "message": "Missing file"}), 400

    receiver_id = request.form.get("receiver_id", type=int)
    group_id = request.form.get("group_id", type=int)

    stored_name = f"{uuid.uuid4().hex}_{file.filename}"
    path = os.path.join(UPLOAD_DIR, stored_name)
    file.save(path)

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO uploads
        (sender_id, receiver_id, group_id, filename, stored_name, file_size, mime_type, created_at, is_forwarded)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    """, (
        user["id"],
        receiver_id,
        group_id,
        file.filename,
        stored_name,
        os.path.getsize(path),
        file.mimetype,
        now_iso()
    ))

    conn.commit()
    conn.close()

    return jsonify({"ok": True})


def serve_file(filename):
    conn = get_connection()
    cur = conn.cursor()

    upload = cur.execute("""
        SELECT id, receiver_id, group_id
        FROM uploads
        WHERE stored_name = ?
    """, (filename,)).fetchone()

    if not upload:
        conn.close()
        return jsonify({"ok": False, "message": "File not found"}), 404

    chat_type = "group" if upload["group_id"] else "direct"

    deleted = cur.execute("""
        SELECT id
        FROM deleted_items
        WHERE chat_type = ?
          AND item_type = 'file'
          AND item_id = ?
    """, (chat_type, upload["id"])).fetchone()

    conn.close()

    if deleted:
        return jsonify({"ok": False, "message": "File deleted"}), 404

    return send_from_directory(UPLOAD_DIR, filename)


def add_reaction():
    user = require_auth()
    data = request.get_json() or {}

    chat_type = (data.get("chat_type") or "").strip()
    item_type = (data.get("item_type") or "").strip()
    emoji = (data.get("emoji") or "").strip()

    try:
        item_id = int(data.get("item_id"))
    except Exception:
        item_id = None

    if chat_type not in {"direct", "group"}:
        return jsonify({"ok": False, "message": "Invalid chat_type"}), 400

    if item_type not in {"text", "file"}:
        return jsonify({"ok": False, "message": "Invalid item_type"}), 400

    if not item_id:
        return jsonify({"ok": False, "message": "Invalid item_id"}), 400

    if emoji not in ALLOWED_REACTION_EMOJIS:
        return jsonify({"ok": False, "message": "Unsupported emoji"}), 400

    conn = get_connection()
    cur = conn.cursor()

    if chat_type == "direct":
        item_row = _validate_direct_item_access(cur, user["id"], item_type, item_id)
    else:
        item_row = _validate_group_item_access(cur, user["id"], item_type, item_id)

    if not item_row:
        conn.close()
        return jsonify({"ok": False, "message": "Item not found"}), 404

    if _is_deleted_for_everyone(cur, chat_type, item_type, item_id):
        conn.close()
        return jsonify({"ok": False, "message": "Item deleted"}), 400

    existing = cur.execute("""
        SELECT id, emoji
        FROM reactions
        WHERE chat_type = ?
          AND item_type = ?
          AND item_id = ?
          AND user_id = ?
    """, (
        chat_type,
        item_type,
        item_id,
        user["id"]
    )).fetchone()

    action = "added"

    if existing:
        if existing["emoji"] == emoji:
            cur.execute("DELETE FROM reactions WHERE id = ?", (existing["id"],))
            action = "removed"
        else:
            cur.execute("""
                UPDATE reactions
                SET emoji = ?, created_at = ?
                WHERE id = ?
            """, (emoji, now_iso(), existing["id"]))
            action = "updated"
    else:
        cur.execute("""
            INSERT INTO reactions
            (chat_type, item_type, item_id, user_id, emoji, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            chat_type,
            item_type,
            item_id,
            user["id"],
            emoji,
            now_iso()
        ))

    reactions = _build_reaction_summary(
        cur,
        chat_type,
        item_type,
        item_id,
        user["id"]
    )

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "action": action,
        "reactions": reactions
    })


def delete_message():
    user = require_auth()
    data = request.get_json() or {}

    chat_type = (data.get("chat_type") or "").strip()
    item_type = (data.get("item_type") or "").strip()
    mode = (data.get("mode") or "").strip()

    try:
        item_id = int(data.get("item_id"))
    except Exception:
        item_id = None

    if chat_type not in {"direct", "group"}:
        return jsonify({"ok": False, "message": "Invalid chat_type"}), 400

    if item_type not in {"text", "file"}:
        return jsonify({"ok": False, "message": "Invalid item_type"}), 400

    if mode not in {"for_me", "for_everyone"}:
        return jsonify({"ok": False, "message": "Invalid mode"}), 400

    if not item_id:
        return jsonify({"ok": False, "message": "Invalid item_id"}), 400

    conn = get_connection()
    cur = conn.cursor()

    if chat_type == "direct":
        item_row = _validate_direct_item_access(cur, user["id"], item_type, item_id)
    else:
        item_row = _validate_group_item_access(cur, user["id"], item_type, item_id)

    if not item_row:
        conn.close()
        return jsonify({"ok": False, "message": "Item not found"}), 404

    if mode == "for_me":
        cur.execute("""
            INSERT OR IGNORE INTO hidden_items
            (owner_user_id, chat_type, item_type, item_id, hidden_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            user["id"],
            chat_type,
            item_type,
            item_id,
            now_iso()
        ))
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "mode": "for_me"})

    if item_row["sender_id"] != user["id"]:
        conn.close()
        return jsonify({"ok": False, "message": "Only sender can delete for everyone"}), 403

    cur.execute("""
        INSERT OR IGNORE INTO deleted_items
        (chat_type, item_type, item_id, deleted_by_user_id, deleted_at)
        VALUES (?, ?, ?, ?, ?)
    """, (
        chat_type,
        item_type,
        item_id,
        user["id"],
        now_iso()
    ))

    cur.execute("""
        DELETE FROM reactions
        WHERE chat_type = ?
          AND item_type = ?
          AND item_id = ?
    """, (chat_type, item_type, item_id))

    conn.commit()
    conn.close()

    return jsonify({"ok": True, "mode": "for_everyone"})


def hide_message():
    data = request.get_json() or {}
    data["mode"] = "for_me"
    request._cached_json = data
    return delete_message()


def mark_direct_read():
    user = require_auth()
    data = request.get_json() or {}
    contact_id = data.get("contact_id")

    conn = get_connection()
    cur = conn.cursor()

    now = now_iso()

    cur.execute("""
        INSERT OR REPLACE INTO direct_reads
        (owner_user_id, contact_user_id, last_read_at)
        VALUES (?, ?, ?)
    """, (
        user["id"],
        contact_id,
        now
    ))

    cur.execute("""
        UPDATE messages
        SET seen_at = ?
        WHERE receiver_id = ?
          AND sender_id = ?
          AND seen_at IS NULL
    """, (
        now,
        user["id"],
        contact_id
    ))

    cur.execute("""
        UPDATE uploads
        SET seen_at = ?
        WHERE receiver_id = ?
          AND sender_id = ?
          AND seen_at IS NULL
    """, (
        now,
        user["id"],
        contact_id
    ))

    conn.commit()
    conn.close()

    return jsonify({"ok": True})


def forward_message():
    user = require_auth()
    data = request.get_json() or {}

    chat_type = (data.get("chat_type") or "").strip()
    item_type = (data.get("item_type") or "").strip()

    try:
        item_id = int(data.get("item_id"))
    except Exception:
        item_id = None

    receiver_id = data.get("receiver_id")
    group_id = data.get("group_id")

    if chat_type not in {"direct", "group"}:
        return jsonify({"ok": False, "message": "Invalid chat_type"}), 400

    if item_type not in {"text", "file"}:
        return jsonify({"ok": False, "message": "Invalid item_type"}), 400

    if not item_id:
        return jsonify({"ok": False, "message": "Invalid item_id"}), 400

    if not receiver_id and not group_id:
        return jsonify({"ok": False, "message": "Missing target"}), 400

    conn = get_connection()
    cur = conn.cursor()

    if chat_type == "direct":
        item_row = _validate_direct_item_access(cur, user["id"], item_type, item_id)
    else:
        item_row = _validate_group_item_access(cur, user["id"], item_type, item_id)

    if not item_row:
        conn.close()
        return jsonify({"ok": False, "message": "Item not found"}), 404

    if _is_deleted_for_everyone(cur, chat_type, item_type, item_id):
        conn.close()
        return jsonify({"ok": False, "message": "Item deleted"}), 400

    if receiver_id:
        receiver_id = int(receiver_id)

    if group_id:
        group_id = int(group_id)

        if not _user_in_group(cur, group_id, user["id"]):
            conn.close()
            return jsonify({"ok": False, "message": "Not a group member"}), 403

    if item_type == "text":
        encoded_text = item_row["encoded_text"]

        if receiver_id:
            cur.execute("""
                INSERT INTO messages
                (
                    sender_id,
                    receiver_id,
                    encoded_text,
                    created_at,
                    is_forwarded,
                    forwarded_from_sender_id,
                    forwarded_from_message_id
                )
                VALUES (?, ?, ?, ?, 1, ?, ?)
            """, (
                user["id"],
                receiver_id,
                encoded_text,
                now_iso(),
                item_row["sender_id"],
                item_row["id"]
            ))
        else:
            cur.execute("""
                INSERT INTO group_messages
                (
                    group_id,
                    sender_id,
                    encoded_text,
                    created_at,
                    is_forwarded,
                    forwarded_from_sender_id,
                    forwarded_from_message_id
                )
                VALUES (?, ?, ?, ?, 1, ?, ?)
            """, (
                group_id,
                user["id"],
                encoded_text,
                now_iso(),
                item_row["sender_id"],
                item_row["id"]
            ))

    else:
        if receiver_id:
            cur.execute("""
                INSERT INTO uploads
                (
                    sender_id,
                    receiver_id,
                    group_id,
                    filename,
                    stored_name,
                    file_size,
                    mime_type,
                    created_at,
                    is_forwarded,
                    forwarded_from_sender_id,
                    forwarded_from_item_id
                )
                VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, ?)
            """, (
                user["id"],
                receiver_id,
                item_row["filename"],
                item_row["stored_name"],
                item_row["file_size"],
                item_row["mime_type"],
                now_iso(),
                item_row["sender_id"],
                item_row["id"]
            ))
        else:
            cur.execute("""
                INSERT INTO uploads
                (
                    sender_id,
                    receiver_id,
                    group_id,
                    filename,
                    stored_name,
                    file_size,
                    mime_type,
                    created_at,
                    is_forwarded,
                    forwarded_from_sender_id,
                    forwarded_from_item_id
                )
                VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """, (
                user["id"],
                group_id,
                item_row["filename"],
                item_row["stored_name"],
                item_row["file_size"],
                item_row["mime_type"],
                now_iso(),
                item_row["sender_id"],
                item_row["id"]
            ))

    conn.commit()
    conn.close()

    return jsonify({"ok": True})

def typing_ping():
    user = require_auth()
    data = request.get_json() or {}

    contact_id = data.get("contact_id")

    if not contact_id:
        return jsonify({"ok": False}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT OR REPLACE INTO typing_status
        (user_id, contact_id, updated_at)
        VALUES (?, ?, ?)
    """, (
        user["id"],
        contact_id,
        now_iso()
    ))

    conn.commit()
    conn.close()

    return jsonify({"ok": True})


def get_typing():
    user = require_auth()
    contact_id = request.args.get("contact_id", type=int)

    if not contact_id:
        return jsonify({"ok": False}), 400

    conn = get_connection()
    cur = conn.cursor()

    row = cur.execute("""
        SELECT updated_at
        FROM typing_status
        WHERE user_id = ?
          AND contact_id = ?
    """, (
        contact_id,
        user["id"]
    )).fetchone()

    conn.close()

    if not row:
        return jsonify({"ok": True, "typing": False})

    from datetime import datetime, timedelta

    try:
        updated = datetime.fromisoformat(row["updated_at"])
        if datetime.utcnow() - updated < timedelta(seconds=3):
            return jsonify({"ok": True, "typing": True})
    except Exception:
        pass

    return jsonify({"ok": True, "typing": False})
