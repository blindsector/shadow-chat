import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from server.services.db import init_db
from server.routes.auth_routes import auth_bp
from server.routes.user_routes import user_bp
from server.routes.message_routes import message_bp
from server.routes.group_routes import group_bp


SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SERVER_DIR)
CLIENT_DIR = os.path.join(PROJECT_ROOT, "client")


def create_app():
    app = Flask(__name__, static_folder=CLIENT_DIR, static_url_path="")
    CORS(app)

    init_db()

    @app.get("/")
    def home():
        index_path = os.path.join(CLIENT_DIR, "index.html")

        if os.path.exists(index_path):
            return send_from_directory(CLIENT_DIR, "index.html")

        return jsonify({
            "ok": True,
            "message": "Server is running."
        }), 200

    @app.get("/health")
    def health():
        return jsonify({
            "ok": True,
            "message": "Healthy."
        }), 200

    @app.get("/version.json")
    def version():
        return jsonify({
            "ok": True,
            "version": "0.1.0"
        }), 200

    @app.get("/<path:path>")
    def static_proxy(path):
        file_path = os.path.join(CLIENT_DIR, path)

        if os.path.isfile(file_path):
            return send_from_directory(CLIENT_DIR, path)

        return send_from_directory(CLIENT_DIR, "index.html")

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api/users")
    app.register_blueprint(message_bp, url_prefix="/api/messages")
    app.register_blueprint(group_bp, url_prefix="/api/groups")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5055, debug=True)
