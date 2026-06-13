export function readDraft(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read draft ${key}:`, error);
    return null;
  }
}

export function writeDraft(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write draft ${key}:`, error);
  }
}

export function clearDraft(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to clear draft ${key}:`, error);
  }
}