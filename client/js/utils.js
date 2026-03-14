function parseServerDate(ts) {
    if (!ts) return null;

    const raw = String(ts).trim();
    if (!raw) return null;

    let normalized = raw;

    if (
        !normalized.endsWith("Z") &&
        !/[+-]\d{2}:\d{2}$/.test(normalized)
    ) {
        normalized += "Z";
    }

    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) {
        return null;
    }

    return d;
}

function formatTimeShort(ts) {
    const d = parseServerDate(ts);
    if (!d) return "";

    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
}

function formatLastSeen(ts) {
    const d = parseServerDate(ts);
    if (!d) return "";

    const now = new Date();

    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin < 2) {
        return "just now";
    }

    if (diffMin < 60) {
        return `${diffMin} min ago`;
    }

    if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    }

    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastSeenDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((nowDay.getTime() - lastSeenDay.getTime()) / 86400000);

    if (dayDiff === 1) {
        return `yesterday at ${formatTimeShort(ts)}`;
    }

    return `at ${formatTimeShort(ts)}`;
}

function initialsFromText(text) {
    if (!text) return "?";
    const parts = text.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function isImageUrl(url) {
    if (!url) return false;
    return url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
}