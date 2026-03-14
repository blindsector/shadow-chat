function fallbackCopyText(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.focus();
    area.select();

    let success = false;
    try {
        success = document.execCommand("copy");
    } catch (error) {
        success = false;
    }

    document.body.removeChild(area);
    return success;
}

function flashCopyButtonState(btn, success) {
    if (!btn) return;

    const oldText = btn.dataset.oldText || btn.textContent;
    btn.dataset.oldText = oldText;

    if (btn._copyResetTimer) {
        clearTimeout(btn._copyResetTimer);
    }

    btn.classList.remove("is-copied", "is-copy-failed");

    if (success) {
        btn.textContent = "Copied";
        btn.classList.add("is-copied");
    } else {
        btn.textContent = "No copy";
    }

    btn._copyResetTimer = setTimeout(() => {
        btn.classList.remove("is-copied", "is-copy-failed");
        btn.textContent = oldText;
    }, success ? 1500 : 900);
}

async function copyText(text, btn = null) {
    let success = false;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            success = true;
        } else {
            success = fallbackCopyText(text);
        }
    } catch (error) {
        success = fallbackCopyText(text);
    }

    if (btn) {
        flashCopyButtonState(btn, success);
    }

    return success;
}