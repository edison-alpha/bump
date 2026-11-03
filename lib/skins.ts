/** Console body colours. The colours themselves live in globals.css (`:root[data-skin]`); this is the list and the storage. */
export const SKINS = [
  { id: "blue", label: "Original blue", swatch: ["#86d9ff", "#1585ee"] },
  { id: "frosted", label: "Frosted glass", swatch: ["#e2f4ff", "#62abe8"] },
  { id: "aluminum", label: "Space aluminum", swatch: ["#f3f5f8", "#7e8590"] },
  { id: "cream", label: "Retro cream", swatch: ["#fff7e2", "#cfba8c"] },
  { id: "midnight", label: "Midnight", swatch: ["#3f5a9c", "#121e41"] },
  { id: "tech", label: "Clear tech", swatch: ["#9fd8c3", "#0e4a38"] },
  { id: "mint", label: "Pocket mint", swatch: ["#d6f7e5", "#5ec495"] },
  { id: "red", label: "Arcade red", swatch: ["#ff7d70", "#a61b18"] },
  { id: "lilac", label: "Soft lilac", swatch: ["#eee7ff", "#9b87da"] },
  { id: "white", label: "Ceramic white", swatch: ["#ffffff", "#c9cdd4"] },
] as const;

export type SkinId = (typeof SKINS)[number]["id"];

export const SKIN_KEY = "bump:skin";

/** Runs in <head> before first paint, so a saved skin never flashes the default blue. */
export const SKIN_BOOT_SCRIPT = `try{var s=localStorage.getItem("${SKIN_KEY}");if(s)document.documentElement.dataset.skin=s}catch(e){}`;

export function currentSkin(): SkinId {
  const id = typeof document === "undefined" ? undefined : document.documentElement.dataset.skin;
  return SKINS.find((s) => s.id === id)?.id ?? "blue";
}

export function setSkin(id: SkinId) {
  document.documentElement.dataset.skin = id;
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    // the skin still applies for this visit
  }
}
