from flask import Blueprint
from server.controllers.message_controller import (
    send_message,
    get_conversation,
    upload_file,
    serve_file,
    add_reaction,
    hide_message,
    delete_message,
    mark_direct_read,
    forward_message,
    typing_ping,
    get_typing
)

message_bp = Blueprint("message", __name__)

message_bp.route("/send", methods=["POST"])(send_message)
message_bp.route("/conversation", methods=["GET"])(get_conversation)
message_bp.route("/upload", methods=["POST"])(upload_file)
message_bp.route("/file/<filename>", methods=["GET"])(serve_file)

message_bp.route("/react", methods=["POST"])(add_reaction)
message_bp.route("/hide", methods=["POST"])(hide_message)
message_bp.route("/delete", methods=["POST"])(delete_message)
message_bp.route("/read", methods=["POST"])(mark_direct_read)

# forward
message_bp.route("/forward", methods=["POST"])(forward_message)

# typing
message_bp.route("/typing", methods=["POST"])(typing_ping)
message_bp.route("/typing", methods=["GET"])(get_typing)