/**
 * Returns the default profile picture path based on the user's gender.
 * Falls back to the male default when gender is unknown.
 *
 * @param {string|null|undefined} gender - The user's gender string (e.g. "Male", "Female", "male", "female")
 * @returns {string} - A path to the default profile image in /images/
 */
export const getDefaultAvatar = (gender) => {
  const g = String(gender || '').toLowerCase();
  if (g === 'female' || g === 'f') {
    return '/images/female.jpg';
  }
  return '/images/male.jpg';
};

/**
 * Resolves the avatar URL to display.
 * - If the user has a server-uploaded avatar (/uploads/...), prefix it with the API media base URL.
 * - If the avatar is a data-URL (base64), return as-is.
 * - Otherwise, fall back to the gender-based default.
 *
 * @param {string|null|undefined} avatarField - The avatar value from the database / API response
 * @param {string|null|undefined} gender - The user's gender
 * @param {string} mediaBaseUrl - The base URL for server-uploaded files (e.g. http://localhost:5000)
 * @returns {string}
 */
export const resolveAvatar = (avatarField, gender, mediaBaseUrl = '') => {
  if (!avatarField) return getDefaultAvatar(gender);

  // data-URL (base64 preview) — use directly
  if (avatarField.startsWith('data:')) return avatarField;

  // Server-uploaded path — prepend media base URL
  if (avatarField.startsWith('/uploads/')) {
    return `${mediaBaseUrl}${avatarField}`;
  }

  // Absolute URL (http/https) — use as-is
  if (avatarField.startsWith('http')) return avatarField;

  return getDefaultAvatar(gender);
};
