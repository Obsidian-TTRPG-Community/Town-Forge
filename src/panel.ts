import { ItemView, MarkdownView, Notice, TFile, normalizePath } from "obsidian";
import { buildMarkersFile, builtinName, collectSlots } from "./markers";
import { MAP_SIZE_BY_SIZE } from "./buildings";
import { generateFull } from "./generate";
import { LANDSCAPE_BASE_DISTANCE, SIZE_BASE_DISTANCE } from "./main";
import { renderFull, renderScene } from "./render";
import { generateLandscape } from "./landscape";

export var TOWN_FORGE_VIEW = "town-forge-preview";
export var TERRAINS = ["inland", "coastal", "river", "lake", "mountain"];
export var SETTLEMENTS = [
  "hamlet",
  "village",
  "small_town",
  "town",
  "large_town",
  "small_city",
  "city",
  "large_city",
  "metropolis"
];
export var DIRECTIONS = ["random", "N", "E", "S", "W"];
export var TRI_NEXT = { auto: "on", on: "off", off: "auto" };
export var TRI_LABEL = { auto: "Auto", on: "On", off: "Off" };
export var SYLL = ["thar", "mor", "wen", "dol", "fen", "rik", "vol", "sea", "gan", "lyth", "bram", "cor", "ash", "el", "grim", "haven", "ford", "wick", "stead", "mere"];
export function randomSeed() {
  const n = 2 + Math.floor(Math.random() * 2);
  let s = "";
  for (let i = 0; i < n; i++)
    s += SYLL[Math.floor(Math.random() * SYLL.length)];
  return s;
}
export function titleCase(s) {
  return s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}
