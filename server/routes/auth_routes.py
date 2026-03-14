from flask import Blueprint
from server.controllers.auth_controller import register, login, me

auth_bp = Blueprint("auth_bp", __name__)

auth_bp.add_url_rule("/register", view_func=register, methods=["POST"])
auth_bp.add_url_rule("/login", view_func=login, methods=["POST"])
auth_bp.add_url_rule("/me", view_func=me, methods=["GET"])