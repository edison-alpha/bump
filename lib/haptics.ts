let probe: HTMLLabelElement | null = null;

/**
 * iOS Safari has no Vibration API, but since iOS 17.4 toggling a native `<input type="checkbox" switch>` ticks the
 * Taptic Engine. A hidden one is clicked instead, which only fires inside a touch/click handler.
 */
function iosTick() {
  if (!probe) {
    probe = document.createElement("label");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    probe.append(input);
    document.body.append(probe);
  }
  probe.click();
}

/** A haptic tap on every device: `navigator.vibrate` where it exists (Android), a Taptic tick on iOS. Same pattern format as `vibrate`. */
export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
      return;
    }
    // iOS ticks have no length: one per vibrate pulse (even indexes), spaced as the pattern spaces them
    let at = 0;
    (Array.isArray(pattern) ? pattern : [pattern]).forEach((ms, i) => {
      if (i % 2 === 0) {
        if (at === 0) iosTick();
        else setTimeout(iosTick, at);
      }
      at += ms;
    });
  } catch {
    // no haptics on this device
  }
}
