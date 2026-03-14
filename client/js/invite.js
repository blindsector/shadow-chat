const INVITE_PENDING_KEY = "shadowchat_pending_invite_code";

function ensureInviteToast() {
    let toast = document.getElementById("inviteToast");

    if (toast) {
        return toast;
    }

    toast = document.createElement("div");
    toast.id = "inviteToast";
    toast.style.position = "fixed";
    toast.style.left = "50%";
    toast.style.bottom = "22px";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    toast.style.minWidth = "180px";
    toast.style.maxWidth = "calc(100vw - 32px)";
    toast.style.padding = "14px 18px";
    toast.style.borderRadius = "18px";
    toast.style.background = "rgba(12, 18, 28, 0.96)";
    toast.style.border = "1px solid rgba(255,255,255,0.08)";
    toast.style.boxShadow = "0 16px 40px rgba(0,0,0,0.35)";
    toast.style.color = "#ffffff";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "600";
    toast.style.textAlign = "center";
    toast.style.zIndex = "999999";
    toast.style.opacity = "0";
    toast.style.pointerEvents = "none";
    toast.style.transition = "opacity 0.22s ease, transform 0.22s ease";
    toast.style.backdropFilter = "blur(12px)";
    toast.style.webkitBackdropFilter = "blur(12px)";

    document.body.appendChild(toast);
    return toast;
}

function showInviteToast(message) {
    const toast = ensureInviteToast();
    toast.textContent = message || "";

    if (toast._hideTimer) {
        clearTimeout(toast._hideTimer);
    }

    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";

    toast._hideTimer = setTimeout(function () {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
    }, 2200);
}

function getInviteLink(inviteCode) {
    const code = String(inviteCode || "").trim();
    if (!code) return "";

    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("invite", code);
    return url.toString();
}

function getInviteQrUrl(inviteLink) {
    const link = String(inviteLink || "").trim();
    if (!link) return "";
    return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(link);
}

function storePendingInviteCode(inviteCode) {
    const code = String(inviteCode || "").trim().toUpperCase();
    if (!code) return;
    localStorage.setItem(INVITE_PENDING_KEY, code);
}

function getPendingInviteCode() {
    return String(localStorage.getItem(INVITE_PENDING_KEY) || "").trim().toUpperCase();
}

function clearPendingInviteCode() {
    localStorage.removeItem(INVITE_PENDING_KEY);
}

function readInviteCodeFromUrl() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get("invite") || "").trim().toUpperCase();
}

function clearInviteCodeFromUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("invite")) return;

    url.searchParams.delete("invite");
    const clean = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
    window.history.replaceState({}, "", clean);
}

function hydratePendingInviteFromUrl() {
    const inviteCode = readInviteCodeFromUrl();
    if (!inviteCode) return "";

    storePendingInviteCode(inviteCode);
    return inviteCode;
}

function openInviteModal() {
    if (!inviteModal || !state.user) return;

    const inviteCode = String(state.user.invite_code || "").trim().toUpperCase();
    const inviteLink = getInviteLink(inviteCode);

    if (inviteQrImage) {
        inviteQrImage.src = getInviteQrUrl(inviteLink);
    }

    if (inviteLinkText) {
        inviteLinkText.textContent = inviteLink;
    }

    if (inviteCodeText) {
        inviteCodeText.textContent = inviteCode;
    }

    inviteModal.classList.remove("hidden");
}

function closeInviteModal() {
    if (!inviteModal) return;
    inviteModal.classList.add("hidden");
}

async function copyInviteLink() {
    if (!state.user) return;

    const inviteLink = getInviteLink(state.user.invite_code);
    if (!inviteLink) return;

    await copyText(inviteLink);
    showInviteToast("Линкът е копиран.");
}

async function shareInviteLink() {
    if (!state.user) return;

    const inviteCode = String(state.user.invite_code || "").trim().toUpperCase();
    const inviteLink = getInviteLink(inviteCode);

    if (!inviteLink) return;

    const shareText = `Ела в Shadow Chat. Invite code: ${inviteCode}`;

    if (!navigator.share) {
        await copyText(inviteLink);
        showInviteToast("Устройството не поддържа share. Линкът е копиран.");
        return;
    }

    try {
        await navigator.share({
            title: "Shadow Chat",
            text: shareText,
            url: inviteLink
        });
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }

        console.error(error);
        showInviteToast("Неуспешно споделяне.");
    }
}

async function processPendingInviteAfterAuth() {
    if (!state.user) return false;
    if (state._inviteProcessing === true) return false;

    const inviteCode = getPendingInviteCode();
    if (!inviteCode) return false;

    const myInviteCode = String(state.user.invite_code || "").trim().toUpperCase();
    if (inviteCode === myInviteCode) {
        clearPendingInviteCode();
        clearInviteCodeFromUrl();
        return false;
    }

    state._inviteProcessing = true;

    try {
        await apiRequest("/api/users/contacts/add", "POST", {
            invite_code: inviteCode
        }, true);

        clearPendingInviteCode();
        clearInviteCodeFromUrl();
        showInviteToast("Сдвояването е готово.");
        return true;
    } catch (error) {
        const message = String((error && error.message) || "").toLowerCase();

        if (
            message.includes("already") ||
            message.includes("exists") ||
            message.includes("контакт") ||
            message.includes("вече")
        ) {
            clearPendingInviteCode();
            clearInviteCodeFromUrl();
            showInviteToast("Вече сте приятели.");
            return true;
        }

        console.error(error);
        showInviteToast(error.message || "Сдвояването не успя.");
        return false;
    } finally {
        state._inviteProcessing = false;
    }
}
