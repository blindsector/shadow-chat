const API_BASE = "http://127.0.0.1:5055";

const output = document.getElementById("output");
const tokenBox = document.getElementById("tokenBox");

const registerUsername = document.getElementById("registerUsername");
const registerPassword = document.getElementById("registerPassword");

const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");

const inviteCodeInput = document.getElementById("inviteCodeInput");

const receiverIdInput = document.getElementById("receiverIdInput");
const encodedTextInput = document.getElementById("encodedTextInput");
const conversationContactIdInput = document.getElementById("conversationContactIdInput");

const healthBtn = document.getElementById("healthBtn");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const meBtn = document.getElementById("meBtn");
const logoutBtn = document.getElementById("logoutBtn");
const addContactBtn = document.getElementById("addContactBtn");
const contactsBtn = document.getElementById("contactsBtn");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const loadConversationBtn = document.getElementById("loadConversationBtn");

function setOutput(data) {
    output.textContent = JSON.stringify(data, null, 2);
}

function getToken() {
    return localStorage.getItem("shadow_token") || "";
}

function setToken(token) {
    localStorage.setItem("shadow_token", token);
    renderToken();
}

function clearToken() {
    localStorage.removeItem("shadow_token");
    renderToken();
}

function renderToken() {
    tokenBox.textContent = getToken() || "(няма token)";
}

async function apiRequest(path, method = "GET", body = null, useAuth = false) {
    const headers = {
        "Content-Type": "application/json"
    };

    if (useAuth && getToken()) {
        headers["Authorization"] = `Bearer ${getToken()}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });

    const data = await response.json();
    return data;
}

healthBtn.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/health");
        setOutput(data);
    } catch (error) {
        setOutput({ ok: false, message: error.message });
    }
});

registerBtn.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/api/auth/register", "POST", {
            username: registerUsername.value.trim(),
            password: registerPassword.value.trim()
        });

        if (data.token) {
            setToken(data.token);
        }

        setOutput(data);
    } catch (error) {
        setOutput({ ok: false, message: error.message });
    }
});

loginBtn.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/api/auth/login", "POST", {
            username: loginUsername.value.trim(),
            password: loginPassword.value.trim()
        });

        if (data.token) {
            setToken(data.token);
        }

        setOutput(data);
    } catch (error) {
        setOutput({ ok: false, message: error.message });
    }
});

meBtn.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/api/auth/me", "GET", null, true);
        setOutput(data);
    } catch (error) {
        setOutput({ ok: false, message: error.message });
    }
});

logoutBtn.addEventListener("click", () => {
    clearToken();
    setOutput({ ok: true, message: "Logged out." });
});

addContactBtn.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/api/users/contacts/add", "POST", {
            invite_code: inviteCodeInput.value.trim()
        }, true);

        setOutput(data);
    } catch (error) {
        setOutput({ ok: false, message: error.message });
    }
});

contactsBtn.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/api/users/contacts", "GET", null, true);
        setOutput(data);
    } catch (error) {
        setOutput({ ok: false, message: error.message });
    }
});

sendMessageBtn.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/api/messages/send", "POST", {
            receiver_id: Number(receiverIdInput.value),
            encoded_text: encodedTextInput.value.trim()
        }, true);

        setOutput(data);
    } catch (error) {
        setOutput({ ok: false, message: error.message });
    }
});

loadConversationBtn.addEventListener("click", async () => {
    try {
        const contactId = Number(conversationContactIdInput.value);
        const data = await apiRequest(`/api/messages/conversation?contact_id=${contactId}`, "GET", null, true);
        setOutput(data);
    } catch (error) {
        setOutput({ ok: false, message: error.message });
    }
});

renderToken();