/*
 * Some iOS versions give a standalone PWA (black-translucent status bar) a web view that stops short of the
 * bottom of the screen; iOS paints the strip below it with the page background and web content can't draw
 * there. The home indicator then sits outside the page, so the deck's safe-area padding is wasted space.
 * When that happens, mark <html data-short-viewport>: the deck uses regular bottom spacing and the bezel loses its
 * bottom shade so it runs straight into the system strip (same colour, see globals.css).
 * Inline script (not an effect) so the first paint already has the right layout.
 */
const SCRIPT = `(() => {
  const root = document.documentElement;
  const fit = () => {
    const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
    const portrait = innerHeight >= innerWidth;
    const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    root.toggleAttribute("data-short-viewport", Boolean(standalone && full - innerHeight > 20));
  };
  fit();
  addEventListener("resize", fit);
  addEventListener("orientationchange", fit);
})();`;

export function StandaloneViewport() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