export function randomName() {
  const a = SYLL[Math.floor(Math.random() * SYLL.length)];
  const b = SYLL[Math.floor(Math.random() * SYLL.length)];
  return titleCase(a + b);
}
export var TownForgePreviewView = class extends ItemView {
  constructor(leaf, getExportFolder, getTemplateFolder, getPinTypes, getOpenAfterExport, getGroupNotesByType, getEnableZoomMapExport, getShowTroubleshoot, getScaleMultiplier, getDistanceUnit) {
    super(leaf);
    this.state = {
      terrain: "river",
      seed: "frostkey",
      name: "Frostkey",
      mode: "full",
      settlement: "city",
      roughness: 0.6,
      octaves: 5,
      direction: "random",
      mountainEdges: { N: false, E: false, S: false, W: false },
      edges: { N: true, E: true, S: true, W: true },
      edgesAuto: true,
      farm: 1,
      forest: 1,
      mountain: 6,
      walls: "auto",
      castle: "auto",
      temple: "auto",
      market: "auto",
      barracks: "auto",
      tower: "auto"
    };
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.lastGenMs = 0;
    this.stale = false;
    // The most recent full-mode scene + its pixel size, captured at render time so
    // Export can place markers without re-generating.  Null in landscape mode.
    this.lastFullScene = null;
    this.lastMapSize = 1e3;
    this.getExportFolder = getExportFolder ?? (() => "Maps");
    this.getTemplateFolder = getTemplateFolder ?? (() => "Templates/TownForge");
    this.getPinTypes = getPinTypes ?? (() => []);
    this.getOpenAfterExport = getOpenAfterExport ?? (() => true);
    this.getGroupNotesByType = getGroupNotesByType ?? (() => true);
    this.getEnableZoomMapExport = getEnableZoomMapExport ?? (() => false);
    this.getShowTroubleshoot = getShowTroubleshoot ?? (() => false);
    this.getScaleMultiplier = getScaleMultiplier ?? (() => 1);
    this.getDistanceUnit = getDistanceUnit ?? (() => "miles");
  }
  getViewType() {
    return TOWN_FORGE_VIEW;
  }
  getDisplayText() {
    return "Town Forge";
  }
  getIcon() {
    return "map";
  }
  // Rebuild the panel UI from current state + settings (e.g. after a settings
  // toggle changes which buttons show).  onOpen reads the persisted this.state,
  // so the in-progress map/values are preserved and re-rendered.
  async rebuild() {
    await this.onOpen();
  }
  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("town-forge-panel");
    root.style.padding = "10px";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "8px";
    root.style.overflowY = "auto";
    const title = root.createEl("h4", { text: "Town Forge" });
    title.style.margin = "0 0 2px 0";
    const controls = root.createDiv();
    controls.style.display = "flex";
    controls.style.flexDirection = "column";
    controls.style.gap = "5px";
    const row = (labelText) => {
      const r = controls.createDiv();
      r.style.display = "flex";
      r.style.alignItems = "center";
      r.style.justifyContent = "space-between";
      r.style.gap = "8px";
      const lab = r.createEl("label", { text: labelText });
      lab.style.fontSize = "0.78em";
      lab.style.opacity = "0.85";
      lab.style.minWidth = "82px";
      return r;
    };
    const sectionLabel = (t) => {
      const s = controls.createEl("div", { text: t });
      s.style.fontSize = "0.68em";
      s.style.textTransform = "uppercase";
      s.style.letterSpacing = "0.06em";
      s.style.opacity = "0.5";
      s.style.marginTop = "2px";
      return s;
    };
    const dropdown = (parent, opts, cur, onChange) => {
      const sel = parent.createEl("select");
      sel.style.flex = "1";
      for (const o of opts) {
        const opt = sel.createEl("option", { text: o, value: o });
        if (o === cur)
          opt.selected = true;
      }
      sel.onchange = () => onChange(sel.value);
      return sel;
    };
    sectionLabel("Identity");
    const nameRow = row("Name");
    const nameInput = nameRow.createEl("input", { type: "text", value: this.state.name, placeholder: "(random)" });
    this.nameInputEl = nameInput;
    nameInput.style.flex = "1";
    nameInput.style.minWidth = "0";
    nameInput.onchange = () => {
      this.state.name = nameInput.value;
      this.markStaleOrRefresh(false);
    };
    const nameRoll = nameRow.createEl("button", { text: "\u{1F3B2}" });
    nameRoll.onclick = () => {
      this.state.name = randomName();
      nameInput.value = this.state.name;
      this.markStaleOrRefresh(false);
    };
    const seedRow = row("Seed");
    const seedInput = seedRow.createEl("input", { type: "text", value: this.state.seed });
    this.seedInputEl = seedInput;
    seedInput.style.flex = "1";
    seedInput.style.minWidth = "0";
    seedInput.onchange = () => {
      this.state.seed = seedInput.value || "townforge";
      this.markStaleOrRefresh(true);
    };
    const seedRoll = seedRow.createEl("button", { text: "\u{1F3B2}" });
    seedRoll.onclick = () => {
      this.state.seed = randomSeed();
      seedInput.value = this.state.seed;
      this.markStaleOrRefresh(true);
    };
    sectionLabel("Place");
    dropdown(row("Terrain"), TERRAINS, this.state.terrain, (v) => {
      this.state.terrain = v;
      this.markStaleOrRefresh(true);
    });
    const dirRow = row("Sea side");
    this.dirRowEl = dirRow;
    dropdown(dirRow, DIRECTIONS, this.state.direction, (v) => {
      this.state.direction = v;
      this.markStaleOrRefresh(true);
    });
    dropdown(row("Mode"), ["full", "landscape"], this.state.mode, (v) => {
      this.state.mode = v;
      this.updateVisibility();
      this.markStaleOrRefresh(true);
    });
    const settlementRow = row("Settlement");
    this.settlementRowEl = settlementRow;
    dropdown(settlementRow, SETTLEMENTS, this.state.settlement, (v) => {
      this.state.settlement = v;
      this.markStaleOrRefresh(true);
    });
    sectionLabel("Approach roads");
    const roadsRow = row("Edges");
    const autoLab = roadsRow.createEl("label");
    autoLab.style.display = "flex";
    autoLab.style.alignItems = "center";
    autoLab.style.gap = "3px";
    autoLab.style.fontSize = "0.75em";
    const autoCb = autoLab.createEl("input", { type: "checkbox" });
    autoCb.checked = this.state.edgesAuto;
    autoLab.createSpan({ text: "auto" });
    const edgeBoxes = {};
    for (const e of ["N", "E", "S", "W"]) {
      const l = roadsRow.createEl("label");
      l.style.display = "flex";
      l.style.alignItems = "center";
      l.style.gap = "2px";
      l.style.fontSize = "0.75em";
      const cb = l.createEl("input", { type: "checkbox" });
      cb.checked = this.state.edges[e];
      cb.disabled = this.state.edgesAuto;
      cb.onchange = () => {
        this.state.edges[e] = cb.checked;
        this.markStaleOrRefresh(true);
      };
      l.createSpan({ text: e });
      edgeBoxes[e] = cb;
    }
    autoCb.onchange = () => {
      this.state.edgesAuto = autoCb.checked;
      for (const e of ["N", "E", "S", "W"])
        edgeBoxes[e].disabled = autoCb.checked;
      this.markStaleOrRefresh(true);
    };
    sectionLabel("Density");
    const slider = (labelText, min, max, step, val, fmt, onChange) => {
      const r = row(labelText);
      const s = r.createEl("input", { type: "range" });
      s.min = String(min);
      s.max = String(max);
      s.step = String(step);
      s.value = String(val);
      s.style.flex = "1";
      const out = r.createEl("span", { text: fmt(val) });
      out.style.fontSize = "0.72em";
      out.style.minWidth = "30px";
      out.style.textAlign = "right";
      out.style.opacity = "0.7";
      s.oninput = () => {
        out.setText(fmt(parseFloat(s.value)));
      };
      s.onchange = () => onChange(parseFloat(s.value));
      return s;
    };
    slider("Farms", 0, 2, 0.25, this.state.farm, (v) => `${v.toFixed(2)}\xD7`, (v) => {
      this.state.farm = v;
      this.markStaleOrRefresh(true);
    });
    slider("Forest", 0, 2, 0.25, this.state.forest, (v) => `${v.toFixed(2)}\xD7`, (v) => {
      this.state.forest = v;
      this.markStaleOrRefresh(true);
    });
    this.mountainSlider = slider("Mtn size", 0, 12, 1, this.state.mountain, (v) => `${v}`, (v) => {
      this.state.mountain = v;
      this.markStaleOrRefresh(true);
    });
    const mtnRow = row("Mtn edges");
    this.mtnSideRowEl = mtnRow;
    const mtnEdgeBoxes = {};
    for (const e of ["N", "E", "S", "W"]) {
      const l = mtnRow.createEl("label");
      l.style.display = "flex";
      l.style.alignItems = "center";
      l.style.gap = "2px";
      l.style.fontSize = "0.75em";
      const cb = l.createEl("input", { type: "checkbox" });
      cb.checked = this.state.mountainEdges[e];
      cb.onchange = () => {
        this.state.mountainEdges[e] = cb.checked;
        this.markStaleOrRefresh(true);
      };
      l.createSpan({ text: e });
      mtnEdgeBoxes[e] = cb;
    }
    const mtnNote = mtnRow.createEl("span", { text: "overlay" });
    mtnNote.style.fontSize = "0.6em";
    mtnNote.style.opacity = "0.4";
    this.landmarksSection = sectionLabel("Landmarks");
    const triRow = controls.createDiv();
    this.landmarksRowEl = triRow;
    triRow.style.display = "flex";
    triRow.style.flexWrap = "wrap";
    triRow.style.gap = "5px";
    const triBtn = (labelText, key) => {
      const b = triRow.createEl("button");
      const paint = () => {
        const st = this.state[key];
        b.setText(`${labelText}: ${TRI_LABEL[st]}`);
        b.style.opacity = st === "auto" ? "0.6" : "1";
        b.style.fontWeight = st === "on" ? "600" : "400";
        b.style.textDecoration = st === "off" ? "line-through" : "none";
      };
      b.style.fontSize = "0.72em";
      b.style.flex = "1";
      b.style.minWidth = "70px";
      b.onclick = () => {
        this.state[key] = TRI_NEXT[this.state[key]];
        paint();
        this.markStaleOrRefresh(true);
      };
      paint();
    };
    triBtn("Walls", "walls");
    triBtn("Castle", "castle");
    triBtn("Temple", "temple");
    triBtn("Market", "market");
    triBtn("Barracks", "barracks");
    triBtn("Tower", "tower");
    const canvasWrap = root.createDiv();
    canvasWrap.style.marginTop = "4px";
    const viewport = canvasWrap.createDiv();
    this.viewport = viewport;
    viewport.style.position = "relative";
    viewport.style.width = "100%";
    viewport.style.overflow = "hidden";
    viewport.style.borderRadius = "6px";
    viewport.style.cursor = "grab";
    viewport.style.touchAction = "none";
    this.canvas = viewport.createEl("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "auto";
    this.canvas.style.display = "block";
    this.canvas.style.transformOrigin = "0 0";
    this.canvas.style.willChange = "transform";
    const zoomBar = viewport.createDiv();
    zoomBar.style.position = "absolute";
    zoomBar.style.top = "6px";
    zoomBar.style.right = "6px";
    zoomBar.style.display = "flex";
    zoomBar.style.flexDirection = "column";
    zoomBar.style.gap = "3px";
    zoomBar.style.zIndex = "2";
    zoomBar.addEventListener("pointerdown", (e) => e.stopPropagation());
    const mkZoomBtn = (label, aria, fn) => {
      const b = zoomBar.createEl("button", { text: label });
      b.setAttr("aria-label", aria);
      b.style.width = "26px";
      b.style.height = "26px";
      b.style.padding = "0";
      b.style.fontSize = "15px";
      b.style.lineHeight = "1";
      b.style.fontWeight = "600";
      b.style.opacity = "0.85";
      b.style.cursor = "pointer";
      b.onclick = (e) => {
        e.preventDefault();
        fn();
      };
      return b;
    };
    mkZoomBtn("+", "Zoom in", () => this.zoomBy(1.3, null));
    mkZoomBtn("\u2212", "Zoom out", () => this.zoomBy(1 / 1.3, null));
    mkZoomBtn("\u2922", "Reset zoom", () => this.resetView());
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      this.zoomBy(factor, { x: cx, y: cy });
    }, { passive: false });
    let dragging = false;
    let lastX = 0, lastY = 0;
    viewport.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      viewport.style.cursor = "grabbing";
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!dragging)
        return;
      this.panX += e.clientX - lastX;
      this.panY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.clampPan();
      this.applyView();
    });
    const endDrag = (e) => {
      if (!dragging)
        return;
      dragging = false;
      viewport.style.cursor = "grab";
      try {
        viewport.releasePointerCapture(e.pointerId);
      } catch {
      }
    };
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.resetView();
    });
    const footer = root.createDiv();
    footer.style.position = "sticky";
    footer.style.bottom = "0";
    footer.style.marginTop = "auto";
    footer.style.display = "flex";
    footer.style.flexDirection = "column";
    footer.style.gap = "6px";
    footer.style.paddingTop = "6px";
    footer.style.background = "var(--background-secondary)";
    footer.style.borderTop = "1px solid var(--background-modifier-border)";
    footer.style.zIndex = "3";
    this.status = footer.createDiv();
    this.status.style.fontSize = "0.72em";
    this.status.style.opacity = "0.6";
    const genRow = footer.createDiv();
    genRow.style.display = "flex";
    genRow.style.flexWrap = "wrap";
    genRow.style.gap = "6px";
    this.generateBtn = genRow.createEl("button", { text: "Generate" });
    this.generateBtn.style.flex = "2 1 120px";
    this.generateBtn.style.fontWeight = "600";
    this.generateBtn.style.padding = "8px";
    this.generateBtn.onclick = () => {
      this.state.seed = randomSeed();
      this.seedInputEl.value = this.state.seed;
      this.state.name = randomName();
      if (this.nameInputEl)
        this.nameInputEl.value = this.state.name;
      this.stale = false;
      this.refresh();
    };
    const regenBtn = genRow.createEl("button", { text: "\u21BB Same seed" });
    regenBtn.setAttr("aria-label", "Regenerate with the same seed");
    regenBtn.style.flex = "1 1 100px";
    regenBtn.onclick = () => {
      this.stale = false;
      this.refresh();
    };
    const actions = footer.createDiv();
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "6px";
    const copyBtn = actions.createEl("button", { text: "Copy code" });
    copyBtn.style.flex = "1 1 90px";
    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(this.codeBlock());
      new Notice("Town Forge: code block copied");
    };
    const insertBtn = actions.createEl("button", { text: "Insert" });
    insertBtn.style.flex = "1 1 90px";
    insertBtn.onclick = () => this.insertIntoNote();
    const saveBtn = actions.createEl("button", { text: "Save PNG" });
    saveBtn.style.flex = "1 1 90px";
    saveBtn.onclick = () => this.saveToVault();
    if (this.getEnableZoomMapExport()) {
      const exportBtn = actions.createEl("button", { text: "Export to TTRPG Tools: Maps" });
      exportBtn.style.flex = "1 1 100%";
      exportBtn.style.whiteSpace = "nowrap";
      exportBtn.setAttr("aria-label", "Create a folder + PNG + note with a zoommap block in the configured export folder");
      exportBtn.onclick = async () => {
        const _label = exportBtn.textContent;
        exportBtn.disabled = true;
        exportBtn.setAttr("aria-busy", "true");
        exportBtn.textContent = "\u23F3 Exporting\u2026";
        const _busy = new Notice("Town Forge: exporting to TTRPG Tools - Maps\u2026 this can take a few seconds.", 0);
        try {
          await this.exportToZoomMap();
        } finally {
          _busy.hide();
          exportBtn.disabled = false;
          exportBtn.removeAttribute("aria-busy");
          exportBtn.textContent = _label;
        }
      };
    }
    if (this.getShowTroubleshoot()) {
      const troubleRow = footer.createDiv();
      troubleRow.style.display = "flex";
      troubleRow.style.marginTop = "2px";
      const troubleBtn = troubleRow.createEl("button", { text: "\u{1F41E} Copy config for support" });
      troubleBtn.setAttr("aria-label", "Copy the full settings used for this map, to report an issue");
      troubleBtn.style.flex = "1";
      troubleBtn.style.fontSize = "0.78em";
      troubleBtn.onclick = async () => {
        await navigator.clipboard.writeText(this.troubleshootConfig());
        new Notice("Town Forge: full config copied \u2014 paste it to report an issue");
      };
    }
    this.updateVisibility();
    this.refresh();
  }
  updateVisibility() {
    const full = this.state.mode === "full";
    this.settlementRowEl.style.display = full ? "flex" : "none";
    if (this.dirRowEl)
      this.dirRowEl.style.display = this.state.terrain === "coastal" ? "flex" : "none";
    if (this.mtnSideRowEl)
      this.mtnSideRowEl.style.display = this.state.terrain === "mountain" ? "none" : "flex";
    const isCity = ["small_city", "city", "large_city", "metropolis"].includes(this.state.settlement);
    const showLandmarks = full && isCity;
    if (this.landmarksSection)
      this.landmarksSection.style.display = showLandmarks ? "block" : "none";
    if (this.landmarksRowEl)
      this.landmarksRowEl.style.display = showLandmarks ? "flex" : "none";
  }
  // Mark the preview stale (waiting for Generate) for expensive maps; refresh
  // immediately for cheap ones.  "Cheap" = last generation was fast.
  markStaleOrRefresh(_bigChange) {
    this.updateVisibility();
    const expensive = this.lastGenMs > 150 || ["large_city", "metropolis"].includes(this.state.settlement);
    if (expensive) {
      this.stale = true;
      this.paintStale();
    } else {
      this.refresh();
    }
  }
  paintStale() {
    if (this.generateBtn) {
      this.generateBtn.setText("Generate \u25CF");
      this.generateBtn.style.opacity = "1";
    }
    this.status.setText("Settings changed \u2014 press Generate to update.");
  }
  overrides() {
    const s = this.state;
    const tri = (t) => t === "auto" ? void 0 : t === "on";
    return {
      walls: tri(s.walls),
      castle: tri(s.castle),
      cathedral: tri(s.temple),
      market: tri(s.market),
      barracks: tri(s.barracks),
      tower: tri(s.tower),
      farmDensity: s.farm,
      forestDensity: s.forest
    };
  }
  enabledEdges() {
    if (this.state.edgesAuto)
      return void 0;
    const e = this.state.edges;
    return { N: e.N, E: e.E, S: e.S, W: e.W };
  }
  // Concatenated edge string for the mountain overlay, e.g. "NSW" (or "" = none).
  mountainSideString() {
    const m = this.state.mountainEdges;
    return ["N", "E", "S", "W"].filter((e) => m[e]).join("");
  }
  troubleshootConfig() {
    const s = this.state;
    const edges = s.edgesAuto ? "auto" : ["N", "E", "S", "W"].filter((e) => s.edges[e]).join("") || "none";
    const lines = [
      "Town Forge \u2014 config for support (v1.0.3)",
      `terrain: ${s.terrain}`,
      `mode: ${s.mode}`,
      `settlement: ${s.settlement}`,
      `seed: ${s.seed}`,
      `name: ${s.name || "(none)"}`,
      `sea side: ${s.terrain === "coastal" ? s.direction : "n/a"}`,
      `mtn edges: ${s.terrain !== "mountain" ? this.mountainSideString() || "none" : "n/a"}`,
      `roads: ${edges}`,
      `farms: ${s.farm}\xD7 \xB7 forest: ${s.forest}\xD7 \xB7 mtn size: ${s.mountain}`,
      `landmarks: walls=${s.walls} castle=${s.castle} temple=${s.temple} market=${s.market} barracks=${s.barracks} tower=${s.tower}`,
      `last gen: ${this.lastGenMs.toFixed(0)}ms`
    ];
    return lines.join("\n");
  }
  codeBlock() {
    const s = this.state;
    const lines = [`terrain: ${s.terrain}`, `seed: ${s.seed}`, `mode: ${s.mode}`];
    if (s.name)
      lines.push(`name: ${s.name}`);
    if (s.mode === "full")
      lines.push(`settlement: ${s.settlement}`);
    if (!s.edgesAuto)
      lines.push(`edges: ${["N", "E", "S", "W"].filter((e) => s.edges[e]).join("") || "none"}`);
    if (s.farm !== 1)
      lines.push(`farms: ${s.farm}`);
    if (s.forest !== 1)
      lines.push(`forest: ${s.forest}`);
    if (s.terrain === "coastal" && s.direction !== "random")
      lines.push(`seaside: ${s.direction}`);
    const mtnEdges = this.mountainSideString();
    if (s.terrain !== "mountain" && mtnEdges)
      lines.push(`mtnedges: ${mtnEdges}`);
    const mountainsActive = s.terrain === "mountain" || s.terrain !== "mountain" && mtnEdges !== "";
    if (mountainsActive && s.mountain !== 6)
      lines.push(`mtnsize: ${s.mountain}`);
    for (const k of ["walls", "castle", "temple", "market", "barracks", "tower"]) {
      if (s[k] !== "auto")
        lines.push(`${k}: ${s[k]}`);
    }
    return "```town-forge\n" + lines.join("\n") + "\n```";
  }
  insertIntoNote() {
    let mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView) {
      const recent = this.app.workspace.getMostRecentLeaf();
      if (recent && recent.view instanceof MarkdownView)
        mdView = recent.view;
    }
    if (!mdView) {
      new Notice("Town Forge: open a note in the main editor first, then click Insert");
      return;
    }
    mdView.editor.replaceSelection(this.codeBlock() + "\n");
    new Notice("Town Forge: map inserted");
  }
  async saveToVault() {
    try {
      if (this.stale)
        this.refresh();
      const blob = await new Promise((res) => this.canvas.toBlob((b) => res(b), "image/png"));
      if (!blob) {
        new Notice("Town Forge: could not render PNG");
        return;
      }
      const buf = await blob.arrayBuffer();
      const base = this.sanitizeName(this.state.name || this.state.seed).replace(/\s+/g, "-").toLowerCase();
      const root = (this.getExportFolder() || "Maps").replace(/^\/+|\/+$/g, "");
      await this.ensureFolder(root);
      let path = (0, normalizePath)(`${root}/${base}-${this.state.terrain}.png`);
      let i = 1;
      while (this.app.vault.getAbstractFileByPath(path)) {
        path = (0, normalizePath)(`${root}/${base}-${this.state.terrain}-${i}.png`);
        i++;
      }
      await this.app.vault.createBinary(path, buf);
      new Notice(`Town Forge: saved ${path}`);
    } catch (e) {
      new Notice(`Town Forge: save failed \u2014 ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // Strip characters Obsidian/the filesystem disallow in a path segment, and
  // collapse whitespace so "Port Haven" stays readable as a folder/file name.
  sanitizeName(raw) {
    const cleaned = raw.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
    return cleaned || "Untitled Map";
  }
  // Ensure a vault folder (and its parents) exists; tolerate it already being
  // there.  Obsidian has no recursive mkdir, so build the path segment by
  // segment.
  async ensureFolder(folderPath) {
    const parts = folderPath.split("/").filter((p) => p.length);
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(cur)) {
        try {
          await this.app.vault.createFolder(cur);
        } catch (e) {
        }
      }
    }
  }
  // Export to the Zoom Map (TTRPG Tools: Maps) format: a folder named after the
  // map inside the configured export folder, containing the PNG and a note with
  // a `zoommap` code block pointing at it so the map renders interactively.
  async exportToZoomMap() {
    try {
      if (this.stale)
        this.refresh();
      const blob = await new Promise((res) => this.canvas.toBlob((b) => res(b), "image/png"));
      if (!blob) {
        new Notice("Town Forge: could not render PNG");
        return;
      }
      const buf = await blob.arrayBuffer();
      const mapName = this.sanitizeName(this.state.name || this.state.seed);
      const root = (this.getExportFolder() || "Maps").replace(/^\/+|\/+$/g, "");
      let folder = `${root}/${mapName}`;
      let suffixName = mapName;
      let i = 1;
      while (this.app.vault.getAbstractFileByPath(folder)) {
        suffixName = `${mapName} ${i}`;
        folder = `${root}/${suffixName}`;
        i++;
      }
      await this.ensureFolder(folder);
      const pngPath = `${folder}/${suffixName}.png`;
      const notePath = `${folder}/${suffixName}.md`;
      await this.app.vault.createBinary(pngPath, buf);
      let places = [];
      let noteStats = { fromTemplate: 0, fromDefault: 0 };
      if (this.lastFullScene) {
        const slots = collectSlots(
          this.lastFullScene,
          this.state.seed,
          this.getPinTypes(),
          this.lastMapSize
        );
        places = await this.resolveNames(slots, mapName);
        noteStats = await this.writePlaceNotes(places, folder, mapName, this.state.mode === "full" ? this.state.settlement : "");
        const markersFile = buildMarkersFile({ places, mapSize: this.lastMapSize, imagePath: pngPath });
        await this.app.vault.create(`${pngPath}.markers.json`, JSON.stringify(markersFile, null, 2));
      }
      const block = [
        "```zoommap",
        `image: ${pngPath}`,
        "height: 600px",
        "minZoom: 0.3",
        "maxZoom: 8",
        "```",
        ""
      ].join("\n");
      await this.app.vault.create(notePath, block);
      let msg = `Town Forge: exported to ${folder}`;
      if (places.length) {
        const bits = [`${places.length} pins`];
        if (noteStats.fromTemplate)
          bits.push(`${noteStats.fromTemplate} from template`);
        if (noteStats.fromDefault)
          bits.push(`${noteStats.fromDefault} default (no template found in "${this.getTemplateFolder() || "Templates/TownForge"}")`);
        msg += ` \xB7 ${bits.join(", ")}`;
      }
      new Notice(msg);
      if (this.getOpenAfterExport()) {
        try {
          const file = this.app.vault.getAbstractFileByPath(notePath);
          if (file instanceof TFile) {
            await this.app.workspace.getLeaf(false).openFile(file);
          }
        } catch {
        }
      }
    } catch (e) {
      new Notice(`Town Forge: export failed \u2014 ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // Candidate template filenames for a building type, most-specific first.
  // Tolerates case + singular/plural, e.g. shop -> Shop.md, shops.md, Shops.md.
  templateCandidates(buildingType) {
    const lower = buildingType.toLowerCase();
    const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
    const plural = lower.endsWith("s") ? lower : lower + "s";
    const capPlural = plural.charAt(0).toUpperCase() + plural.slice(1);
    return Array.from(/* @__PURE__ */ new Set([`${cap}.md`, `${lower}.md`, `${capPlural}.md`, `${plural}.md`]));
  }
  // Read a template's text for a building type, or null if none found.  Tries
  // exact path candidates first, then a case-insensitive scan of the template
  // folder so "shop.md" / "Shop.md" / "Shops.md" all resolve.
  async readTemplate(buildingType) {
    const tf = (this.getTemplateFolder() || "Templates/TownForge").replace(/^\/+|\/+$/g, "");
    const candidates = this.templateCandidates(buildingType);
    for (const fname of candidates) {
      const file = this.app.vault.getAbstractFileByPath(`${tf}/${fname}`);
      if (file && "extension" in file) {
        try {
          return await this.app.vault.read(file);
        } catch {
        }
      }
    }
    const wantBase = candidates.map((c) => c.toLowerCase());
    const tfLower = tf.toLowerCase();
    for (const f of this.app.vault.getMarkdownFiles()) {
      const parent = (f.parent?.path ?? "").toLowerCase();
      if (parent !== tfLower)
        continue;
      if (wantBase.includes(f.name.toLowerCase())) {
        try {
          return await this.app.vault.read(f);
        } catch {
        }
      }
    }
    return null;
  }
  // Ensure the note body has a `type:` frontmatter property set to the note
  // type.  If the body already opens with a YAML block, inject/replace `type:`
  // there; otherwise prepend a small frontmatter block.  `town`, `subtype`
  // (when present), and `size` (the settlement size, when present) are added
  // too so templates / Randomness rolls can read them.
  ensureTypeFrontmatter(body, type, town, subtype, size) {
    body = body.replace(/\r\n/g, "\n");
    const fmMatch = body.match(/^---\n([\s\S]*?)\n---\n?/);
    const yamlVal = (v) => /[:#\-?\[\]{},&*!|>'"%@`]/.test(v) ? JSON.stringify(v) : v;
    const hasSub = !!(subtype && subtype.trim());
    const hasSize = !!(size && size.trim());
    if (fmMatch) {
      let fm = fmMatch[1];
      if (/^type\s*:/m.test(fm))
        fm = fm.replace(/^type\s*:.*$/m, () => `type: ${yamlVal(type)}`);
      else
        fm = `type: ${yamlVal(type)}
${fm}`;
      if (hasSub) {
        if (/^subtype\s*:/m.test(fm))
          fm = fm.replace(/^subtype\s*:.*$/m, () => `subtype: ${yamlVal(subtype)}`);
        else
          fm = `${fm}
subtype: ${yamlVal(subtype)}`;
      }
      if (hasSize) {
        if (/^size\s*:/m.test(fm))
          fm = fm.replace(/^size\s*:.*$/m, () => `size: ${yamlVal(size)}`);
        else
          fm = `${fm}
size: ${yamlVal(size)}`;
      }
      if (!/^town\s*:/m.test(fm))
        fm = `${fm}
town: ${yamlVal(town)}`;
      return body.replace(fmMatch[0], () => `---
${fm}
---
`);
    }
    const sub = hasSub ? `subtype: ${yamlVal(subtype)}
` : "";
    const sz = hasSize ? `size: ${yamlVal(size)}
` : "";
    return `---
type: ${yamlVal(type)}
${sub}${sz}town: ${yamlVal(town)}
---
${body}`;
  }
  // Fill {{name}}, {{type}}, {{subtype}}, {{size}}, {{town}} tokens; Randomness syntax is left intact.
  fillTemplate(tpl, name, type, town, subtype, size) {
    return tpl.replace(/\{\{\s*name\s*\}\}/g, () => name).replace(/\{\{\s*type\s*\}\}/g, () => type).replace(/\{\{\s*subtype\s*\}\}/g, () => subtype ?? "").replace(/\{\{\s*size\s*\}\}/g, () => size ?? "").replace(/\{\{\s*town\s*\}\}/g, () => town);
  }
  // Built-in fallback note when no template exists for a type.
  defaultPlaceNote(name, type, town) {
    return [`# ${name}`, "", `*${type} in ${town}.*`, "", "_No template found \u2014 create one in your Town Forge template folder to flesh this out._", ""].join("\n");
  }
  // Turn positioned slots into named places.  Each pin type names either via
  // its built-in word lists (default, deterministic, no dependencies) or a
  // custom JS hook (power users — may call other plugins like Randomness).
  // A failing or empty JS hook falls back to the built-in generator so a bad
  // hook never breaks the export.
  async resolveNames(slots, town) {
    const types = new Map(this.getPinTypes().map((t) => [t.id, t]));
    const usedByType = /* @__PURE__ */ new Map();
    const places = [];
    for (const slot of slots) {
      const t = types.get(slot.pinTypeId);
      if (!t)
        continue;
      let used = usedByType.get(t.id);
      if (!used) {
        used = /* @__PURE__ */ new Set();
        usedByType.set(t.id, used);
      }
      let name = "";
      let subtype = "";
      if (t.nameMode === "js" && t.nameJs && t.nameJs.trim()) {
        try {
          const r = await this.runNameHook(t.nameJs, { seed: slot.seed, town, type: t.noteType, index: slot.index, subtypes: t.subtypes ?? [] });
          name = r.name;
          subtype = r.subtype;
        } catch (e) {
          name = "";
          subtype = "";
        }
      }
      if (!name) {
        const lists = t.nameLists ?? { surnames: ["Oakhart"], adjectives: ["Old"], nouns: ["House"] };
        name = builtinName(lists, slot.seed, used);
      } else {
        if (used.has(name)) {
          let n = 2;
          while (used.has(`${name} ${n}`))
            n++;
          name = `${name} ${n}`;
        }
        used.add(name);
      }
      if (!subtype && t.subtypes && t.subtypes.length) {
        subtype = t.subtypes[(slot.seed >>> 0) % t.subtypes.length];
      }
      places.push({ name, buildingType: t.noteType, noteType: t.noteType, layerName: t.layerName, px: slot.px, icon: t.icon, subtype: subtype || void 0 });
    }
    return places;
  }
  // Evaluate a custom JS name hook.  The body is an expression OR statements
  // ending in a return.  In scope: app, api (Randomness if present), seed,
  // town, type, index, subtypes (the configured subtype list for this pin).
  // May resolve to EITHER a string (the name; subtype empty) OR an object
  // { name, subtype } — the correlated path, where one roll yields both.
  async runNameHook(body, ctx) {
    const app = this.app;
    const rdm = app.plugins?.plugins?.["randomness"];
    const api = rdm?.api;
    const fn = new Function(
      "app",
      "api",
      "seed",
      "town",
      "type",
      "index",
      "subtypes",
      `"use strict"; return (async () => { ${/\breturn\b/.test(body) ? body : `return (${body});`} })();`
    );
    const out = await Promise.race([
      Promise.resolve(fn(app, api, ctx.seed, ctx.town, ctx.type, ctx.index, ctx.subtypes)),
      new Promise((_, rej) => setTimeout(() => rej(new Error("name hook timed out after 5s")), 5e3))
    ]);
    if (out && typeof out === "object" && !Array.isArray(out)) {
      const name = String(out.name ?? "").trim();
      const subtype = String(out.subtype ?? "").trim();
      return { name, subtype };
    }
    return { name: String(out ?? "").trim(), subtype: "" };
  }
  // Write one note per place into the map folder.  When grouping is enabled the
  // note goes into a per-type subfolder (<folder>/<NoteType>/), otherwise flat
  // in <folder>.  Titles are deduped GLOBALLY across the export (not per
  // subfolder) so wikilinks — which Obsidian resolves by basename, regardless
  // of folder — stay unambiguous and the pins keep working.  Templates are
  // cached per type to avoid re-reading.  Returns counts so the caller can tell
  // the user whether templates were found.
  async writePlaceNotes(places, folder, town, size) {
    const tplCache = /* @__PURE__ */ new Map();
    const usedTitles = /* @__PURE__ */ new Set();
    const ensuredFolders = /* @__PURE__ */ new Set([folder]);
    const group = this.getGroupNotesByType();
    let fromTemplate = 0;
    let fromDefault = 0;
    for (const pl of places) {
      let tpl = tplCache.get(pl.buildingType);
      if (tpl === void 0) {
        tpl = await this.readTemplate(pl.buildingType);
        tplCache.set(pl.buildingType, tpl);
      }
      let title = this.sanitizeName(pl.name);
      if (usedTitles.has(title.toLowerCase())) {
        let n = 2;
        while (usedTitles.has(`${title} ${n}`.toLowerCase()))
          n++;
        title = `${title} ${n}`;
      }
      usedTitles.add(title.toLowerCase());
      pl.noteTitle = title;
      let body = tpl !== null ? this.fillTemplate(tpl, pl.name, pl.noteType, town, pl.subtype, size) : this.defaultPlaceNote(pl.name, pl.noteType, town);
      body = this.ensureTypeFrontmatter(body, pl.noteType, town, pl.subtype, size);
      let destFolder = folder;
      if (group) {
        const sub = this.sanitizeName(pl.noteType) || "Other";
        destFolder = `${folder}/${sub}`;
        if (!ensuredFolders.has(destFolder)) {
          await this.ensureFolder(destFolder);
          ensuredFolders.add(destFolder);
        }
      }
      const notePath = `${destFolder}/${title}.md`;
      let written = true;
      if (!this.app.vault.getAbstractFileByPath(notePath)) {
        try {
          await this.app.vault.create(notePath, body);
        } catch (e) {
          written = false;
        }
      }
      if (written) {
        if (tpl !== null)
          fromTemplate++;
        else
          fromDefault++;
      }
    }
    return { fromTemplate, fromDefault };
  }
  // ---- Zoom / pan view state (CSS transform on the canvas, no re-render) ----
  applyView() {
    if (!this.canvas)
      return;
    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }
  clampPan() {
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight || this.canvas.clientHeight;
    const sw = vw * this.zoom;
    const sh = vh * this.zoom;
    const minX = vw - sw;
    const minY = vh - sh;
    if (sw <= vw)
      this.panX = 0;
    else
      this.panX = Math.min(0, Math.max(minX, this.panX));
    if (sh <= vh)
      this.panY = 0;
    else
      this.panY = Math.min(0, Math.max(minY, this.panY));
  }
  zoomBy(factor, centre) {
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight || this.canvas.clientHeight;
    const cx = centre ? centre.x : vw / 2;
    const cy = centre ? centre.y : vh / 2;
    const prev = this.zoom;
    const next = Math.max(1, Math.min(6, prev * factor));
    if (next === prev)
      return;
    const ratio = next / prev;
    this.panX = cx - ratio * (cx - this.panX);
    this.panY = cy - ratio * (cy - this.panY);
    this.zoom = next;
    this.clampPan();
    this.applyView();
  }
  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyView();
  }
  refresh() {
    const s = this.state;
    const opts = {
      roughness: s.roughness,
      octaves: s.octaves,
      riverWidth: 0.06,
      lakeSize: 0.3,
      rangeLen: 0.65,
      peakCount: s.mountain,
      seaSide: s.terrain === "coastal" && s.direction !== "random" ? s.direction : void 0,
      mountainSide: s.terrain !== "mountain" ? this.mountainSideString() || void 0 : void 0
    };
    const fullMode = s.mode === "full";
    const genSize = fullMode ? MAP_SIZE_BY_SIZE[s.settlement] ?? 1e3 : 700;
    this.canvas.width = genSize;
    this.canvas.height = genSize;
    this.resetView();
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      this.status.setText("Could not get a 2D canvas context.");
      return;
    }
    const t0 = performance.now();
    try {
      if (fullMode) {
        const full = generateFull(s.terrain, s.seed, {
          ...opts,
          mode: "full",
          size: s.settlement,
          showForest: true,
          showRoads: true,
          enabledEdges: this.enabledEdges(),
          overrides: this.overrides()
        });
        const baseDist = SIZE_BASE_DISTANCE[s.settlement] ?? LANDSCAPE_BASE_DISTANCE;
        renderFull(ctx, full, genSize, genSize, s.terrain, baseDist * this.getScaleMultiplier(), this.getDistanceUnit(), s.name);
        this.lastFullScene = full;
        this.lastMapSize = genSize;
        const houses = (full.houses || []).length;
        const nm = s.name ? `${s.name} \u2014 ` : "";
        this.status.setText(`${nm}${s.terrain} \xB7 ${s.settlement} \xB7 "${s.seed}" \xB7 ${houses} buildings`);
      } else {
        const scene = generateLandscape(s.terrain, s.seed, genSize, genSize, opts);
        renderScene(ctx, scene, genSize, genSize, s.terrain, LANDSCAPE_BASE_DISTANCE * this.getScaleMultiplier(), this.getDistanceUnit());
        this.lastFullScene = null;
        this.lastMapSize = genSize;
        this.status.setText(`${s.terrain} \xB7 landscape \xB7 "${s.seed}"`);
      }
      this.lastGenMs = performance.now() - t0;
      this.stale = false;
      if (this.generateBtn)
        this.generateBtn.setText("Generate");
    } catch (e) {
      this.status.setText(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  async onClose() {
    this.contentEl.empty();
  }
};
