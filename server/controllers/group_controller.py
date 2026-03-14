from flask import request, jsonify

from server.services.db import get_connection, now_iso


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


def _build_reaction_summary(cursor, chat_type, item_type, item_id, current_user_id):
    rows = cursor.execute("""
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


def _get_hidden_keys(cursor, owner_user_id, chat_type):
    rows = cursor.execute("""
        SELECT item_type, item_id
        FROM hidden_items
        WHERE owner_user_id = ?
          AND chat_type = ?
    """, (owner_user_id, chat_type)).fetchall()

    return {(row["item_type"], row["item_id"]) for row in rows}


def _get_deleted_map(cursor, chat_type):
    rows = cursor.execute("""
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


def _get_group_last_read_at(cursor, user_id, group_id):
    row = cursor.execute("""
        SELECT last_read_at
        FROM group_reads
        WHERE user_id = ?
          AND group_id = ?
    """, (user_id, group_id)).fetchone()

    if not row:
        return None

    return row["last_read_at"]


def _get_group_unread_count(cursor, user_id, group_id, last_read_at):
    if last_read_at:
        text_count = cursor.execute("""
            SELECT COUNT(*) AS count
            FROM group_messages
            WHERE group_id = ?
              AND sender_id != ?
              AND created_at > ?
        """, (group_id, user_id, last_read_at)).fetchone()["count"]

        file_count = cursor.execute("""
            SELECT COUNT(*) AS count
            FROM uploads
            WHERE group_id = ?
              AND sender_id != ?
              AND created_at > ?
        """, (group_id, user_id, last_read_at)).fetchone()["count"]
    else:
        text_count = cursor.execute("""
            SELECT COUNT(*) AS count
            FROM group_messages
            WHERE group_id = ?
              AND sender_id != ?
        """, (group_id, user_id)).fetchone()["count"]

        file_count = cursor.execute("""
            SELECT COUNT(*) AS count
            FROM uploads
            WHERE group_id = ?
              AND sender_id != ?
        """, (group_id, user_id)).fetchone()["count"]

    return int(text_count) + int(file_count)


def list_groups():
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    conn = get_connection()
    cursor = conn.cursor()

    hidden_keys = _get_hidden_keys(cursor, current_user["id"], "group")
    deleted_map = _get_deleted_map(cursor, "group")

    groups = cursor.execute("""
        SELECT
            g.id,
            g.name,
            g.created_by,
            g.created_at,
            (
                SELECT COUNT(*)
                FROM group_members gm2
                WHERE gm2.group_id = g.id
            ) AS member_count
        FROM groups_chat g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.id DESC
    """, (current_user["id"],)).fetchall()

    result = []

    for group in groups:
        timeline = []

        text_rows = cursor.execute("""
            SELECT
                gm.id,
                gm.group_id,
                gm.sender_id,
                gm.encoded_text,
                gm.created_at,
                u.username AS sender_username
            FROM group_messages gm
            JOIN users u ON u.id = gm.sender_id
            WHERE gm.group_id = ?
        """, (group["id"],)).fetchall()

        for row in text_rows:
            if ("text", row["id"]) in hidden_keys:
                continue

            item = {
                "type": "text",
                "id": row["id"],
                "group_id": row["group_id"],
                "sender_id": row["sender_id"],
                "sender_username": row["sender_username"],
                "encoded_text": row["encoded_text"],
                "created_at": row["created_at"]
            }

            deleted_meta = deleted_map.get(("text", row["id"]))
            if deleted_meta:
                item["encoded_text"] = ""
                item.update(deleted_meta)
            else:
                item["deleted_for_everyone"] = False

            timeline.append(item)

        file_rows = cursor.execute("""
            SELECT
                up.id,
                up.group_id,
                up.sender_id,
                up.filename,
                up.stored_name,
                up.created_at,
                u.username AS sender_username
            FROM uploads up
            JOIN users u ON u.id = up.sender_id
            WHERE up.group_id = ?
        """, (group["id"],)).fetchall()

        for row in file_rows:
            if ("file", row["id"]) in hidden_keys:
                continue

            item = {
                "type": "file",
                "id": row["id"],
                "group_id": row["group_id"],
                "sender_id": row["sender_id"],
                "sender_username": row["sender_username"],
                "file_name": row["filename"],
                "file_url": f"/api/messages/file/{row['stored_name']}",
                "created_at": row["created_at"]
            }

            deleted_meta = deleted_map.get(("file", row["id"]))
            if deleted_meta:
                item["file_name"] = ""
                item["file_url"] = None
                item.update(deleted_meta)
            else:
                item["deleted_for_everyone"] = False

            timeline.append(item)

        timeline.sort(key=lambda x: x["created_at"])
        last_message = timeline[-1] if timeline else None

        last_read_at = _get_group_last_read_at(cursor, current_user["id"], group["id"])
        unread_count = _get_group_unread_count(
            cursor,
            current_user["id"],
            group["id"],
            last_read_at
        )

        result.append({
            "id": group["id"],
            "name": group["name"],
            "created_by": group["created_by"],
            "created_at": group["created_at"],
            "member_count": group["member_count"],
            "last_message": last_message,
            "unread_count": unread_count,
            "has_unread": unread_count > 0
        })

    conn.close()

    return jsonify({
        "ok": True,
        "groups": result
    }), 200


def create_group():
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    member_ids = data.get("member_ids") or []

    if not name:
        return jsonify({
            "ok": False,
            "message": "Group name is required."
        }), 400

    if not isinstance(member_ids, list):
        return jsonify({
            "ok": False,
            "message": "member_ids must be a list."
        }), 400

    clean_member_ids = []
    for member_id in member_ids:
        try:
            clean_member_ids.append(int(member_id))
        except Exception:
            pass

    clean_member_ids = list(set(clean_member_ids))
    clean_member_ids = [x for x in clean_member_ids if x != current_user["id"]]

    if len(clean_member_ids) < 1:
        return jsonify({
            "ok": False,
            "message": "Select at least one member."
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    for member_id in clean_member_ids:
        contact_exists = cursor.execute("""
            SELECT id
            FROM contacts
            WHERE user_id = ? AND contact_user_id = ?
        """, (current_user["id"], member_id)).fetchone()

        if not contact_exists:
            conn.close()
            return jsonify({
                "ok": False,
                "message": f"User with id {member_id} is not your contact."
            }), 403

    created_at = now_iso()

    cursor.execute("""
        INSERT INTO groups_chat (name, created_by, created_at)
        VALUES (?, ?, ?)
    """, (name, current_user["id"], created_at))

    group_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO group_members (group_id, user_id, added_at)
        VALUES (?, ?, ?)
    """, (group_id, current_user["id"], created_at))

    for member_id in clean_member_ids:
        cursor.execute("""
            INSERT INTO group_members (group_id, user_id, added_at)
            VALUES (?, ?, ?)
        """, (group_id, member_id, created_at))

    cursor.execute("""
        INSERT OR REPLACE INTO group_reads
        (user_id, group_id, last_read_at)
        VALUES (?, ?, ?)
    """, (
        current_user["id"],
        group_id,
        created_at
    ))

    for member_id in clean_member_ids:
        cursor.execute("""
            INSERT OR REPLACE INTO group_reads
            (user_id, group_id, last_read_at)
            VALUES (?, ?, NULL)
        """, (
            member_id,
            group_id
        ))

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "message": "Group created successfully.",
        "group": {
            "id": group_id,
            "name": name,
            "member_count": len(clean_member_ids) + 1,
            "created_at": created_at
        }
    }), 201


def leave_group(group_id):
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    conn = get_connection()
    cursor = conn.cursor()

    group_row = cursor.execute("""
        SELECT id, name
        FROM groups_chat
        WHERE id = ?
    """, (group_id,)).fetchone()

    if not group_row:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "Group not found."
        }), 404

    member_row = cursor.execute("""
        SELECT id
        FROM group_members
        WHERE group_id = ? AND user_id = ?
    """, (group_id, current_user["id"])).fetchone()

    if not member_row:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "You are not a member of this group."
        }), 400

    cursor.execute("""
        DELETE FROM group_members
        WHERE group_id = ? AND user_id = ?
    """, (group_id, current_user["id"]))

    cursor.execute("""
        DELETE FROM group_reads
        WHERE group_id = ? AND user_id = ?
    """, (group_id, current_user["id"]))

    cursor.execute("""
        DELETE FROM hidden_items
        WHERE owner_user_id = ?
          AND chat_type = 'group'
          AND item_id IN (
              SELECT id FROM group_messages WHERE group_id = ?
          )
    """, (current_user["id"], group_id))

    cursor.execute("""
        DELETE FROM hidden_items
        WHERE owner_user_id = ?
          AND chat_type = 'group'
          AND item_id IN (
              SELECT id FROM uploads WHERE group_id = ?
          )
    """, (current_user["id"], group_id))

    remaining_members = cursor.execute("""
        SELECT COUNT(*) AS count
        FROM group_members
        WHERE group_id = ?
    """, (group_id,)).fetchone()["count"]

    if remaining_members <= 0:
        cursor.execute("""
            DELETE FROM groups_chat
            WHERE id = ?
        """, (group_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "message": "You left the group.",
        "group_id": group_id,
        "group_name": group_row["name"],
        "remaining_members": remaining_members
    }), 200


def get_group_messages(group_id):
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    conn = get_connection()
    cursor = conn.cursor()

    member = cursor.execute("""
        SELECT id
        FROM group_members
        WHERE group_id = ? AND user_id = ?
    """, (group_id, current_user["id"])).fetchone()

    if not member:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "Group not found."
        }), 404

    hidden_keys = _get_hidden_keys(cursor, current_user["id"], "group")
    deleted_map = _get_deleted_map(cursor, "group")

    group_row = cursor.execute("""
        SELECT id, name, created_by, created_at
        FROM groups_chat
        WHERE id = ?
    """, (group_id,)).fetchone()

    text_messages = cursor.execute("""
        SELECT
            gm.id,
            gm.group_id,
            gm.sender_id,
            gm.encoded_text,
            gm.created_at,
            u.username AS sender_username
        FROM group_messages gm
        JOIN users u ON u.id = gm.sender_id
        WHERE gm.group_id = ?
        ORDER BY gm.id ASC
    """, (group_id,)).fetchall()

    file_messages = cursor.execute("""
        SELECT
            up.id,
            up.group_id,
            up.sender_id,
            up.filename,
            up.stored_name,
            up.created_at,
            u.username AS sender_username
        FROM uploads up
        JOIN users u ON u.id = up.sender_id
        WHERE up.group_id = ?
        ORDER BY up.id ASC
    """, (group_id,)).fetchall()

    members = cursor.execute("""
        SELECT
            u.id,
            u.username
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY u.username ASC
    """, (group_id,)).fetchall()

    result_messages = []

    for row in text_messages:
        if ("text", row["id"]) in hidden_keys:
            continue

        item = {
            "type": "text",
            "id": row["id"],
            "group_id": row["group_id"],
            "sender_id": row["sender_id"],
            "sender_username": row["sender_username"],
            "encoded_text": row["encoded_text"],
            "created_at": row["created_at"]
        }

        deleted_meta = deleted_map.get(("text", row["id"]))
        if deleted_meta:
            item["encoded_text"] = ""
            item["reactions"] = []
            item.update(deleted_meta)
        else:
            item["deleted_for_everyone"] = False
            item["reactions"] = _build_reaction_summary(
                cursor,
                "group",
                "text",
                row["id"],
                current_user["id"]
            )

        result_messages.append(item)

    for row in file_messages:
        if ("file", row["id"]) in hidden_keys:
            continue

        item = {
            "type": "file",
            "id": row["id"],
            "group_id": row["group_id"],
            "sender_id": row["sender_id"],
            "sender_username": row["sender_username"],
            "file_name": row["filename"],
            "file_url": f"/api/messages/file/{row['stored_name']}",
            "created_at": row["created_at"]
        }

        deleted_meta = deleted_map.get(("file", row["id"]))
        if deleted_meta:
            item["file_name"] = ""
            item["file_url"] = None
            item["reactions"] = []
            item.update(deleted_meta)
        else:
            item["deleted_for_everyone"] = False
            item["reactions"] = _build_reaction_summary(
                cursor,
                "group",
                "file",
                row["id"],
                current_user["id"]
            )

        result_messages.append(item)

    result_messages.sort(key=lambda x: x["created_at"])

    result_members = [{
        "id": row["id"],
        "username": row["username"]
    } for row in members]

    conn.close()

    return jsonify({
        "ok": True,
        "group": {
            "id": group_row["id"],
            "name": group_row["name"],
            "created_by": group_row["created_by"],
            "created_at": group_row["created_at"],
            "member_count": len(result_members),
            "members": result_members
        },
        "messages": result_messages
    }), 200


def mark_group_read(group_id):
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    conn = get_connection()
    cursor = conn.cursor()

    member = cursor.execute("""
        SELECT id
        FROM group_members
        WHERE group_id = ? AND user_id = ?
    """, (group_id, current_user["id"])).fetchone()

    if not member:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "Group not found."
        }), 404

    cursor.execute("""
        INSERT OR REPLACE INTO group_reads
        (user_id, group_id, last_read_at)
        VALUES (?, ?, ?)
    """, (
        current_user["id"],
        group_id,
        now_iso()
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True
    }), 200


def send_group_message(group_id):
    current_user = _get_current_user()

    if not current_user:
        return jsonify({
            "ok": False,
            "message": "Unauthorized."
        }), 401

    data = request.get_json(silent=True) or {}
    encoded_text = (data.get("encoded_text") or "").strip()

    if not encoded_text:
        return jsonify({
            "ok": False,
            "message": "encoded_text is required."
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    member = cursor.execute("""
        SELECT id
        FROM group_members
        WHERE group_id = ? AND user_id = ?
    """, (group_id, current_user["id"])).fetchone()

    if not member:
        conn.close()
        return jsonify({
            "ok": False,
            "message": "Group not found."
        }), 404

    created_at = now_iso()

    cursor.execute("""
        INSERT INTO group_messages (group_id, sender_id, encoded_text, created_at)
        VALUES (?, ?, ?, ?)
    """, (group_id, current_user["id"], encoded_text, created_at))

    message_id = cursor.lastrowid

    cursor.execute("""
        INSERT OR REPLACE INTO group_reads
        (user_id, group_id, last_read_at)
        VALUES (?, ?, ?)
    """, (
        current_user["id"],
        group_id,
        created_at
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "message": "Group message sent.",
        "data": {
            "id": message_id,
            "group_id": group_id,
            "sender_id": current_user["id"],
            "sender_username": current_user["username"],
            "encoded_text": encoded_text,
            "created_at": created_at
        }
    }), 201