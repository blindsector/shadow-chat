from flask import Blueprint
from server.controllers.user_controller import (
    add_contact,
    list_contacts,
    ping_presence,
    update_presence_visibility,
    get_contact_presence,
    register_device_token,
)

user_bp = Blueprint("user_bp", __name__)

user_bp.add_url_rule("/contacts", view_func=list_contacts, methods=["GET"])
user_bp.add_url_rule("/contacts/add", view_func=add_contact, methods=["POST"])

user_bp.add_url_rule("/presence/ping", view_func=ping_presence, methods=["POST"])
user_bp.add_url_rule("/presence/visibility", view_func=update_presence_visibility, methods=["POST"])
user_bp.add_url_rule("/presence/<int:contact_id>", view_func=get_contact_presence, methods=["GET"])

user_bp.add_url_rule("/device/register", view_func=register_device_token, methods=["POST"])