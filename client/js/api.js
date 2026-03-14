async function apiRequest(path, method = "GET", body = null, useAuth = false) {
    const headers = {};

    if (body !== null) {
        headers["Content-Type"] = "application/json";
    }

    if (useAuth) {
        const token = getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }

    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : null
    });

    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = { ok: false, message: "Invalid server response." };
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}
