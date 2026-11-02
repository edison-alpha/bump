/*
 * iOS standalone PWA (black-translucent status bar) reports a viewport one status bar shorter than the
 * screen, so a `fixed inset-0` console stops short and the page background shows under the deck.
 * In standalone mode the app always owns the whole screen, so pin the console's height to the screen's.
 * Inline script (not an effect) so the first paint is already the right size.
 */
const SCRIPT = `(() => {
  const root = document.documentElement;
  const fit = () => {
    const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
    const portrait = innerHeight >= innerWidth;
    const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    if (standalone && full > innerHeight) root.style.setProperty("--app-h", full + "px");
    else root.style.removeProperty("--app-h");
  };
  fit();
  addEventListener("resize", fit);
  addEventListener("orientationchange", fit);
})();`;

export function StandaloneHeight() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
