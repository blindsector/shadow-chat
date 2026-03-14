

/* ---------------- ENCODE / DECODE ---------------- */

function smartSplit(text) {
    return text.match(/[A-Za-zА-Яа-я0-9]+|[^\sA-Za-zА-Яа-я0-9]/g) || [];
}

function preserveCase(original, replacement) {
    if (original === original.toUpperCase()) return replacement.toUpperCase();
    if (original[0] === original[0].toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
}

function isWordToken(token) {
    return /^[A-Za-zА-Яа-я0-9]+$/.test(token);
}

function isDigitToken(token) {
    return /^\d$/.test(token);
}

function isNumericString(token) {
    return /^\d+$/.test(token);
}

function transformWord(word) {
    const lower = word.toLowerCase();

    if (typeof NUMBER !== "undefined" && NUMBER[lower]) return NUMBER[lower];
    if (typeof ADJ !== "undefined" && ADJ[lower]) return preserveCase(word, ADJ[lower]);
    if (typeof NOUN !== "undefined" && NOUN[lower]) return preserveCase(word, NOUN[lower]);
    if (typeof VERB !== "undefined" && VERB[lower]) return preserveCase(word, VERB[lower]);
    if (typeof PRONOUN !== "undefined" && PRONOUN[lower]) return preserveCase(word, PRONOUN[lower]);
    if (typeof OTHER !== "undefined" && OTHER[lower]) return preserveCase(word, OTHER[lower]);

    return word;
}

function expandNumberTokens(tokens) {
    const expanded = [];

    for (const token of tokens) {
        if (isNumericString(token) && token.length > 1) {
            expanded.push(...token.split(""));
        } else {
            expanded.push(token);
        }
    }

    return expanded;
}

function joinTokens(tokens) {
    let result = "";

    for (let i = 0; i < tokens.length; i++) {
        const current = tokens[i];
        const prev = i > 0 ? tokens[i - 1] : null;

        if (i > 0) {
            const currentIsWord = isWordToken(current);
            const prevIsWord = isWordToken(prev);

            if (currentIsWord && prevIsWord) {
                result += " ";
            } else if (currentIsWord && /[)\]»"„]/.test(prev)) {
                result += " ";
            } else if (/^[([{"«„]$/.test(current) && prevIsWord) {
                result += " ";
            }
        }

        result += current;
    }

    return result;
}

function encodeText(text) {
    const rawTokens = smartSplit(text);
    const expandedTokens = expandNumberTokens(rawTokens);

    const transformedTokens = expandedTokens.map(token => {
        if (isWordToken(token)) return transformWord(token);
        return token;
    });

    return joinTokens(transformedTokens);
}

function decodeText(text) {
    const tokens = smartSplit(text);
    const transformed = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (!isWordToken(token)) {
            transformed.push(token);
            continue;
        }

        transformed.push(transformWord(token));
    }

    const merged = [];
    let digitBuffer = "";

    for (const token of transformed) {
        if (isDigitToken(token)) {
            digitBuffer += token;
            continue;
        }

        if (digitBuffer) {
            merged.push(digitBuffer);
            digitBuffer = "";
        }

        merged.push(token);
    }

    if (digitBuffer) {
        merged.push(digitBuffer);
    }

    return joinTokens(merged);
}














