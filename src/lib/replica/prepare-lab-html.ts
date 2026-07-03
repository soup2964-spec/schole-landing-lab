import type { HtmlReplacement } from "./apply-variant";
import { SECTION_MARKERS } from "./section-markers";

/**
 * Prepare Framer HTML for Landing Lab: keep Framer runtime (layout, responsive,
 * animations) but drop third-party analytics/chat that we don't need in iframes.
 */

function isFramerScript(tag: string): boolean {
  if (/framerusercontent\.com\/sites/i.test(tag)) return true;
  if (/events\.framer\.com/i.test(tag)) return true;
  if (/type=["']framer\/appear["']/i.test(tag)) return true;
  if (
    /__framer__|framer_variant|data-framer-appear|framer\/appearAnimationsContent|framer\/appear/i.test(
      tag
    )
  )
    return true;
  if (/window\.process.*NODE_ENV.*production/i.test(tag)) return true;
  if (/toLocaleString.*toLocaleDateString/i.test(tag)) return true;
  if (/function u\(\).*createElement\("a"\)/i.test(tag)) return true;
  return false;
}

/** Remove GTM/HubSpot/PostHog/etc. Keep Framer JS so the page renders correctly. */
export function stripThirdPartyScripts(html: string): string {
  let out = html.replace(/<script\b[\s\S]*?<\/script>/gi, (tag) =>
    isFramerScript(tag) ? tag : ""
  );

  out = out.replace(/<cs-native-frame-holder[\s\S]*?<\/cs-native-frame-holder>/gi, "");

  return out;
}

export function injectLabStyles(html: string): string {
  const style = `
<style id="landing-lab-overrides">
  [data-section-id].ll-highlight {
    outline: 4px solid rgb(251, 191, 36) !important;
    outline-offset: 4px !important;
  }
</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}\n</head>`) : html;
}

export function prepareLabHtml(html: string): string {
  return injectLabStyles(stripThirdPartyScripts(html));
}

/** Remove a previously injected guard (variants are built from the guarded baseline). */
export function stripLabGuard(html: string): string {
  return html.replace(
    /<script id="landing-lab-guard">[\s\S]*?<\/script>/g,
    ""
  );
}

/**
 * In-page guard, injected into every replica page.
 *
 * Framer hydration REBUILDS the DOM after load: it restores original CMS copy
 * and strips any attributes we injected into the static HTML (including
 * data-section-id markers). So the guard must not rely on pre-injected markup.
 * Instead it:
 *   1. re-marks sections by locating unique baseline (or already-patched) text
 *   2. re-applies variant text swaps, scoped to the section when possible
 * and repeats whenever the DOM mutates back to baseline copy.
 */
export function injectLabGuard(html: string, patches: HtmlReplacement[]): string {
  const patchesBySection = new Map<string, string>(
    patches.map((p) => [p.sectionId as string, p.to])
  );
  const markers = SECTION_MARKERS.map((m) => ({
    ...m,
    // After a successful patch the baseline anchor is gone — find the section
    // by the replacement text instead.
    alt: patchesBySection.get(m.id) ?? "",
  }));

  const script = `
<script id="landing-lab-guard">
(function () {
  var MARKERS = ${JSON.stringify(markers)};
  var PATCHES = ${JSON.stringify(patches)};

  function needle(s) {
    return s ? s.slice(0, Math.min(s.length, 28)) : "";
  }

  function findTextNode(root, text) {
    if (!text) return null;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.data && node.data.indexOf(text) >= 0) return node;
    }
    return null;
  }

  function containerFor(textNode) {
    // Climb from the text node to a block-ish ancestor that visually contains
    // the section headline (Framer wraps text in several nested divs).
    var el = textNode.parentElement;
    var best = el;
    var hops = 0;
    while (el && el !== document.body && hops < 6) {
      var tag = el.tagName;
      if (tag === "SECTION" || tag === "HEADER" || tag === "FOOTER") return el;
      if (el.getAttribute && el.getAttribute("data-framer-name")) best = el;
      el = el.parentElement;
      hops++;
    }
    return best;
  }

  function markSections() {
    for (var i = 0; i < MARKERS.length; i++) {
      var m = MARKERS[i];
      if (document.querySelector('[data-section-id="' + m.id + '"]')) continue;
      var tn = findTextNode(document.body, needle(m.anchor)) ||
               findTextNode(document.body, needle(m.alt));
      if (!tn) continue;
      var el = containerFor(tn);
      if (el) {
        el.setAttribute("data-section-id", m.id);
        el.id = "section-" + m.id;
      }
    }
  }

  function patchScope(p) {
    return document.querySelector('[data-section-id="' + p.sectionId + '"]') || document.body;
  }

  function targetPresent(p) {
    if (!p.to) return true;
    var text = patchScope(p).textContent || "";
    if (text.indexOf(p.to) >= 0) return true;
    var hint = p.to.slice(0, Math.min(p.to.length, 48));
    return hint.length >= 12 && text.indexOf(hint) >= 0;
  }

  function anchorStillPresent(p) {
    if (!p.anchor) return false;
    return (patchScope(p).textContent || "").indexOf(p.anchor) >= 0;
  }

  function applyPatch(p) {
    if (targetPresent(p) && !anchorStillPresent(p)) return true;

    var scope = document.querySelector('[data-section-id="' + p.sectionId + '"]');
    if (!scope) return false;
    var tn =
      (p.anchor ? findTextNode(scope, p.anchor) : null) ||
      findTextNode(scope, needle(p.anchor));
    if (!tn) return false;

    if (p.anchor && tn.data.indexOf(p.anchor) >= 0) {
      tn.data = tn.data.replace(p.anchor, p.to);
    } else if (p.to && tn.data.indexOf(p.to) >= 0) {
      return true;
    } else if (needle(p.anchor) && tn.data.indexOf(needle(p.anchor)) >= 0) {
      tn.data = tn.data.replace(needle(p.anchor), p.to);
    } else {
      tn.data = p.to;
    }
    return true;
  }

  function run() {
    markSections();
    for (var i = 0; i < PATCHES.length; i++) applyPatch(PATCHES[i]);
  }

  function needsWork() {
    if (!document.body) return false;
    for (var i = 0; i < PATCHES.length; i++) {
      if (anchorStillPresent(PATCHES[i]) && !targetPresent(PATCHES[i])) return true;
    }
    for (var j = 0; j < MARKERS.length; j++) {
      if (!document.querySelector('[data-section-id="' + MARKERS[j].id + '"]')) return true;
    }
    return false;
  }

  function safeRun() {
    try { run(); } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeRun);
  } else {
    safeRun();
  }

  // Framer hydrates asynchronously; sweep aggressively for the first seconds.
  [50, 150, 300, 600, 1000, 1500, 2500, 4000, 6000, 9000].forEach(function (ms) {
    setTimeout(safeRun, ms);
  });

  // Then keep watching: any mutation that restores baseline copy gets repatched.
  var debounce;
  var observer = new MutationObserver(function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      if (!needsWork()) {
        observer.disconnect();
        return;
      }
      safeRun();
    }, 40);
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
})();
</script>`;

  return html.includes("</body>")
    ? html.replace("</body>", `${script}\n</body>`)
    : html + script;
}

/** @deprecated kept for compatibility; use injectLabGuard */
export const injectVariantGuard = injectLabGuard;
