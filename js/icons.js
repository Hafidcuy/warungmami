/**
 * Warung Mami — sistem ikon SVG lokal (tanpa CDN, tanpa emoji).
 * Pakai:
 *   - atribut  <i data-ico="cart"></i>  (diisi otomatis, termasuk elemen baru via MutationObserver)
 *   - template ico("truck", 18)  atau  ico("check", 16, "cls-tambahan")
 * Semua ikon: viewBox 0 0 24 24, stroke currentColor, fill none, tebal 2.
 */
(function (global) {
  "use strict";

  var ICO = {
    /* --- navigasi & umum --- */
    home:
      '<path d="M3 10.6 12 3.2l9 7.4"/><path d="M5.4 9.4V20.8h13.2V9.4"/><path d="M9.6 20.8v-6.2h4.8v6.2"/>',
    user:
      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7.5" r="3.8"/>',
    "user-plus":
      '<path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7.5" r="3.8"/><path d="M19 8.5v5"/><path d="M16.5 11h5"/>',
    logout:
      '<path d="M9.5 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/><path d="m14.8 8.5 3.7 3.5-3.7 3.5"/><path d="M18.5 12H9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/>',
    dots:
      '<circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.8" fill="currentColor" stroke="none"/>',
    "chevron-right": '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    "arrow-left": '<path d="M19.5 12H5"/><path d="m11 18.5-6.5-6.5L11 5.5"/>',
    "arrow-right": '<path d="M4.5 12H19"/><path d="m13 5.5 6.5 6.5L13 18.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M20 6.5 9.2 17.5 4 12.3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    list:
      '<path d="M8.5 6.5H21"/><path d="M8.5 12H21"/><path d="M8.5 17.5H21"/><path d="M3.4 6.5h.01"/><path d="M3.4 12h.01"/><path d="M3.4 17.5h.01"/>',
    dot: '<circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="9.4"/><path d="M12 16.6v-5.2"/><path d="M12 7.9h.01"/>',
    clock: '<circle cx="12" cy="12" r="9.4"/><path d="M12 6.6V12l3.6 2.1"/>',
    calendar:
      '<rect x="3.2" y="5" width="17.6" height="16" rx="2.2"/><path d="M8 3.2v3.6"/><path d="M16 3.2v3.6"/><path d="M3.2 10h17.6"/>',
    "triangle-alert":
      '<path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.4v4.2"/><path d="M12 17.2h.01"/>',

    /* --- belanja & pesanan --- */
    cart:
      '<circle cx="9.3" cy="20" r="1.6"/><circle cx="17.8" cy="20" r="1.6"/><path d="M2.4 4h2.9l2.5 10.9a1.9 1.9 0 0 0 1.9 1.5h8.1a1.9 1.9 0 0 0 1.9-1.5L21.4 7.6H6"/>',
    basket:
      '<path d="M4.2 10h15.6l-1.5 8.6a2 2 0 0 1-2 1.7H7.7a2 2 0 0 1-2-1.7z"/><path d="m8.4 10 3.1-6.4"/><path d="m15.6 10-3.1-6.4"/><path d="M9.6 13.4v3.2"/><path d="M14.4 13.4v3.2"/>',
    box:
      '<path d="M3.4 7.2 12 3l8.6 4.2v9.6L12 21l-8.6-4.2z"/><path d="m3.4 7.2 8.6 4.3 8.6-4.3"/><path d="M12 11.5V21"/>',
    truck:
      '<rect x="2.4" y="5.6" width="10" height="10" rx="1.4"/><path d="M12.4 9h3.8l3.4 3.6v3H12.4z"/><circle cx="7" cy="18.4" r="2.2"/><circle cx="16.8" cy="18.4" r="2.2"/>',
    cup:
      '<rect x="5.4" y="5.2" width="13.2" height="2.8" rx="1.2"/><path d="M6.6 8h10.8l-1.1 11.5a2 2 0 0 1-2 1.8H9.7a2 2 0 0 1-2-1.8z"/><path d="m13.9 5.2 1.7-3.1"/><circle cx="10" cy="16.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="13.6" cy="18" r="1.15" fill="currentColor" stroke="none"/>',
    inbox:
      '<path d="M22 12.5h-5.6l-1.7 2.8H9.3l-1.7-2.8H2"/><path d="M5.6 5.2 2.2 12.3v5.4A2 2 0 0 0 4.2 19.7h15.6a2 2 0 0 0 2-2v-5.4l-3.4-7.1a2 2 0 0 0-1.8-1.2H7.4a2 2 0 0 0-1.8 1.2z"/>',
    money:
      '<rect x="2.4" y="6.2" width="19.2" height="11.6" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
    bank:
      '<path d="m3 9.6 9-6 9 6"/><path d="M5.2 10.2v8.6"/><path d="M9.7 10.2v8.6"/><path d="M14.3 10.2v8.6"/><path d="M18.8 10.2v8.6"/><path d="M3 21.4h18"/>',

    /* --- status & aksi --- */
    "check-circle":
      '<path d="M21.8 11.1V12a9.8 9.8 0 1 1-5.8-8.9"/><path d="m8.8 11.6 3.1 3.1 9.4-9.4"/>',
    refresh:
      '<path d="M20.9 9.5a9 9 0 0 0-15.4-3.4L2.4 9.5"/><path d="M2.6 14.5a9 9 0 0 0 15.4 3.4l3.1-3.4"/><path d="M2.4 4.6v4.9h4.9"/><path d="M21.6 19.4v-4.9h-4.9"/>',
    undo:
      '<path d="M4 9.4h9.6a5.6 5.6 0 0 1 0 11.2H9.2"/><path d="m8.2 5-4 4.4 4 4.4"/>',
    pencil:
      '<path d="M16.8 3.6a2.1 2.1 0 0 1 3 3L8.4 18l-4.2 1.2L5.4 15z"/><path d="m14.8 5.6 3 3"/>',
    trash:
      '<path d="M3.5 6h17"/><path d="M18.6 6v13.2a1.8 1.8 0 0 1-1.8 1.8H7.2a1.8 1.8 0 0 1-1.8-1.8V6"/><path d="M8.6 6V4.6a1.6 1.6 0 0 1 1.6-1.6h3.6a1.6 1.6 0 0 1 1.6 1.6V6"/><path d="M10 10.6v6"/><path d="M14 10.6v6"/>',
    lock:
      '<rect x="4.2" y="10.4" width="15.6" height="10.4" rx="2"/><path d="M8 10.4V7.2a4 4 0 0 1 8 0v3.2"/>',
    eye: '<path d="M1.6 12S5.6 4.8 12 4.8 22.4 12 22.4 12 18.4 19.2 12 19.2 1.6 12 1.6 12z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off":
      '<path d="M17.9 17.9A10 10 0 0 1 12 20c-6.4 0-10.4-7.2-10.4-7.2a18.5 18.5 0 0 1 5-6"/><path d="M9.9 4.3A9.1 9.1 0 0 1 12 4.8c6.4 0 10.4 7.2 10.4 7.2a18.5 18.5 0 0 1-2.2 3.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2.5 2.5 19 19"/>',

    /* --- panel & data --- */
    gauge:
      '<path d="M3.4 17.4a9.6 9.6 0 1 1 17.2 0"/><path d="m12.4 16.4 4.4-6.4"/><circle cx="12" cy="17.4" r="1.5"/>',
    clipboard:
      '<path d="M9.2 4.6H7.2a2 2 0 0 0-2 2v12.2a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V6.6a2 2 0 0 0-2-2h-2"/><rect x="9.2" y="2.6" width="5.6" height="4.2" rx="1.6"/>',
    settings:
      '<path d="M3.6 7.4h9.6"/><path d="M17.6 7.4h2.8"/><path d="M3.6 16.6h3.4"/><path d="M11.6 16.6h8.8"/><circle cx="15.2" cy="7.4" r="2.4"/><circle cx="9.2" cy="16.6" r="2.4"/>',
    phone:
      '<path d="M21.8 16.9v2.9a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h2.9a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    pin:
      '<path d="M20 10.4c0 5.6-8 11.6-8 11.6s-8-6-8-11.6a8 8 0 0 1 16 0z"/><circle cx="12" cy="10.4" r="3"/>',
    note:
      '<path d="M14 3.2H7.2a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V8.2z"/><path d="M14 3.2v5h4.8"/><path d="M9 13.4h6"/><path d="M9 17h4"/>',
    hand:
      '<path d="M11 11V4.6a1.6 1.6 0 0 1 3.2 0V11"/><path d="M14.2 10.6V6.4a1.6 1.6 0 0 1 3.2 0V13"/><path d="M17.4 12.6a1.6 1.6 0 0 1 3.2 0V15a6 6 0 0 1-6 6h-1.6a6 6 0 0 1-4.6-2.2L5 15.4a1.7 1.7 0 0 1 2.5-2.2L9 14.7V5.4a1.6 1.6 0 0 1 3.2 0"/>',
    "message-circle":
      '<path d="M20.4 11.6a8 8 0 0 1-8.6 7.9 8.6 8.6 0 0 1-3.6-.8L3.4 20.2l1.5-4.6a8 8 0 0 1-.8-3.6 8 8 0 0 1 7.9-8.6 8 8 0 0 1 8.4 8z"/>',
    pause:
      '<rect x="6.4" y="4.6" width="3.8" height="14.8" rx="1.4"/><rect x="13.8" y="4.6" width="3.8" height="14.8" rx="1.4"/>',
    package:
      '<path d="m20.4 7.6-8-4.4a1.7 1.7 0 0 0-1.7 0l-8 4.4A1.7 1.7 0 0 0 2.2 9v6a1.7 1.7 0 0 0 .9 1.5l8 4.4a1.7 1.7 0 0 0 1.7 0l8-4.4a1.7 1.7 0 0 0 .9-1.5V9a1.7 1.7 0 0 0-.9-1.4z"/><path d="m2.6 7.4 8.7 4.8a1.7 1.7 0 0 0 1.5 0l8.6-4.8"/><path d="M11.4 12.4v6.6"/>'
  };

  function ico(name, size, cls) {
    var body = ICO[name];
    if (!body) return "";
    var s = size == null ? "1em" : size;
    var c = cls ? " " + cls : "";
    return (
      '<svg class="ico' + c + '" width="' + s + '" height="' + s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body + "</svg>"
    );
  }

  function renderIcons(root) {
    var nodes = (root || document).querySelectorAll("[data-ico]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute("data-ico-done") === "1") continue;
      var html = ico(el.getAttribute("data-ico"), el.getAttribute("data-size") || "1em");
      if (!html) continue;
      el.innerHTML = html;
      el.setAttribute("data-ico-done", "1");
    }
  }

  var CSS =
    ".ico{display:inline-block;vertical-align:-0.14em;flex:none;" +
    "fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    "[data-ico]{display:inline-flex;align-items:center;justify-content:center;line-height:1}";

  function injectCSS() {
    if (document.getElementById("wm-icons-style")) return;
    var st = document.createElement("style");
    st.id = "wm-icons-style";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function boot() {
    injectCSS();
    renderIcons();
    if (typeof MutationObserver !== "undefined" && document.body) {
      new MutationObserver(function () { renderIcons(); }).observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.ICO = ICO;
  global.ico = ico;
  global.renderIcons = renderIcons;
})(window);
