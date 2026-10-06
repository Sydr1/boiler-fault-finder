// Job notes, saved on-device only (localStorage). No network calls.
const NOTES_KEY = "bff_notes_v1";
const FAVS_KEY = "bff_favs_v1";
const RECENTS_KEY = "bff_recents_v1";
const THEME_KEY = "bff_theme_v1";
const PROGRESS_KEY_PREFIX = "bff_progress_";

const Store = {
  _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage full or unavailable — fail silently */ }
  },

  getNotes() { return this._read(NOTES_KEY, []); },
  saveNote(note) {
    const notes = this.getNotes();
    notes.unshift(note);
    this._write(NOTES_KEY, notes);
  },
  deleteNote(id) {
    const notes = this.getNotes().filter((n) => n.id !== id);
    this._write(NOTES_KEY, notes);
  },

  getFavs() { return this._read(FAVS_KEY, []); },
  isFav(id) { return this.getFavs().includes(id); },
  toggleFav(id) {
    let favs = this.getFavs();
    if (favs.includes(id)) favs = favs.filter((f) => f !== id);
    else favs.unshift(id);
    this._write(FAVS_KEY, favs.slice(0, 30));
    return favs.includes(id);
  },

  getRecents() { return this._read(RECENTS_KEY, []); },
  pushRecent(id) {
    let recents = this.getRecents().filter((r) => r !== id);
    recents.unshift(id);
    this._write(RECENTS_KEY, recents.slice(0, 12));
  },

  getTheme() { return this._read(THEME_KEY, "auto"); },
  setTheme(t) { this._write(THEME_KEY, t); },

  getProgress(entryId) { return this._read(PROGRESS_KEY_PREFIX + entryId, {}); },
  setProgress(entryId, progress) { this._write(PROGRESS_KEY_PREFIX + entryId, progress); },
};

function makeNoteId() {
  return "n_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function formatNoteForExport(note) {
  const d = new Date(note.ts);
  const job = note.job ? `[${note.job}] ` : "";
  return `${d.toLocaleString()} — ${job}${note.text}`;
}
