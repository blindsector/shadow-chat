import os
import firebase_admin
from firebase_admin import credentials, messaging

from server.services.db import get_connection


FIREBASE_APP = None

SECRET_FILE_PATH = "/etc/secrets/firebase-service-account.json"
LOCAL_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "firebase-service-account.json"
)


def _get_firebase_app():
    global FIREBASE_APP

    if FIREBASE_APP is not None:
        return FIREBASE_APP

    try:
        firebase_json = os.getenv("FIREBASE_CREDENTIALS_JSON")

        if firebase_json:
            import json
            cred_dict = json.loads(firebase_json)
            cred = credentials.Certificate(cred_dict)
            FIREBASE_APP = firebase_admin.initialize_app(cred)
            print("✅ Firebase initialized (ENV)")
            return FIREBASE_APP

        if os.path.exists(SECRET_FILE_PATH):
            cred = credentials.Certificate(SECRET_FILE_PATH)
            FIREBASE_APP = firebase_admin.initialize_app(cred)
            print("✅ Firebase initialized (SECRET FILE)")
            return FIREBASE_APP

        if os.path.exists(LOCAL_FILE_PATH):
            cred = credentials.Certificate(LOCAL_FILE_PATH)
            FIREBASE_APP = firebase_admin.initialize_app(cred)
            print("✅ Firebase initialized (LOCAL FILE)")
            return FIREBASE_APP

        print("❌ No Firebase credentials found")
        return None

    except Exception as e:
        print("❌ Firebase init error:", str(e))
        return None


def send_push_to_user(user_id, title, body):
    print("🚀 send_push_to_user:", user_id, title)

    app = _get_firebase_app()
    if app is None:
        print("❌ Firebase app is None")
        return

    conn = get_connection()
    cur = conn.cursor()

    rows = cur.execute("""
        SELECT token
        FROM device_tokens
        WHERE user_id = ?
    """, (user_id,)).fetchall()

    conn.close()

    print("📱 Found tokens:", len(rows))

    if not rows:
        print("❌ No tokens for user")
        return

    for row in rows:
        token = row["token"]
        print("👉 Sending to token:", token[:20], "...")

        try:
            message = messaging.Message(
                token=token,
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default",
                        channel_id="shadow_chat_messages"
                    )
                ),
                data={
                    "title": title,
                    "body": body
                }
            )

            response = messaging.send(message, app=app)
            print("✅ Push sent:", response)

        except Exception as e:
            print("❌ PUSH ERROR:", str(e))