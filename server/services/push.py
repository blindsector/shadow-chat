import os
import firebase_admin
from firebase_admin import credentials, messaging

from server.services.db import get_connection


FIREBASE_APP = None

SERVICE_ACCOUNT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "firebase-service-account.json"
)


def _get_firebase_app():
    global FIREBASE_APP

    if FIREBASE_APP is not None:
        return FIREBASE_APP

    print("🔍 Checking Firebase service account path:", SERVICE_ACCOUNT_PATH)

    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print("❌ Firebase service account NOT FOUND")
        return None

    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        FIREBASE_APP = firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized")
        return FIREBASE_APP
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