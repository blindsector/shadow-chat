function resolveFileUrl(item) {
    const raw = item && item.file_url ? String(item.file_url) : "";

    if (!raw) return "";

    if (
        raw.startsWith("blob:") ||
        raw.startsWith("data:") ||
        raw.startsWith("http://") ||
        raw.startsWith("https://")
    ) {
        return raw;
    }

    return `${API_BASE}${raw}`;
}

function isAudioItem(item) {
    if (!item) return false;

    const mime = String(item.mime_type || item.type || "").toLowerCase();
    const name = String(item.file_name || item.filename || "").toLowerCase();
    const url = String(item.file_url || "").toLowerCase();

    return (
        mime.startsWith("audio/") ||
        /\.(mp3|m4a|aac|wav|ogg|oga|webm)$/i.test(name) ||
        /\.(mp3|m4a|aac|wav|ogg|oga|webm)(\?|$)/i.test(url)
    );
}

function getAudioPlaybackKey(item) {
    if (!item) return "";

    if (item.id) {
        return `audio:${item.id}`;
    }

    return `audio:${resolveFileUrl(item)}:${item.file_name || item.filename || ""}`;
}

function openImagePreview(url) {
    imageViewerImg.src = url;
    imageViewer.classList.remove("hidden");
}

function closeImagePreview() {
    imageViewerImg.src = "";
    imageViewer.classList.add("hidden");
}

function makeFileCard(item) {
    const url = resolveFileUrl(item);
    const isImage = isImageUrl(item.file_url || "") || item.type === "image";

    if (isImage) {
        const wrap = document.createElement("div");

        const img = document.createElement("img");
        img.src = url;
        img.alt = "image";
        img.className = "chat-image";
        img.addEventListener("click", (e) => {
            e.stopPropagation();
            openImagePreview(url);
        });

        wrap.appendChild(img);
        return wrap;
    }

    if (isAudioItem(item)) {
        const wrap = document.createElement("div");
        wrap.className = "audio-card";
        wrap.style.minWidth = "220px";
        wrap.style.maxWidth = "280px";

        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = url;
        audio.style.width = "100%";
        audio.style.display = "block";
        audio.dataset.audioKey = getAudioPlaybackKey(item);

        wrap.appendChild(audio);
        return wrap;
    }

    const link = document.createElement("a");
    link.className = "file-card";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "block";
    link.style.textDecoration = "none";
    link.style.padding = "10px 12px";
    link.style.borderRadius = "14px";
    link.style.background = "rgba(255,255,255,0.06)";
    link.style.border = "1px solid rgba(255,255,255,0.08)";
    link.style.backdropFilter = "blur(4px)";
    link.style.minWidth = "210px";
    link.style.maxWidth = "260px";

    const head = document.createElement("div");
    head.className = "file-card-head";
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";

    const icon = document.createElement("div");
    icon.className = "file-icon";
    icon.textContent = "📎";
    icon.style.fontSize = "18px";
    icon.style.lineHeight = "1";

    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.style.minWidth = "0";
    meta.style.flex = "1";

    const fileName = document.createElement("div");
    fileName.className = "file-name";
    fileName.textContent = item.file_name || "file";
    fileName.style.fontSize = "13px";
    fileName.style.fontWeight = "600";
    fileName.style.lineHeight = "1.3";
    fileName.style.overflow = "hidden";
    fileName.style.textOverflow = "ellipsis";
    fileName.style.whiteSpace = "nowrap";

    const open = document.createElement("div");
    open.className = "file-open";
    open.textContent = "Open / Download";
    open.style.fontSize = "11px";
    open.style.opacity = "0.68";
    open.style.marginTop = "2px";

    meta.appendChild(fileName);
    meta.appendChild(open);

    head.appendChild(icon);
    head.appendChild(meta);
    link.appendChild(head);

    return link;
}
