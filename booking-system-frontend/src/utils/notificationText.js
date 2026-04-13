export const normalizeNotificationText = (value) => {
    if (typeof value !== 'string') return value;

    return value
        // Common UTF-8 -> Windows-1252 mojibake for peso symbol
        .replace(/\u00E2\u201A\u00B1/g, '\u20B1')
        .replace(/\u00C2\u20B1/g, '\u20B1');
};
