(function () {
  const POSITION_LABELS = [
    [1, "⇖"], [2, "⇑"], [3, "⇗"],
    [4, "↖"], [5, "↑"], [6, "↗"],
    [7, "←"], [8, "●"], [9, "→"],
    [10, "↙"], [11, "↓"], [12, "↘"],
    [13, "⇙"], [14, "⇓"], [15, "⇘"],
  ];
  const SIZE_LABELS = [[1, "■"], [2, "▣"]];
  // Categories are derived from this cabinet's own trbitem-info.xml "kind" field (see
  // PLAYERBOARD_DEV_NOTES.md §8) — "Sheet" is background-only (handled separately below),
  // the other three are all valid in every sticker slot. There is no "Sheet"/first-slot-only
  // restriction confirmed for this catalog, unlike the (wrong) community catalog we started with.
  const STICKER_CATEGORIES = ["Sticker", "Seasonal", "Special"];

  // Mirrors the forward conversion in models/playerboard.ts — used here only to display
  // existing stored data (id/position:[x,y]/scale:[x,y]/rotation) back as picker presets.
  // Whole grid confirmed on a real cabinet: center [160,235], uniform 96px step per grid cell.
  const CENTER_X = 160;
  const CENTER_Y = 235;
  const GRID_STEP = 96;
  const COLUMN_OFFSETS = [CENTER_X - GRID_STEP, CENTER_X, CENTER_X + GRID_STEP];
  const ROW_OFFSETS = [CENTER_Y - 2 * GRID_STEP, CENTER_Y - GRID_STEP, CENTER_Y, CENTER_Y + GRID_STEP, CENTER_Y + 2 * GRID_STEP];

  function closestIndex(value, options) {
    return options.reduce((best, option, idx) =>
      Math.abs(option - value) < Math.abs(options[best] - value) ? idx : best, 0);
  }

  function offsetToPosition(x, y) {
    const col = closestIndex(x, COLUMN_OFFSETS);
    const row = closestIndex(y, ROW_OFFSETS);
    return row * 3 + col + 1;
  }

  // size 1 (■) = 1.0x, size 2 (▣) = 0.6x — see models/playerboard.ts for why ▣ is the
  // smaller option instead of the originally-guessed larger one. Midpoint of the two: 0.8.
  function scaleToSize(scale) {
    return scale < 0.8 ? 2 : 1;
  }

  // Places each stored sticker back into the UI slot it was saved from (item.slot), not just
  // sequentially by array position — otherwise leaving an earlier slot empty would make every
  // later slot's sticker shift forward one slot each time the board reloads. Falls back to
  // array position for older saved data that predates the "slot" field.
  function cardToPickerStickers(card) {
    if (!Array.isArray(card)) return [];
    const bySlot = [];
    card.forEach((item, index) => {
      const slot = typeof item.slot === "number" ? item.slot : index;
      bySlot[slot] = {
        id: item.id,
        position: offsetToPosition((item.position && item.position[0]) || 0, (item.position && item.position[1]) || 0),
        size: scaleToSize((item.scale && item.scale[0]) || 1),
      };
    });
    return bySlot;
  }

  // Catalog is loaded from static/js/stickers-data.js (a plain script setting this global),
  // not fetched as JSON — only the webui/css and webui/js static routes are proven to work
  // for this plugin, so the catalog rides along on the already-verified "js" route.
  let catalogPromise = null;
  function loadCatalog() {
    if (!catalogPromise) {
      const catalog = window.GITADORA_STICKER_CATALOG || [];
      const byCategory = new Map();
      const byId = new Map();
      for (const entry of catalog) {
        const [id, , group] = entry;
        if (!byCategory.has(group)) byCategory.set(group, []);
        byCategory.get(group).push(entry);
        byId.set(id, entry);
      }
      catalogPromise = Promise.resolve({ byCategory, byId });
    }
    return catalogPromise;
  }

  function clearOptions(select) {
    select.innerHTML = "";
  }

  function addOption(select, value, label) {
    const opt = document.createElement("option");
    opt.value = String(value);
    opt.textContent = label;
    select.appendChild(opt);
  }

  function buildCategorySelect(select, categories, currentValue) {
    clearOptions(select);
    addOption(select, "-1", "---");
    for (const category of categories) {
      addOption(select, category, category);
    }
    select.value = currentValue != null ? currentValue : "-1";
  }

  // Only builds options for a single category at a time — building all ~12000 catalog
  // entries into every slot up front is what made the page slow to load.
  function buildItemOptions(select, items, currentValue) {
    clearOptions(select);
    addOption(select, "-1", "---");
    for (const [id, name] of items || []) {
      addOption(select, id, name);
    }
    select.value = String(currentValue != null ? currentValue : -1);
  }

  function buildStaticOptions(select, labels, currentValue) {
    clearOptions(select);
    for (const [value, label] of labels) {
      addOption(select, value, label);
    }
    select.value = String(currentValue);
  }

  function getSlotState(slotEl) {
    const categorySelect = slotEl.querySelector('[data-role="category-select"]');
    const itemSelect = slotEl.querySelector('[data-role="item-select"]');
    const posSelect = slotEl.querySelector('[data-role="position-select"]');
    const sizeSelect = slotEl.querySelector('[data-role="size-select"]');
    return {
      category: categorySelect.value,
      itemId: parseInt(itemSelect.value, 10),
      position: parseInt(posSelect.value, 10),
      size: parseInt(sizeSelect.value, 10),
    };
  }

  function setSlotState(slotEl, state, byCategory) {
    const categorySelect = slotEl.querySelector('[data-role="category-select"]');
    const itemSelect = slotEl.querySelector('[data-role="item-select"]');
    const posSelect = slotEl.querySelector('[data-role="position-select"]');
    const sizeSelect = slotEl.querySelector('[data-role="size-select"]');

    categorySelect.value = state.category;
    buildItemOptions(itemSelect, byCategory.get(state.category), state.itemId);
    posSelect.value = String(state.position);
    sizeSelect.value = String(state.size);
  }

  function swapSlots(slotEls, i, j, byCategory) {
    if (j < 0 || j >= slotEls.length || i === j) return;
    const stateA = getSlotState(slotEls[i]);
    const stateB = getSlotState(slotEls[j]);
    setSlotState(slotEls[i], stateB, byCategory);
    setSlotState(slotEls[j], stateA, byCategory);
  }

  function initSlot(slotEl, allowedCategories, byId, byCategory, slotData) {
    const categorySelect = slotEl.querySelector('[data-role="category-select"]');
    const itemSelect = slotEl.querySelector('[data-role="item-select"]');
    const posSelect = slotEl.querySelector('[data-role="position-select"]');
    const sizeSelect = slotEl.querySelector('[data-role="size-select"]');

    // If this slot already has a saved item, look up which category it belongs to so the
    // category dropdown (and the item list under it) starts pre-selected correctly.
    const existingEntry = slotData.id != null ? byId.get(slotData.id) : null;
    const initialCategory = existingEntry ? existingEntry[2] : "-1";

    buildCategorySelect(categorySelect, allowedCategories, initialCategory);
    buildItemOptions(itemSelect, initialCategory !== "-1" ? byCategory.get(initialCategory) : null, slotData.id);
    buildStaticOptions(posSelect, POSITION_LABELS, slotData.position || 8);
    buildStaticOptions(sizeSelect, SIZE_LABELS, slotData.size || 1);

    categorySelect.addEventListener("change", () => {
      const category = categorySelect.value;
      buildItemOptions(itemSelect, category !== "-1" ? byCategory.get(category) : null, -1);
    });
  }

  function initEditor(container, catalog) {
    if (container.dataset.boardInitialized === "1") return;
    container.dataset.boardInitialized = "1";

    const { byCategory, byId } = catalog;

    let initial = { sheet: null, stickers: [] };
    try {
      const raw = JSON.parse(container.getAttribute("data-initial") || "{}");
      initial = { sheet: raw.sheet != null ? raw.sheet : null, stickers: cardToPickerStickers(raw.card) };
    } catch (e) { /* keep defaults */ }
    const initialStickers = initial.stickers;

    const sheetSelect = container.querySelector('[data-role="sheet-select"]');
    if (sheetSelect) {
      buildItemOptions(sheetSelect, byCategory.get("Sheet"), initial.sheet);
    }

    const slotEls = Array.from(container.querySelectorAll('[data-role="slot"]'));
    slotEls.forEach((slotEl, idx) => {
      const allowedCategories = STICKER_CATEGORIES;
      initSlot(slotEl, allowedCategories, byId, byCategory, initialStickers[idx] || {});
    });

    container.querySelectorAll('[data-role="move-up"]').forEach((btn, idx) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        swapSlots(slotEls, idx, idx - 1, byCategory);
      });
    });
    container.querySelectorAll('[data-role="move-down"]').forEach((btn, idx) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        swapSlots(slotEls, idx, idx + 1, byCategory);
      });
    });

    const form = container.closest("form");
    if (form) {
      const statusEl = form.querySelector('[data-role="board-status"]');
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const stickers = [];
        slotEls.forEach((slotEl, idx) => {
          const { itemId, position, size } = getSlotState(slotEl);
          if (isNaN(itemId) || itemId === -1) return;
          stickers.push({ id: itemId, position, size, slot: idx });
        });
        const sheetVal = sheetSelect ? parseInt(sheetSelect.value, 10) : NaN;
        const hiddenInput = form.querySelector('[data-role="board-json"]');
        if (hiddenInput) {
          hiddenInput.value = JSON.stringify({
            sheet: isNaN(sheetVal) || sheetVal === -1 ? null : sheetVal,
            stickers,
          });
        }

        // Submit in the background instead of letting the browser navigate — a normal full-page
        // form POST reloads the page, which resets which version tab was active back to the
        // first one (we have no way to make the resulting page remember it), making it look like
        // whatever you just saved (e.g. the background) vanished even though it saved correctly.
        if (statusEl) statusEl.textContent = "Saving…";
        const body = new URLSearchParams(new FormData(form));
        fetch(form.action, { method: "POST", body })
          .then(res => {
            if (statusEl) statusEl.textContent = res.ok ? "Saved." : `Save failed (HTTP ${res.status}).`;
          })
          .catch(err => {
            if (statusEl) statusEl.textContent = "Save failed: " + err;
          });
      });
    }
  }

  function initVisibleEditors() {
    const containers = document.querySelectorAll(".playerboard-editor");
    if (containers.length === 0) return;
    loadCatalog().then(catalog => {
      containers.forEach(container => {
        if (container.offsetParent !== null) {
          initEditor(container, catalog);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initVisibleEditors();
    // Board editors inside inactive version tabs are hidden (display:none) on load, so their
    // option lists are only built lazily once that tab is actually clicked open.
    document.querySelectorAll('li[tab-group="profile-version"]').forEach(li => {
      li.addEventListener("click", () => setTimeout(initVisibleEditors, 0));
    });
  });
})();
