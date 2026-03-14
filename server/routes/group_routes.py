from flask import Blueprint
from server.controllers.group_controller import (
    list_groups,
    create_group,
    leave_group,
    get_group_messages,
    mark_group_read,
    send_group_message
)

group_bp = Blueprint("group_bp", __name__)

group_bp.add_url_rule("/", view_func=list_groups, methods=["GET"])
group_bp.add_url_rule("/create", view_func=create_group, methods=["POST"])
group_bp.add_url_rule("/<int:group_id>/leave", view_func=leave_group, methods=["POST"])
group_bp.add_url_rule("/<int:group_id>/messages", view_func=get_group_messages, methods=["GET"])
group_bp.add_url_rule("/<int:group_id>/read", view_func=mark_group_read, methods=["POST"])
group_bp.add_url_rule("/<int:group_id>/send", view_func=send_group_message, methods=["POST"])