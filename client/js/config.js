const API_BASE = window.location.protocol === "file:"
    ? "http://127.0.0.1:5055"
    : window.location.origin;

const STORAGE_TOKEN = "shadow_token";
const STORAGE_ACTIVE_CHAT_ID = "shadow_active_chat_id";
const STORAGE_ACTIVE_CHAT_TYPE = "shadow_active_chat_type";
const STORAGE_RECEIPTS = "shadow_receipts";

const MENU_EMOJIS = ["👍","❤️","😂","😮","😢","🔥"];
