/* eslint-disable @typescript-eslint/no-unused-vars */
/* GEDEON Newsletter Generator — App Logic */

// ============ STATE ============
let rawData = [];
let mappedProducts = [];
let selectedIds = new Set();
let selectedProductsOrder = []; // Track order of selected products
let generatedHTML = "";
const SERVER_URL = ""; // Use relative paths for Next.js API Routes

const FIELD_MAP = {
  productName: {
    label: "Product Name",
    keys: ["name", "Name", "product", "Product", "nazwa"],
  },
  sku: {
    label: "SKU / Code",
    keys: ["sku", "SKU", "Sku", "id", "kod", "Kod produktu"],
  },
  price: {
    label: "Price",
    keys: [
      "retailPriceGross",
      "price",
      "Price",
      "priceAfterDiscountNet",
      "cena",
    ],
  },
  description: {
    label: "Description",
    keys: ["desc", "description", "Description", "Opis", "opis"],
  },
  image: {
    label: "Main Image",
    keys: ["photo", "image", "Image", "Photo", "zdjecie", "Zdjęcie"],
  },
  image2: { label: "Image 2", keys: ["photo1", "image2", "Image2"] },
  image3: { label: "Image 3", keys: ["photo2", "image3", "Image3"] },
  link: { label: "Product Link", keys: ["url", "link", "Link", "URL"] },
  category: {
    label: "Category",
    keys: ["Kategoria", "category", "Category", "kategoria"],
  },
  brand: { label: "Brand", keys: ["brand", "Brand", "marka", "Marka"] },
};
// Global State Variables
let columnMapping = {};
let allAccounts = [];
let allAccountsFull = [];
let allContacts = [];
let selectedContactIds = new Set();
let isEditMode = false;
let previewIframe = null;

// ============ INIT ============
document.addEventListener("DOMContentLoaded", () => {
  setupUpload();
  setupColorSync();
  setupTemplateSelect();
  checkServer();
});

function checkServer() {
  const el = document.getElementById("serverStatus");
  fetch(SERVER_URL + "/api/newsletter/health")
    .then((r) => r.json())
    .then(() => {
      el.innerHTML =
        '<span class="status-dot online"></span> Server: connected';
    })
    .catch(() => {
      el.innerHTML =
        '<span class="status-dot offline"></span> Server: offline (start server.js)';
    });
}

// ============ STEP NAVIGATION ============
function navigateTo(panelId) {
  // Hide all panels
  document
    .querySelectorAll(".step-panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.remove("active"));

  // Show target panel
  const target = document.getElementById(panelId);
  if (target) {
    target.classList.add("active");
    // Update sidebar active state
    const navBtn = document.querySelector(
      `.nav-item[data-target="${panelId}"]`,
    );
    if (navBtn) navBtn.classList.add("active");
  }

  // Scroll to top
  window.scrollTo(0, 0);

  // Trigger Panel Specific Loaders
  if (panelId === "panelAccounts") loadAccounts();
  if (panelId === "step5") {
    loadAccountsForSend();
    updateSendRecipientSummary();
  }
  if (panelId === "panelScheduled") loadScheduledJobs();
  if (panelId === "panelHistory") loadHistoryJobs();
  if (panelId === "step3") renderProductsGrid();
  if (panelId === "addressBookPanel") loadContacts();
  if (panelId === "panelEmailBuilder") initEmailBuilder();
  if (panelId === "panelArticles") loadArticles();
}

function goToStep(n) {
  // Legacy support or redirect to new system
  navigateTo("step" + n);
}

// ============ STEP 1: FILE UPLOAD ============
function setupUpload() {
  const zone = document.getElementById("uploadZone");
  const input = document.getElementById("fileInput");
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });
}

function handleFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  document.getElementById("infoFileName").textContent = file.name;
  if (ext === "csv") parseCSV(file);
  else if (ext === "xls" || ext === "xlsx") parseExcel(file);
}

function parseCSV(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (r) => processData(r.data, r.meta.delimiter || ","),
    error: (e) => alert("CSV Error: " + e.message),
  });
}

function parseExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    processData(data, "N/A (Excel)");
  };
  reader.readAsArrayBuffer(file);
}

function processData(data, delimiter) {
  rawData = data.filter((row) =>
    Object.values(row).some((v) => v && String(v).trim()),
  );
  const cols = rawData.length ? Object.keys(rawData[0]) : [];
  document.getElementById("infoRowCount").textContent = rawData.length;
  document.getElementById("infoColCount").textContent = cols.length;
  document.getElementById("infoDelimiter").textContent = delimiter;
  document.getElementById("fileInfo").style.display = "grid";
  document.getElementById("step1Actions").style.display = "flex";
  autoMapColumns(cols);
  buildMappingUI(cols);
}

// ============ STEP 2: COLUMN MAPPING ============
function autoMapColumns(cols) {
  columnMapping = {};
  for (const [field, cfg] of Object.entries(FIELD_MAP)) {
    const match = cols.find((c) =>
      cfg.keys.some((k) => c.toLowerCase().trim() === k.toLowerCase()),
    );
    if (match) columnMapping[field] = match;
  }
}

function buildMappingUI(cols) {
  const grid = document.getElementById("mappingGrid");
  grid.innerHTML = "";
  for (const [field, cfg] of Object.entries(FIELD_MAP)) {
    const item = document.createElement("div");
    item.className = "mapping-item";
    const opts = ['<option value="">(not mapped)</option>'];
    cols.forEach((c) => {
      const sel = columnMapping[field] === c ? "selected" : "";
      opts.push(`<option value="${c}" ${sel}>${c}</option>`);
    });
    item.innerHTML = `<label>${cfg.label}</label><select data-field="${field}">${opts.join("")}</select>`;
    item.querySelector("select").addEventListener("change", (e) => {
      columnMapping[field] = e.target.value;
    });
    grid.appendChild(item);
  }
}

function applyMapping() {
  mappedProducts = rawData
    .map((row, idx) => {
      const get = (f) => (columnMapping[f] ? row[columnMapping[f]] || "" : "");
      return {
        id: idx,
        name: get("productName"),
        sku: get("sku"),
        price: get("price"),
        description: get("description"),
        image: get("image"),
        image2: get("image2"),
        image3: get("image3"),
        link: get("link"),
        category: get("category"),
        brand: get("brand"),
      };
    })
    .filter((p) => p.name.trim());
  goToStep(3);
}

// ============ STEP 3: PRODUCT SELECTION ============
function renderProductsGrid() {
  const grid = document.getElementById("productsGrid");
  const search = (
    document.getElementById("productSearch").value || ""
  ).toLowerCase();
  const filtered = mappedProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(search) ||
      (p.category || "").toLowerCase().includes(search),
  );
  grid.innerHTML = "";
  document.getElementById("totalCount").textContent = filtered.length;
  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "prod-card" + (selectedIds.has(p.id) ? " selected" : "");
    const imgSrc =
      p.image ||
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" fill="%23333"><rect width="200" height="140"/><text x="50%" y="50%" fill="%23666" text-anchor="middle" dy=".3em" font-size="14">No Image</text></svg>';
    const priceStr = p.price
      ? parseFloat(String(p.price).replace(",", "."))
      : "";
    card.innerHTML = `
            <div class="check-mark">${selectedIds.has(p.id) ? "✓" : ""}</div>
            <img src="${imgSrc}" alt="" loading="lazy" onerror="this.style.display='none'">
            <div class="prod-info">
                <div class="prod-name">${p.name}</div>
                <div class="prod-sku">${p.sku}</div>
                ${priceStr ? `<div class="prod-price">${priceStr} PLN</div>` : ""}
                ${p.category ? `<div class="prod-cat">${p.category}</div>` : ""}
            </div>`;
    card.addEventListener("click", () => toggleProduct(p.id));
    grid.appendChild(card);
  });
  updateSelectedCount();
  renderSelectedProductsOrder();
}

function toggleProduct(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    selectedProductsOrder = selectedProductsOrder.filter((pid) => pid !== id);
  } else {
    selectedIds.add(id);
    selectedProductsOrder.push(id);
  }
  renderProductsGrid();
}
function selectAll() {
  const search = (
    document.getElementById("productSearch").value || ""
  ).toLowerCase();
  mappedProducts
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        (p.category || "").toLowerCase().includes(search),
    )
    .forEach((p) => {
      if (!selectedIds.has(p.id)) {
        selectedIds.add(p.id);
        selectedProductsOrder.push(p.id);
      }
    });
  renderProductsGrid();
}
function deselectAll() {
  selectedIds.clear();
  selectedProductsOrder = [];
  renderProductsGrid();
}
function updateSelectedCount() {
  document.getElementById("selectedCount").textContent = selectedIds.size;
}

// Search listener
document
  .getElementById("productSearch")
  ?.addEventListener("input", () => renderProductsGrid());

// ============ PRODUCT ORDERING ============
function renderSelectedProductsOrder() {
  const section = document.getElementById("selectedOrderSection");
  const list = document.getElementById("selectedProductsList");

  if (selectedProductsOrder.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  const products = getSelectedProducts();

  list.innerHTML = products
    .map((p, idx) => {
      const imgSrc =
        p.image ||
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="%23ddd"><rect width="60" height="60"/></svg>';
      return `
            <div class="selected-product-item" draggable="true" data-product-id="${p.id}" data-index="${idx}">
                <div class="drag-handle">⋮⋮</div>
                <img src="${imgSrc}" alt="${p.name}" onerror="this.style.display='none'">
                <div class="product-details">
                    <div class="product-name">${p.name}</div>
                    <div class="product-sku">${p.sku || "No SKU"}</div>
                </div>
                <div class="order-controls">
                    <button onclick="moveProductUp(${idx})" ${idx === 0 ? "disabled" : ""}>▲</button>
                    <button onclick="moveProductDown(${idx})" ${idx === products.length - 1 ? "disabled" : ""}>▼</button>
                </div>
            </div>
        `;
    })
    .join("");

  // Add drag and drop event listeners
  const items = list.querySelectorAll(".selected-product-item");
  items.forEach((item) => {
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("drop", handleDrop);
    item.addEventListener("dragend", handleDragEnd);
  });
}

let draggedItem = null;

function handleDragStart(e) {
  const target = e.currentTarget;
  if (!(target instanceof HTMLElement)) return;

  draggedItem = target;
  target.classList.add("dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", target.innerHTML);
  }
}

function handleDragOver(e) {
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  return false;
}

function handleDrop(e) {
  const target = e.currentTarget;
  if (!(target instanceof HTMLElement)) return false;

  if (e.stopPropagation) e.stopPropagation();
  if (draggedItem && draggedItem !== target) {
    const draggedIndex = parseInt(draggedItem.dataset.index, 10);
    const targetIndex = parseInt(target.dataset.index, 10);

    // Reorder the array
    const [removed] = selectedProductsOrder.splice(draggedIndex, 1);
    selectedProductsOrder.splice(targetIndex, 0, removed);

    renderSelectedProductsOrder();
  }
  return false;
}

function handleDragEnd(e) {
  const target = e.currentTarget;
  if (target instanceof HTMLElement) {
    target.classList.remove("dragging");
  }
}

function moveProductUp(index) {
  if (index > 0) {
    [selectedProductsOrder[index], selectedProductsOrder[index - 1]] = [
      selectedProductsOrder[index - 1],
      selectedProductsOrder[index],
    ];
    renderSelectedProductsOrder();
  }
}

function moveProductDown(index) {
  if (index < selectedProductsOrder.length - 1) {
    [selectedProductsOrder[index], selectedProductsOrder[index + 1]] = [
      selectedProductsOrder[index + 1],
      selectedProductsOrder[index],
    ];
    renderSelectedProductsOrder();
  }
}

// ============ STEP 4: NEWSLETTER GENERATION ============
function setupColorSync() {
  const pairs = [
    ["cfgColor", "cfgColorHex"],
    ["cfgBtnColor", "cfgBtnColorHex"],
  ];
  pairs.forEach(([picker, hex]) => {
    document.getElementById(picker)?.addEventListener("input", (e) => {
      document.getElementById(hex).value = e.target.value;
    });
    document.getElementById(hex)?.addEventListener("input", (e) => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value))
        document.getElementById(picker).value = e.target.value;
    });
  });
}
function setupTemplateSelect() {
  document.querySelectorAll(".template-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      document
        .querySelectorAll(".template-opt")
        .forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      opt.querySelector("input").checked = true;
    });
  });
}

function getSelectedProducts() {
  // Return products in the order they were selected/reordered
  return selectedProductsOrder
    .map((id) => mappedProducts.find((p) => p.id === id))
    .filter((p) => p !== undefined);
}

// (previewIframe and isEditMode are global)

function generateNewsletter() {
  const products = getSelectedProducts();
  if (!products.length) {
    alert("Select at least one product!");
    return;
  }
  const tpl = document.querySelector('input[name="template"]:checked').value;
  const cfg = {
    template: tpl,
    header: document.getElementById("cfgHeader").value,
    subtitle: document.getElementById("cfgSubtitle").value,
    logo: document.getElementById("cfgLogo").value,
    footer: document.getElementById("cfgFooter").value,
    color: document.getElementById("cfgColorHex").value || "#1a1a2e",
    btnColor: document.getElementById("cfgBtnColorHex").value || "#c9a84c",
  };
  const tplMap = {
    grid: tplGrid,
    spotlight: tplSpotlight,
    minimal: tplMinimal,
    sidebyside: tplSideBySide,
    herogrid: tplHeroGrid,
    catalog: tplCatalog,
    elegant: tplElegant,
    modern: tplModern,
    corporate: tplCorporate,
  };
  generatedHTML = (tplMap[tpl] || tplGrid)(products, cfg);

  // Show in preview iframe
  const vis = document.getElementById("previewVisual");
  vis.innerHTML = `
        <div class="preview-edit-controls">
            <button onclick="toggleEditMode()" id="editModeBtn">✏️ Enable Editing</button>
            <button onclick="addTextBlock()" id="addTextBtn" style="display:none;">+ Add Text Block</button>
            <button onclick="savePreviewChanges()" id="saveChangesBtn" style="display:none;">💾 Save Changes</button>
            <span class="edit-status" id="editStatus"></span>
        </div>
    `;

  const frame = document.createElement("iframe");
  frame.id = "newsletterPreviewFrame";
  frame.style.cssText =
    "width:100%;min-height:600px;border:none;background:#fff;border-radius:0 0 8px 8px;";
  vis.appendChild(frame);
  previewIframe = frame;

  frame.contentDocument.open();
  frame.contentDocument.write(generatedHTML);
  frame.contentDocument.close();

  setTimeout(() => {
    frame.style.height = frame.contentDocument.body.scrollHeight + 40 + "px";
    // Add resize observer to adjust iframe height
    const resizeObserver = new ResizeObserver(() => {
      frame.style.height = frame.contentDocument.body.scrollHeight + 40 + "px";
    });
    resizeObserver.observe(frame.contentDocument.body);
  }, 500);

  document.getElementById("htmlCodeArea").value = generatedHTML;
  document.getElementById("copyBtn").disabled = false;
  document.getElementById("dlBtn").disabled = false;
  document.getElementById("toSendBtn").disabled = false;
  isEditMode = false;
}

function toggleEditMode() {
  if (!previewIframe) return;

  isEditMode = !isEditMode;
  const doc = previewIframe.contentDocument;
  const btn = document.getElementById("editModeBtn");
  const addBtn = document.getElementById("addTextBtn");
  const saveBtn = document.getElementById("saveChangesBtn");
  const status = document.getElementById("editStatus");

  if (isEditMode) {
    // Enable editing mode
    btn.textContent = "🔒 Disable Editing";
    addBtn.style.display = "inline-block";
    saveBtn.style.display = "inline-block";
    status.textContent = "✏️ Edit Mode Active";

    // Make text elements editable
    const textElements = doc.querySelectorAll("h1, h2, h3, p, a, td, th, span");
    textElements.forEach((el) => {
      // Skip elements that are just structural or empty
      if (el.textContent.trim() && !el.querySelector("img")) {
        el.setAttribute("contenteditable", "true");
        el.style.cursor = "text";
      }
    });

    // Add visual feedback
    doc.body.style.outline = "3px solid #c9a84c";

    // Show toolbar
    document.getElementById("editorToolbar").style.display = "flex";
    setupEditorToolbar(doc);
  } else {
    // Disable editing mode
    btn.textContent = "✏️ Enable Editing";
    addBtn.style.display = "none";
    saveBtn.style.display = "none";
    status.textContent = "";

    // Hide toolbar
    document.getElementById("editorToolbar").style.display = "none";

    // Remove contenteditable
    const editableElements = doc.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach((el) => {
      el.removeAttribute("contenteditable");
      el.style.cursor = "";
    });

    doc.body.style.outline = "";
  }
}

function setupEditorToolbar(doc) {
  const toolbar = document.getElementById("editorToolbar");
  // Remove old listeners to avoid duplicates if toggled multiple times
  const newToolbar = toolbar.cloneNode(true);
  toolbar.parentNode.replaceChild(newToolbar, toolbar);

  newToolbar.querySelectorAll("button[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd;
      doc.execCommand(cmd, false, null);
      savePreviewChanges(); // Auto-save on edit
    });
  });

  newToolbar.querySelector("#fontFamilyBtn").addEventListener("change", (e) => {
    doc.execCommand("fontName", false, e.target.value);
  });

  newToolbar.querySelector("#fontSizeBtn").addEventListener("change", (e) => {
    doc.execCommand("fontSize", false, e.target.value);
  });

  newToolbar.querySelector("#foreColorBtn").addEventListener("input", (e) => {
    doc.execCommand("foreColor", false, e.target.value);
  });
}

function addTextBlock() {
  if (!previewIframe || !isEditMode) return;

  const doc = previewIframe.contentDocument;
  const newBlock = doc.createElement("div");
  newBlock.style.cssText =
    "padding:20px 30px;background:#f9f9f9;border:2px dashed #c9a84c;margin:10px 0;";
  newBlock.setAttribute("contenteditable", "true");
  newBlock.innerHTML =
    '<p style="margin:0;color:#333;font-size:14px;cursor:text;">Click to edit this text block. You can add any custom content here.</p>';

  // Insert before the footer (last table row usually)
  const tables = doc.querySelectorAll("table");
  if (tables.length > 0) {
    const mainTable = tables[0];
    const lastRow = mainTable.querySelector("tr:last-child");
    if (lastRow) {
      const newRow = doc.createElement("tr");
      const newCell = doc.createElement("td");
      newCell.appendChild(newBlock);
      newRow.appendChild(newCell);
      lastRow.parentNode.insertBefore(newRow, lastRow);
    }
  }

  // Adjust iframe height
  previewIframe.style.height = doc.body.scrollHeight + 40 + "px";
}

function savePreviewChanges() {
  if (!previewIframe) return;

  const doc = previewIframe.contentDocument;
  generatedHTML = "<!DOCTYPE html>" + doc.documentElement.outerHTML;
  document.getElementById("htmlCodeArea").value = generatedHTML;

  // Show confirmation
  const status = document.getElementById("editStatus");
  status.textContent = "✅ Changes Saved!";
  setTimeout(() => {
    if (!isEditMode) status.textContent = "";
    else status.textContent = "✏️ Edit Mode Active";
  }, 2000);
}

function switchPreviewTab(tab) {
  document
    .querySelectorAll(".preview-tabs .tab-btn")
    .forEach((b) => b.classList.remove("active"));
  if (tab === "visual") {
    document.getElementById("previewVisual").style.display = "block";
    document.getElementById("previewCode").style.display = "none";
    document
      .querySelector(".preview-tabs .tab-btn:first-child")
      .classList.add("active");
  } else {
    document.getElementById("previewVisual").style.display = "none";
    document.getElementById("previewCode").style.display = "block";
    document
      .querySelector(".preview-tabs .tab-btn:last-child")
      .classList.add("active");
  }
}

function downloadHTML() {
  if (!generatedHTML) return;
  const blob = new Blob([generatedHTML], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gedeon-newsletter.html";
  a.click();
  URL.revokeObjectURL(a.href);
}

function copyHTML() {
  if (!generatedHTML) return;
  navigator.clipboard.writeText(generatedHTML).then(() => {
    const btn = document.getElementById("copyBtn");
    btn.textContent = "✓ Copied!";
    setTimeout(() => (btn.textContent = "📋 Copy HTML"), 2000);
  });
}

// ============ NEWSLETTER TEMPLATES ============
function emailWrapper(content, cfg) {
  const logoHTML = cfg.logo
    ? `<tr><td style="text-align:center;padding:20px 0 0;"><img src="${cfg.logo}" alt="Logo" style="max-height:60px;" width="auto" height="60"></td></tr>`
    : "";

  // Custom styles based on template
  let fontFamily = "Arial,Helvetica,sans-serif";
  let bodyBg = "#f0f0f0";
  let containerBg = "#ffffff";
  let borderRadius = "8px";
  let headerStyle = `margin:0;color:#fff;font-size:26px;font-weight:700;`;
  let headerContainerStyle = `background:${cfg.color};padding:36px 30px;text-align:center;`;

  if (cfg.template === "elegant") {
    fontFamily = 'Georgia, Times, "Times New Roman", serif';
    bodyBg = "#f9f9f9";
    headerStyle = `margin:0;color:${cfg.color};font-size:32px;font-weight:normal;font-style:italic;letter-spacing:1px;border-bottom:1px solid #ddd;padding-bottom:20px;`;
    headerContainerStyle = `background:#fff;padding:40px 30px 10px;text-align:center;`;
    borderRadius = "0";
  } else if (cfg.template === "modern") {
    fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    bodyBg = "#eeeeee";
    borderRadius = "0";
    headerStyle = `margin:0;color:#fff;font-size:42px;font-weight:800;text-transform:uppercase;letter-spacing:-1px;line-height:0.9;`;
    headerContainerStyle = `background:${cfg.color};padding:60px 40px;text-align:left;`;
  } else if (cfg.template === "corporate") {
    fontFamily = "Arial, sans-serif";
    bodyBg = "#ffffff"; // Corporate clean
    containerBg = "#ffffff";
    headerStyle = `margin:0;color:#000;font-size:24px;font-weight:700;text-transform:uppercase;`;
    headerContainerStyle = `background:#fff;padding:20px 30px;text-align:left;border-bottom:3px solid ${cfg.btnColor};`;
    borderRadius = "0";
  }

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${cfg.header}</title>
<!--[if mso]><style>table{border-collapse:collapse;}td{font-family:${fontFamily};}</style><![endif]-->
<style>
  body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  @media only screen and (max-width: 640px) {
    .email-container { width: 100% !important; }
    .stack-col { display: block !important; width: 100% !important; }
    .stack-col img { width: 100% !important; height: auto !important; }
    .mob-hide { display: none !important; }
    .mob-pad { padding: 12px 16px !important; }
    h1 { font-size: 22px !important; }
    h2 { font-size: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;font-family:${fontFamily};background:${bodyBg};">
<center>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bodyBg};padding:20px 0;">
<tr><td align="center" valign="top">
<!--[if (gte mso 9)|(IE)]><table width="640" align=\"center\" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table class="email-container" width="640" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;background:${containerBg};border-radius:${borderRadius};overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);max-width:640px;width:100%;">
${logoHTML}
<tr><td style="${headerContainerStyle}">
<h1 style="${headerStyle}">${cfg.header}</h1>
${cfg.subtitle ? `<p style="margin:10px 0 0;color:${cfg.template === "corporate" ? "#666" : "#ffffffbb"};font-size:15px;${cfg.template === "elegant" ? "font-style:italic;color:#666;" : ""}">${cfg.subtitle}</p>` : ""}
</td></tr>
${content}
<tr><td style="background:${cfg.template === "corporate" ? "#f8f8f8" : cfg.template === "elegant" ? "#fff" : cfg.color};padding:24px 30px;text-align:center;${cfg.template === "elegant" ? "border-top:1px solid #eee;" : ""}${cfg.template === "corporate" ? "border-top:1px solid #ddd;" : ""}">
<p style="margin:0;color:${cfg.template === "corporate" || cfg.template === "elegant" ? "#888" : "#ffffffaa"};font-size:12px;line-height:1.6;white-space:pre-line;">${cfg.footer}</p>
</td></tr>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
</td></tr></table>
</center>
</body></html>`;
}

function productBtn(link, btnColor, label) {
  label = label || "View Product";
  return `<a href="${link}" style="display:inline-block;background:${btnColor};color:#fff;padding:10px 24px;text-decoration:none;border-radius:5px;font-weight:600;font-size:14px;" target="_blank">${label}</a>`;
}
function productBtnOutline(link, btnColor, label) {
  label = label || "Shop now";
  return `<a href="${link}" style="display:inline-block;background:#fff;color:${btnColor};padding:8px 20px;text-decoration:none;border-radius:4px;font-weight:700;font-size:13px;border:2px solid ${btnColor};" target="_blank">${label}</a>`;
}

function fmtPrice(p) {
  if (!p) return "";
  const n = parseFloat(String(p).replace(",", "."));
  return isNaN(n) ? "" : n.toFixed(2) + " PLN";
}

function stripHtml(s) {
  return s ? String(s).replace(/<[^>]*>/g, "") : "";
}
function truncate(s, len) {
  s = stripHtml(s);
  return s.length > len ? s.substring(0, len) + "..." : s;
}

// --- 1. Classic Grid (2-col, images constrained to ~280px) ---
function tplGrid(products, cfg) {
  let rows = "";
  for (let i = 0; i < products.length; i += 2) {
    let cells = "";
    for (let j = i; j < i + 2 && j < products.length; j++) {
      const p = products[j];
      const img = p.image || "";
      cells += `<td class="stack-col" width="50%" valign="top" style="padding:12px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;overflow:hidden;border:1px solid #eee;">
${img ? `<tr><td style="text-align:center;background:#fff;padding:10px;"><img src="${img}" alt="${p.name}" width="260" style="width:260px;max-width:100%;height:auto;display:block;margin:0 auto;" onerror="this.parentElement.parentElement.style.display='none'"></td></tr>` : ""}
<tr><td style="padding:16px;">
<h3 style="margin:0 0 6px;font-size:16px;color:#222;">${p.name}</h3>
${p.sku ? `<p style="margin:0 0 4px;font-size:11px;color:#999;">SKU: ${p.sku}</p>` : ""}
${p.category ? `<p style="margin:0 0 6px;font-size:11px;color:#888;">${p.category}</p>` : ""}
${fmtPrice(p.price) ? `<p style="margin:0 0 12px;font-size:18px;font-weight:700;color:${cfg.btnColor};">${fmtPrice(p.price)}</p>` : ""}
${p.link ? productBtn(p.link, cfg.btnColor) : ""}
</td></tr></table></td>`;
    }
    if (i + 1 >= products.length)
      cells += '<td class="mob-hide" width="50%"></td>';
    rows += `<tr>${cells}</tr>`;
  }
  return emailWrapper(
    `<tr><td style="padding:8px;"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`,
    cfg,
  );
}

// --- 2. Feature Spotlight (stacked, full-width images capped at 580px) ---
function tplSpotlight(products, cfg) {
  let cards = "";
  products.forEach((p) => {
    const img = p.image || "";
    cards += `<tr><td style="padding:16px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:10px;overflow:hidden;border:1px solid #eee;box-shadow:0 1px 6px rgba(0,0,0,.05);">
${img ? `<tr><td style="text-align:center;background:#fff;"><img src="${img}" alt="${p.name}" width="580" style="width:580px;max-width:100%;height:auto;display:block;margin:0 auto;" onerror="this.parentElement.parentElement.style.display='none'"></td></tr>` : ""}
<tr><td style="padding:20px 24px;">
<h3 style="margin:0 0 6px;font-size:20px;color:#222;">${p.name}</h3>
${p.brand ? `<p style="margin:0 0 4px;font-size:12px;color:#888;">${p.brand}</p>` : ""}
${p.description ? `<p style="margin:0 0 12px;font-size:14px;color:#555;line-height:1.5;">${truncate(p.description, 200)}</p>` : ""}
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td>${fmtPrice(p.price) ? `<span style="font-size:22px;font-weight:700;color:${cfg.btnColor};">${fmtPrice(p.price)}</span>` : ""}</td>
<td align="right">${p.link ? productBtn(p.link, cfg.btnColor) : ""}</td>
</tr></table>
</td></tr></table></td></tr>`;
  });
  return emailWrapper(cards, cfg);
}

// --- 3. Minimal List (small thumbnails 72px) ---
function tplMinimal(products, cfg) {
  let rows = "";
  products.forEach((p) => {
    const img = p.image || "";
    rows += `<tr><td style="padding:12px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
${img ? `<td width="80" valign="top" style="padding-right:14px;"><img src="${img}" alt="" width="72" height="72" style="width:72px;height:72px;object-fit:contain;border-radius:6px;display:block;background:#f8f8f8;" onerror="this.style.display='none'"></td>` : ""}
<td valign="middle">
<p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#222;">${p.name}</p>
${p.sku ? `<p style="margin:0;font-size:11px;color:#999;">SKU: ${p.sku}</p>` : ""}
</td>
<td width="120" align="right" valign="middle">
${fmtPrice(p.price) ? `<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${cfg.btnColor};">${fmtPrice(p.price)}</p>` : ""}
${p.link ? `<a href="${p.link}" style="font-size:12px;color:${cfg.btnColor};text-decoration:none;font-weight:600;" target="_blank">View →</a>` : ""}
</td></tr></table></td></tr>`;
  });
  return emailWrapper(rows, cfg);
}

// --- 4. Side by Side (image 240px + text, alternating) ---
function tplSideBySide(products, cfg) {
  let cards = "";
  products.forEach((p, idx) => {
    const img = p.image || "";
    const imgLeft = idx % 2 === 0;
    const imgCell = img
      ? `<td class="stack-col" width="240" valign="top" style="padding:0;"><img src="${img}" alt="${p.name}" width="240" style="width:240px;max-width:100%;height:auto;display:block;" onerror="this.parentElement.style.display='none'"></td>`
      : "";
    const textCell = `<td class="stack-col" valign="middle" style="padding:20px 24px;">
<h3 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#222;">${p.name}</h3>
${p.brand ? `<p style="margin:0 0 4px;font-size:12px;color:${cfg.btnColor};font-weight:600;">${p.brand}</p>` : ""}
${p.description ? `<p style="margin:0 0 12px;font-size:13px;color:#555;line-height:1.5;">${truncate(p.description, 120)}</p>` : ""}
${fmtPrice(p.price) ? `<p style="margin:0 0 14px;font-size:20px;font-weight:700;color:${cfg.btnColor};">${fmtPrice(p.price)}</p>` : ""}
${p.link ? productBtnOutline(p.link, cfg.btnColor, "Shop now") : ""}
</td>`;
    cards += `<tr><td style="padding:0;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
${imgLeft ? imgCell + textCell : textCell + imgCell}
</tr></table></td></tr>`;
  });
  return emailWrapper(cards, cfg);
}

// --- 5. Hero + Grid (hero capped at 640px + 2-col 260px product grid) ---
function tplHeroGrid(products, cfg) {
  const hero = products[0];
  const rest = products.slice(1);
  const heroImg = hero.image || "";
  let heroSection = `<tr><td style="padding:0;">
${heroImg ? `<img src="${heroImg}" alt="${hero.name}" width="640" style="width:640px;max-width:100%;height:auto;display:block;" onerror="this.style.display='none'">` : ""}
</td></tr>
<tr><td style="padding:24px 30px;">
<h2 style="margin:0 0 8px;font-size:22px;color:#222;">${hero.name}</h2>
${hero.brand ? `<p style="margin:0 0 6px;font-size:13px;color:${cfg.btnColor};font-weight:600;">${hero.brand}</p>` : ""}
${hero.description ? `<p style="margin:0 0 14px;font-size:14px;color:#555;line-height:1.6;">${truncate(hero.description, 200)}</p>` : ""}
<table cellpadding="0" cellspacing="0"><tr>
<td>${fmtPrice(hero.price) ? `<span style="font-size:22px;font-weight:700;color:${cfg.btnColor};margin-right:16px;">${fmtPrice(hero.price)}</span>` : ""}</td>
<td>${hero.link ? productBtn(hero.link, cfg.btnColor) : ""}</td>
</tr></table>
</td></tr>`;

  let gridSection = "";
  if (rest.length > 0) {
    gridSection += `<tr><td style="padding:20px 30px 10px;text-align:center;">
<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;">More new arrivals</p>
</td></tr>`;
    let gridRows = "";
    for (let i = 0; i < rest.length; i += 2) {
      let cells = "";
      for (let j = i; j < i + 2 && j < rest.length; j++) {
        const p = rest[j];
        const img = p.image || "";
        cells += `<td class="stack-col" width="50%" valign="top" style="padding:8px;text-align:center;">
<table width="100%" cellpadding="0" cellspacing="0">
${img ? `<tr><td style="text-align:center;background:#f8f8f8;padding:12px;"><img src="${img}" alt="${p.name}" width="240" style="width:240px;max-width:100%;height:auto;display:inline-block;" onerror="this.parentElement.parentElement.style.display='none'"></td></tr>` : ""}
<tr><td style="padding:10px 4px;">
<p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#222;">${p.name}</p>
${fmtPrice(p.price) ? `<p style="margin:4px 0 8px;font-size:14px;font-weight:700;color:${cfg.btnColor};">${fmtPrice(p.price)}</p>` : ""}
${p.link ? productBtnOutline(p.link, cfg.btnColor, "Shop now") : ""}
</td></tr></table></td>`;
      }
      if (i + 1 >= rest.length)
        cells += '<td class="mob-hide" width="50%"></td>';
      gridRows += `<tr>${cells}</tr>`;
    }
    gridSection += `<tr><td style="padding:0 22px 20px;"><table width="100%" cellpadding="0" cellspacing="0">${gridRows}</table></td></tr>`;
  }

  return emailWrapper(heroSection + gridSection, cfg);
}

// --- 6. Catalog Gallery (2-col with ~280px product images, fits 640px) ---
function tplCatalog(products, cfg) {
  let rows = "";
  for (let i = 0; i < products.length; i += 2) {
    let cells = "";
    for (let j = i; j < i + 2 && j < products.length; j++) {
      const p = products[j];
      const img = p.image || "";
      cells += `<td class="stack-col" width="50%" valign="top" style="padding:8px;text-align:center;">
<table width="100%" cellpadding="0" cellspacing="0">
${img ? `<tr><td style="text-align:center;background:#f5f5f0;padding:10px;"><img src="${img}" alt="${p.name}" width="260" style="width:260px;max-width:100%;height:auto;display:block;margin:0 auto;" onerror="this.parentElement.parentElement.style.display='none'"></td></tr>` : ""}
<tr><td style="padding:8px 4px;">
${p.brand ? `<p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:600;">${p.brand}</p>` : ""}
<p style="margin:4px 0;font-size:12px;color:#333;line-height:1.3;">${p.name}</p>
${fmtPrice(p.price) ? `<p style="margin:2px 0 0;font-size:13px;font-weight:700;color:#222;">${fmtPrice(p.price)}</p>` : ""}
</td></tr></table></td>`;
    }
    if (i + 1 >= products.length)
      cells += '<td class="mob-hide" width="50%"></td>';
    rows += `<tr>${cells}</tr>`;
  }
  const catalogContent = `<tr><td style="padding:20px 30px 10px;text-align:center;border-bottom:2px solid ${cfg.btnColor};">
<p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#999;">What's New</p>
<h2 style="margin:0 0 4px;font-size:28px;color:#222;">THE WANT LIST</h2>
<p style="margin:0;font-size:13px;color:#888;">The new arrivals on our radar</p>
</td></tr>
<tr><td style="padding:10px 14px;"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="padding:10px 30px 24px;text-align:center;">
<a href="${products[0]?.link || "#"}" style="font-size:13px;color:${cfg.btnColor};text-decoration:underline;font-weight:600;">Shop all the latest arrivals</a>
</td></tr>`;
  return emailWrapper(catalogContent, cfg);
}

// --- 7. Elegant Serif (Classic, upscale) ---
function tplElegant(products, cfg) {
  let rows = "";
  products.forEach((p, i) => {
    const img = p.image || "";
    const isEve = i % 2 === 0;
    rows += `<tr><td style="padding:30px 40px;border-bottom:1px solid #f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td valign="middle" width="50%" class="stack-col" style="padding-right:20px;">
${img ? `<img src="${img}" alt="${p.name}" width="260" style="width:100%;max-width:260px;height:auto;display:block;border:1px solid #eee;padding:4px;" onerror="this.style.display='none'">` : ""}
</td>
<td valign="middle" width="50%" class="stack-col" style="padding-left:10px;">
<p style="font-family:Georgia,serif;font-style:italic;color:#888;font-size:14px;margin:0 0 5px;">${p.brand || "New Arrival"}</p>
<h3 style="font-family:Georgia,serif;font-size:20px;margin:0 0 10px;color:#000;">${p.name}</h3>
${p.description ? `<p style="font-family:Georgia,serif;font-size:14px;color:#555;line-height:1.6;margin:0 0 15px;">${truncate(p.description, 120)}</p>` : ""}
<table width="100%"><tr>
<td>${fmtPrice(p.price) ? `<span style="font-family:Georgia,serif;font-size:18px;color:#000;font-weight:bold;">${fmtPrice(p.price)}</span>` : ""}</td>
<td align="right">${p.link ? `<a href="${p.link}" style="display:inline-block;padding:8px 20px;background:${cfg.color};color:#fff;text-decoration:none;font-family:Georgia,serif;font-size:13px;letter-spacing:1px;">VIEW DETAILS</a>` : ""}</td>
</tr></table>
</td>
</tr>
</table>
</td></tr>`;
  });
  return emailWrapper(
    `<tr><td><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`,
    cfg,
  );
}

// --- 8. Modern Bold (High contrast, big type) ---
function tplModern(products, cfg) {
  let rows = "";
  products.forEach((p, i) => {
    const img = p.image || "";
    rows += `<tr><td style="padding:0;">
<table width="100%" cellpadding="0" cellspacing="0">
${img ? `<tr><td><img src="${img}" alt="${p.name}" width="640" style="width:100%;height:auto;display:block;" onerror="this.style.display='none'"></td></tr>` : ""}
<tr><td style="padding:30px 40px;background:#fff;">
<h3 style="font-size:28px;font-weight:800;margin:0 0 5px;color:#000;line-height:1.2;text-transform:uppercase;">${p.name}</h3>
<p style="font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:2px;margin:0 0 20px;">${p.brand || "Featured Product"}</p>
${p.description ? `<p style="font-size:16px;color:#555;line-height:1.6;margin:0 0 25px;">${truncate(p.description, 180)}</p>` : ""}
<table width="100%"><tr>
<td>${fmtPrice(p.price) ? `<span style="font-size:32px;font-weight:800;color:#000;">${fmtPrice(p.price)}</span>` : ""}</td>
<td align="right">${p.link ? `<a href="${p.link}" style="display:inline-block;padding:15px 30px;background:${cfg.btnColor};color:#fff;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;border-radius:50px;">Shop Now</a>` : ""}</td>
</tr></table>
</td></tr>
</table>
</td></tr>`;
  });
  return emailWrapper(
    `<tr><td style="background:#eeeeee;padding:20px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;">${rows}</table></td></tr>`,
    cfg,
  );
}

// --- 9. Corporate Site (Gedeon style: Red/Black/White, grid) ---
function tplCorporate(products, cfg) {
  let gridRows = "";
  for (let i = 0; i < products.length; i += 2) {
    let cells = "";
    for (let j = i; j < i + 2 && j < products.length; j++) {
      const p = products[j];
      const img = p.image || "";
      cells += `<td class="stack-col" width="50%" valign="top" style="padding:10px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ddd;background:#fff;">
${img ? `<tr><td style="text-align:center;padding:15px;border-bottom:1px solid #eee;"><img src="${img}" alt="${p.name}" width="260" style="width:260px;max-width:100%;height:auto;display:block;margin:0 auto;" onerror="this.parentElement.parentElement.style.display='none'"></td></tr>` : ""}
<tr><td style="padding:15px;text-align:left;">
<p style="margin:0 0 5px;font-size:13px;color:${cfg.btnColor};font-weight:bold;text-transform:uppercase;">${p.brand || "GEDEON"}</p>
<h3 style="margin:0 0 10px;font-size:15px;color:#333;font-weight:normal;line-height:1.4;height:42px;overflow:hidden;">${p.name}</h3>
${fmtPrice(p.price) ? `<p style="margin:0 0 15px;font-size:18px;color:${cfg.btnColor};font-weight:bold;">${fmtPrice(p.price)}</p>` : ""}
${p.link ? `<table width="100%"><tr><td><a href="${p.link}" style="display:block;text-align:center;padding:10px;background:${cfg.btnColor};color:#fff;text-decoration:none;font-size:13px;font-weight:bold;border-radius:4px;">🛒 ADD TO CART</a></td></tr></table>` : ""}
</td></tr>
</table>
</td>`;
    }
    if (i + 1 >= products.length)
      cells += '<td class="mob-hide" width="50%"></td>';
    gridRows += `<tr>${cells}</tr>`;
  }
  return emailWrapper(
    `<tr><td style="padding:10px;"><table width="100%" cellpadding="0" cellspacing="0">${gridRows}</table></td></tr>`,
    cfg,
  );
}

// ============ STEP 5: ACCOUNT MANAGER + ADDRESS BOOK + SENDING ============
// (Variables moved to top of file)

// --- Sub-tab Navigation ---

// --- Sub-tab Navigation ---
// --- Sub-tab Navigation ---
// --- Sub-tab Navigation (Legacy support / Sidebar mapping) ---
function switchSendTab(tab) {
  // This function is largely obsolete with the new sidebar,
  // but kept for compatibility if any old buttons remain.
  const panelMap = {
    accounts: "panelAccounts",
    send: "step5",
    scheduled: "panelScheduled",
    history: "panelHistory",
  };
  if (panelMap[tab]) navigateTo(panelMap[tab]);
}

// (Navigation logic consolidated in main navigateTo function at top of file)
window.navigateTo = navigateTo; // Ensure global exposure just in case

// ============ ACCOUNTS ============
async function loadAccounts() {
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/accounts");
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    allAccounts = await res.json();
    renderAccountsList();
  } catch (err) {
    console.error("Error loading accounts:", err);
    allAccounts = [];
    const el = document.getElementById("accountsList");
    if (el)
      el.innerHTML = `<p class="error-text">Failed to load accounts: ${err.message}. Is server running?</p>`;
  }
}

function renderAccountsList() {
  const el = document.getElementById("accountsList");
  if (!allAccounts.length) {
    el.innerHTML =
      '<p class="placeholder-text">No accounts saved yet. Use the form to add one.</p>';
    return;
  }
  el.innerHTML = allAccounts
    .map(
      (a) => `
        <div class="account-card">
            <div class="acc-name">${a.name}</div>
            <div class="acc-email">${a.email}</div>
            <div class="acc-smtp">${a.smtpHost}:${a.smtpPort} · ${a.smtpUser} · TLS: ${a.useTls ? "Yes" : "No"}</div>
            <div class="acc-actions">
                <button onclick="editAccount('${a.id}')">✏️ Edit</button>
                <button class="del-btn" onclick="deleteAccount('${a.id}')">🗑️</button>
            </div>
        </div>
    `,
    )
    .join("");
}

async function saveAccount() {
  const data = {
    id: document.getElementById("accEditId").value || undefined,
    name: document.getElementById("accName").value.trim(),
    email: document.getElementById("accEmail").value.trim(),
    smtpHost: document.getElementById("accSmtpHost").value.trim(),
    smtpPort: parseInt(document.getElementById("accSmtpPort").value) || 587,
    smtpUser: document.getElementById("accSmtpUser").value.trim(),
    password: document.getElementById("accPassword").value,
    displayName: document.getElementById("accDisplayName").value.trim(),
    useTls: document.getElementById("accTls").value === "true",
  };
  if (!data.email || !data.smtpHost || !data.password) {
    alert("Email, SMTP Host, and Password are required");
    return;
  }
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.success) {
      clearAccountForm();
      loadAccounts();
    } else alert(result.error);
  } catch (err) {
    alert("Error saving account: " + err.message);
  }
}

function editAccount(id) {
  const acc = allAccounts.find((a) => a.id === id);
  if (!acc) return;
  document.getElementById("accEditId").value = acc.id;
  document.getElementById("accName").value = acc.name;
  document.getElementById("accEmail").value = acc.email;
  document.getElementById("accSmtpHost").value = acc.smtpHost;
  document.getElementById("accSmtpPort").value = acc.smtpPort;
  document.getElementById("accSmtpUser").value = acc.smtpUser;
  document.getElementById("accPassword").value = "";
  document.getElementById("accDisplayName").value = acc.displayName || "";
  document.getElementById("accTls").value = acc.useTls ? "true" : "false";
}

async function deleteAccount(id) {
  if (!confirm("Delete this mail account?")) return;
  await fetch(SERVER_URL + "/api/newsletter/accounts/" + id, { method: "DELETE" });
  loadAccounts();
}

function clearAccountForm() {
  [
    "accEditId",
    "accName",
    "accEmail",
    "accSmtpHost",
    "accSmtpUser",
    "accPassword",
    "accDisplayName",
  ].forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("accSmtpPort").value = "587";
  document.getElementById("accTls").value = "true";
}

// ============ ADDRESS BOOK (CONTACTS) ============
async function loadContacts() {
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/contacts");
    allContacts = await res.json();
    loadFolders();
    renderContacts();
  } catch {
    allContacts = [];
    renderContacts();
  }
}

async function loadFolders() {
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/folders");
    const folders = await res.json();
    const sel = document.getElementById("contactFolderFilter");
    const current = sel.value;
    sel.innerHTML =
      '<option value="">All Folders</option>' +
      folders
        .map(
          (f) =>
            `<option value="${f}"${f === current ? " selected" : ""}>${f}</option>`,
        )
        .join("");
    // Update folder suggestions for the form
    const dl = document.getElementById("folderSuggestions");
    if (dl) dl.innerHTML = folders.map((f) => `<option value="${f}">`).join("");
  } catch {}
}

function renderContacts() {
  const search = (
    document.getElementById("contactSearch")?.value || ""
  ).toLowerCase();
  const folder = document.getElementById("contactFolderFilter")?.value || "";
  const countryFilter = (
    document.getElementById("contactCountryFilter")?.value || ""
  ).toLowerCase();
  const discountFilter =
    parseFloat(document.getElementById("contactDiscountFilter")?.value) || 0;

  const filtered = allContacts.filter((c) => {
    // Text Search
    const matchSearch =
      !search ||
      c.email.toLowerCase().includes(search) ||
      (c.companyName || "").toLowerCase().includes(search) ||
      (c.contactName || "").toLowerCase().includes(search) ||
      (c.country || "").toLowerCase().includes(search);

    // Folder Filter
    const matchFolder = !folder || c.folder === folder;

    // Country Filter
    const matchCountry =
      !countryFilter || (c.country || "").toLowerCase().includes(countryFilter);

    // Discount Filter (min discount)
    const cDiscount = parseFloat(c.discount) || 0;
    const matchDiscount = cDiscount >= discountFilter;

    return matchSearch && matchFolder && matchCountry && matchDiscount;
  });

  const body = document.getElementById("contactsBody");
  if (!filtered.length) {
    body.innerHTML =
      '<tr><td colspan="8" class="placeholder-text">No contacts found</td></tr>';
    updateSelectedContactCount();
    return;
  }
  body.innerHTML = filtered
    .map(
      (c) => `
        <tr class="${selectedContactIds.has(c.id) ? "selected-row" : ""}">
            <td><input type="checkbox" data-contact-id="${c.id}" ${selectedContactIds.has(c.id) ? "checked" : ""} onchange="toggleContactSelection('${c.id}', this.checked)"></td>
            <td>${c.email}</td>
            <td>${c.contactName || "—"}</td>
            <td>${c.companyName || "—"}</td>
            <td>${c.discount ? `<span class="ct-discount">${c.discount}</span>` : "—"}</td>
            <td>${c.country || "—"}</td>
            <td><span class="ct-folder">${c.folder || "General"}</span></td>
            <td><div class="action-btns">
                <button onclick="editContact('${c.id}')">✏️</button>
                <button class="del-btn" onclick="deleteContact('${c.id}')">🗑️</button>
            </div></td>
        </tr>
    `,
    )
    .join("");
  updateSelectedContactCount();
}

function toggleContactSelection(id, checked) {
  if (checked) selectedContactIds.add(id);
  else selectedContactIds.delete(id);
  renderContacts();
}
function toggleAllContactCheckboxes(master) {
  const checkboxes = document.querySelectorAll(
    '#contactsBody input[type="checkbox"]',
  );
  checkboxes.forEach((cb) => {
    const id = cb.dataset.contactId;
    if (master.checked) selectedContactIds.add(id);
    else selectedContactIds.delete(id);
  });
  renderContacts();
}
function selectAllContacts() {
  const search = (
    document.getElementById("contactSearch")?.value || ""
  ).toLowerCase();
  const folder = document.getElementById("contactFolderFilter")?.value || "";
  allContacts
    .filter((c) => {
      const ms =
        !search ||
        c.email.toLowerCase().includes(search) ||
        (c.companyName || "").toLowerCase().includes(search) ||
        (c.contactName || "").toLowerCase().includes(search);
      return ms && (!folder || c.folder === folder);
    })
    .forEach((c) => selectedContactIds.add(c.id));
  renderContacts();
}
function deselectAllContacts() {
  selectedContactIds.clear();
  renderContacts();
}
function updateSelectedContactCount() {
  const el = document.getElementById("selectedContactCount");
  if (el) el.textContent = selectedContactIds.size;
}

// Contact search listener
document
  .getElementById("contactSearch")
  ?.addEventListener("input", () => renderContacts());

// Contact form
function showAddContactForm() {
  document.getElementById("contactFormPanel").style.display = "block";
  clearContactForm();
}
function hideContactForm() {
  document.getElementById("contactFormPanel").style.display = "none";
  clearContactForm();
}
function clearContactForm() {
  [
    "contactEditId",
    "ctEmail",
    "ctName",
    "ctCompany",
    "ctDiscount",
    "ctCountry",
    "ctFolder",
    "ctNotes",
  ].forEach((id) => (document.getElementById(id).value = ""));
}

async function saveContact() {
  const data = {
    id: document.getElementById("contactEditId").value || undefined,
    email: document.getElementById("ctEmail").value.trim(),
    contactName: document.getElementById("ctName").value.trim(),
    companyName: document.getElementById("ctCompany").value.trim(),
    discount: document.getElementById("ctDiscount").value.trim(),
    country: document.getElementById("ctCountry").value.trim(),
    folder: document.getElementById("ctFolder").value.trim() || "General",
    notes: document.getElementById("ctNotes").value.trim(),
  };
  if (!data.email) {
    alert("Email is required");
    return;
  }
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.success) {
      hideContactForm();
      loadContacts();
    } else alert(result.error);
  } catch (err) {
    alert("Error saving contact: " + err.message);
  }
}

function editContact(id) {
  const c = allContacts.find((x) => x.id === id);
  if (!c) return;
  showAddContactForm();
  document.getElementById("contactEditId").value = c.id;
  document.getElementById("ctEmail").value = c.email;
  document.getElementById("ctName").value = c.contactName || "";
  document.getElementById("ctCompany").value = c.companyName || "";
  document.getElementById("ctDiscount").value = c.discount || "";
  document.getElementById("ctCountry").value = c.country || "";
  document.getElementById("ctFolder").value = c.folder || "General";
  document.getElementById("ctNotes").value = c.notes || "";
}

async function deleteContact(id) {
  if (!confirm("Delete this contact?")) return;
  selectedContactIds.delete(id);
  await fetch(SERVER_URL + "/api/newsletter/contacts/" + id, { method: "DELETE" });
  loadContacts();
}

function importContactsFile() {
  const input = document.getElementById("contactFileInput");
  input.click();
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => bulkImportContacts(r.data),
      });
    } else if (ext === "xls" || ext === "xlsx") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const wb = XLSX.read(new Uint8Array(ev.target.result), {
          type: "array",
        });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        bulkImportContacts(data);
      };
      reader.readAsArrayBuffer(file);
    }
    input.value = "";
  };
}

async function bulkImportContacts(rows) {
  // Auto-map columns
  const mapKey = (row, keys) => {
    for (const k of keys) {
      if (row[k] !== undefined) return String(row[k]).trim();
    }
    return "";
  };
  const contacts = rows
    .map((r) => ({
      email: mapKey(r, [
        "email",
        "Email",
        "EMAIL",
        "e-mail",
        "E-Mail",
        "mail",
        "Mail",
      ]),
      contactName: mapKey(r, [
        "contactName",
        "name",
        "Name",
        "contact",
        "Contact",
        "imie",
        "Imię",
        "Imie",
      ]),
      companyName: mapKey(r, [
        "companyName",
        "company",
        "Company",
        "firma",
        "Firma",
        "company_name",
      ]),
      discount: mapKey(r, ["discount", "Discount", "rabat", "Rabat"]),
      country: mapKey(r, ["country", "Country", "kraj", "Kraj"]),
      folder: mapKey(r, [
        "folder",
        "Folder",
        "katalog",
        "Katalog",
        "group",
        "Group",
        "grupa",
        "Grupa",
      ]),
      notes: mapKey(r, ["notes", "Notes", "uwagi", "Uwagi"]),
    }))
    .filter((c) => c.email && c.email.includes("@"));

  if (!contacts.length) {
    alert("No valid emails found in the file");
    return;
  }
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/contacts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    });
    const result = await res.json();
    alert(`Imported: ${result.added} new contacts (${result.total} total)`);
    loadContacts();
  } catch (err) {
    alert("Import error: " + err.message);
  }
}

// ============ SEND ============
// ============ SEND ============
async function loadAccountsForSend() {
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/accounts/full");
    if (!res.ok)
      throw new Error(`Server returned ${res.status} ${res.statusText}`);

    allAccountsFull = await res.json();

    const sel = document.getElementById("sendFromAccount");
    const current = sel.value;
    const info = document.getElementById("sendAccountInfo");

    if (allAccountsFull.length === 0) {
      sel.innerHTML =
        '<option value="">— No accounts found (add in Mail Accounts) —</option>';
      if (info) info.innerHTML = "";
      return;
    }

    sel.innerHTML =
      '<option value="">— Select saved account —</option>' +
      allAccountsFull
        .map(
          (a) =>
            `<option value="${a.id}"${a.id === current ? " selected" : ""}>${a.name} (${a.email})</option>`,
        )
        .join("");

    // Trigger change to update info box if value selected
    if (current) onSendAccountChange();
  } catch (err) {
    console.error("Error loading accounts for send:", err);
    const sel = document.getElementById("sendFromAccount");
    sel.innerHTML = `<option value="">Error: ${err.message}</option>`;
    // Optional: alert('Failed to load accounts for sending: ' + err.message);
  }
}

function onSendAccountChange() {
  const id = document.getElementById("sendFromAccount").value;
  const info = document.getElementById("sendAccountInfo");
  const acc = allAccountsFull.find((a) => a.id === id);
  if (acc) {
    info.innerHTML = `<strong>${acc.email}</strong> via ${acc.smtpHost}:${acc.smtpPort} · Display: ${acc.displayName || acc.name}`;
  } else {
    info.innerHTML = "";
  }
}

function updateSendRecipientSummary() {
  const el = document.getElementById("sendRecipientSummary");
  const selectedEmails = allContacts.filter((c) =>
    selectedContactIds.has(c.id),
  );
  if (!selectedEmails.length) {
    el.innerHTML =
      '<p class="help-text">No contacts selected. Go to Address Book tab to select recipients.</p>';
    return;
  }
  // Group by folder
  const byFolder = {};
  selectedEmails.forEach((c) => {
    const f = c.folder || "General";
    if (!byFolder[f]) byFolder[f] = [];
    byFolder[f].push(c);
  });
  el.innerHTML =
    Object.entries(byFolder)
      .map(
        ([folder, contacts]) =>
          `<div class="recipient-badge"><span class="badge-count">${contacts.length}</span> ${folder}</div>`,
      )
      .join("") +
    `<div class="recipient-badge" style="border-color:#c9a84c55;"><span class="badge-count" style="background:#4caf5022;color:#4caf50;">${selectedEmails.length}</span> Total selected</div>`;
}

async function sendTestEmail() {
  const accId = document.getElementById("sendFromAccount").value;
  const acc = allAccountsFull.find((a) => a.id === accId);
  if (!acc) {
    alert("Select a mail account first");
    return;
  }
  await sendEmails([acc.email], true, acc);
}

async function sendAllEmails() {
  const accId = document.getElementById("sendFromAccount").value;
  const acc = allAccountsFull.find((a) => a.id === accId);
  if (!acc) {
    alert("Select a mail account first");
    return;
  }

  // Collect emails from selected contacts + manual
  const contactEmails = allContacts
    .filter((c) => selectedContactIds.has(c.id))
    .map((c) => c.email);
  const manualText = document.getElementById("manualRecipients")?.value || "";
  const manualEmails = manualText
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
  const allEmails = [...new Set([...contactEmails, ...manualEmails])];

  if (!allEmails.length) {
    alert("No recipients. Select contacts or add manual emails.");
    return;
  }
  if (!confirm(`Send newsletter to ${allEmails.length} recipients?`)) return;
  await sendEmails(allEmails, false, acc);
}

async function sendEmails(emails, isTest, acc) {
  const smtp = {
    host: acc.smtpHost,
    port: acc.smtpPort,
    user: acc.smtpUser,
    pass: acc.password,
  };
  const from = acc.email;
  const fromName = acc.displayName || acc.name;
  const subject = document.getElementById("emailSubject").value;

  if (!generatedHTML) {
    alert("Generate newsletter first (Step 4)");
    return;
  }

  const prog = document.getElementById("sendProgress");
  const fill = document.getElementById("progressFill");
  const text = document.getElementById("progressText");
  const log = document.getElementById("sendLog");
  prog.style.display = "block";
  log.innerHTML = "";

  let ok = 0,
    fail = 0;
  const jobResults = [];

  for (let i = 0; i < emails.length; i++) {
    const pct = Math.round(((i + 1) / emails.length) * 100);
    fill.style.width = pct + "%";
    text.textContent = `Sending ${i + 1}/${emails.length}...`;
    try {
      const res = await fetch(SERVER_URL + "/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp,
          from,
          fromName,
          to: emails[i],
          subject,
          html: generatedHTML,
        }),
      });
      const data = await res.json();
      if (data.success) {
        ok++;
        log.innerHTML += `<div class="log-item success">✓ ${emails[i]}</div>`;
        jobResults.push({ to: emails[i], ok: true, messageId: data.messageId });
      } else {
        fail++;
        log.innerHTML += `<div class="log-item error">✗ ${emails[i]}: ${data.error}</div>`;
        jobResults.push({ to: emails[i], ok: false, error: data.error });
      }
    } catch (err) {
      fail++;
      log.innerHTML += `<div class="log-item error">✗ ${emails[i]}: ${err.message}</div>`;
      jobResults.push({ to: emails[i], ok: false, error: err.message });
    }
  }
  text.textContent = isTest
    ? `Test complete: ${ok ? "✅ Sent!" : "❌ Failed"}`
    : `Done! ✅ ${ok} sent, ${fail ? "❌ " + fail + " failed" : "all successful"}`;

  if (!isTest) {
    // Save to History using the server API
    try {
      const jobData = {
        name: "Immediate Send: " + subject,
        accountId: acc.id,
        subject,
        html: generatedHTML,
        recipients: emails,
        scheduledAt: new Date().toISOString(),
        status: fail === 0 ? "sent" : ok > 0 ? "partial" : "failed",
        sentAt: new Date().toISOString(),
        results: jobResults,
        config: {
          template:
            document.querySelector('input[name="template"]:checked')?.value ||
            "grid",
          header: document.getElementById("cfgHeader")?.value,
          subtitle: document.getElementById("cfgSubtitle")?.value,
          logo: document.getElementById("cfgLogo")?.value,
          footer: document.getElementById("cfgFooter")?.value,
          color: document.getElementById("cfgColorHex")?.value,
          btnColor: document.getElementById("cfgBtnColorHex")?.value,
        },
      };

      await fetch(SERVER_URL + "/api/newsletter/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      });
      console.log("Saved to history");
      loadHistoryJobs(); // Refresh history if open
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  }
}

// ============ EMAIL SCHEDULING ============

async function scheduleEmail() {
  const accountSel = document.getElementById("sendFromAccount");
  const accountId = accountSel.value;
  if (!accountId) {
    alert("Select a sending account first");
    return;
  }

  if (!generatedHTML) {
    alert("Generate newsletter first (Step 4)");
    return;
  }

  const subject = document.getElementById("emailSubject").value;
  if (!subject) {
    alert("Enter a subject line");
    return;
  }

  // Gather selected + manual recipients
  const emails = getSelectedAndManualEmails();
  if (!emails.length) {
    alert("No recipients selected or entered");
    return;
  }

  const schedDT = document.getElementById("schedDateTime").value;
  if (!schedDT) {
    alert("Pick a date and time for sending");
    return;
  }

  const scheduledAt = new Date(schedDT).toISOString();
  const jobName = document.getElementById("schedJobName").value || subject;

  if (new Date(scheduledAt) <= new Date()) {
    if (
      !confirm(
        "The selected time is in the past. The email will be sent within the next minute. Continue?",
      )
    )
      return;
  }

  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: jobName,
        accountId,
        subject,
        html: generatedHTML,
        recipients: emails,
        scheduledAt,
      }),
    });
    const data = await res.json();
    if (data.success) {
      alert(
        `✅ Scheduled! "${jobName}" will be sent at ${new Date(scheduledAt).toLocaleString()} to ${emails.length} recipient(s).`,
      );
      document.getElementById("schedJobName").value = "";
      document.getElementById("schedDateTime").value = "";
      switchSendTab("scheduled");
    } else {
      alert("❌ Failed to schedule: " + data.error);
    }
  } catch (err) {
    alert("Error scheduling: " + err.message);
  }
}

// Helper: get all emails from selected contacts + manual textarea
function getSelectedAndManualEmails() {
  const emails = [];
  // Selected contacts
  if (allContacts && selectedContactIds.size > 0) {
    allContacts.forEach((c) => {
      if (selectedContactIds.has(c.id) && c.email) emails.push(c.email);
    });
  }
  // Manual recipients
  const manual = (document.getElementById("manualRecipients")?.value || "")
    .split("\n")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));
  manual.forEach((e) => {
    if (!emails.includes(e)) emails.push(e);
  });
  return emails;
}

// ============ MASOWY MAILING POLSKA ============
let pendingMassMailingJobs = [];

async function scheduleMassMailingPoland() {
  if (!generatedHTML) {
    alert("Wygeneruj newsletter w kroku 4 (Design).");
    return;
  }

  const subject = document.getElementById("emailSubject").value;
  if (!subject) {
    alert("Wpisz temat wiadomości.");
    return;
  }

  // Ensure data is loaded
  try {
    if (!allAccountsFull || !allAccountsFull.length) {
      const accRes = await fetch(SERVER_URL + "/api/newsletter/accounts/full");
      allAccountsFull = await accRes.json();
    }
    if (!allContacts || !allContacts.length) {
      const cRes = await fetch(SERVER_URL + "/api/newsletter/contacts");
      allContacts = await cRes.json();
    }
  } catch (e) {
    console.error("Błąd ładowania danych", e);
  }

  if (!allAccountsFull || allAccountsFull.length === 0) {
    alert(
      "Brak skofigurowanych kont mailowych. Dodaj konta newsletter1..9@gedeonpolska.com w zakładce Mail Accounts.",
    );
    return;
  }

  if (!allContacts || allContacts.length === 0) {
    alert("Brak kontaktów. Zaimportuj książkę adresową z podziałem na grupy.");
    return;
  }

  pendingMassMailingJobs = [];
  const tbody = document.getElementById("massMailingSummaryBody");
  tbody.innerHTML = "";

  let hasMatches = false;

  for (let i = 1; i <= 9; i++) {
    const folderName = `Polska${i}`;
    const accountEmail = `newsletter${i}@gedeonpolska.com`;

    // Find the specific sending account
    const account = allAccountsFull.find(
      (a) => a.email.toLowerCase() === accountEmail.toLowerCase(),
    );

    // Find contacts in this logical folder
    const folderContacts = allContacts
      .filter((c) => c.folder === folderName)
      .map((c) => c.email);

    const hasAccount = !!account;
    const count = folderContacts.length;

    if (hasAccount && count > 0) {
      pendingMassMailingJobs.push({
        folderName,
        account,
        folderContacts,
        accountEmail,
        subject,
      });
      hasMatches = true;

      tbody.innerHTML += `<tr>
                <td><span class="ct-folder">${folderName}</span></td>
                <td>${accountEmail}</td>
                <td style="color:#4caf50;font-weight:bold;">${count}</td>
            </tr>`;
    } else {
      tbody.innerHTML += `<tr>
                <td><span class="ct-folder">${folderName}</span></td>
                <td style="color:${hasAccount ? "#aaa" : "#f44336"}">${hasAccount ? accountEmail : "Brak konta!"}</td>
                <td style="color:${count > 0 ? "#4caf50" : "#888"}">${count}</td>
            </tr>`;
    }
  }

  if (!hasMatches) {
    alert(
      "Nie dopasowano żadnych wysyłek. Upewnij się, że masz zapisane konta newsletter1..9@gedeonpolska.com oraz dodane kontakty w folderach przypisanych dla poszczególnych kont (Polska1..9).",
    );
    return;
  }

  // Show Modal
  document.getElementById("massMailingModal").style.display = "flex";
}

function closeMassMailingModal() {
  document.getElementById("massMailingModal").style.display = "none";
}

async function confirmMassMailingPoland() {
  closeMassMailingModal();
  let scheduledCount = 0;

  for (let i = 0; i < pendingMassMailingJobs.length; i++) {
    const job = pendingMassMailingJobs[i];

    const scheduledAt = new Date(Date.now() + (i + 1) * 2000).toISOString();
    const jobName = `[Auto] Masowy Mailing - ${job.folderName} (${job.folderContacts.length} odbiorców)`;

    try {
      const res = await fetch(SERVER_URL + "/api/newsletter/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: jobName,
          accountId: job.account.id,
          subject: job.subject,
          html: generatedHTML,
          recipients: job.folderContacts,
          scheduledAt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        console.log(
          `✅ Zaplanowano dla ${job.folderName} z konta ${job.accountEmail} (${job.folderContacts.length} odbiorców).`,
        );
        scheduledCount++;
      } else {
        console.error(
          `❌ Błąd zapisu do harmonogramu dla ${job.folderName}: `,
          data.error,
        );
      }
    } catch (err) {
      console.error(`Błąd przy planowaniu ${job.folderName}: ${err.message}`);
    }
  }

  if (scheduledCount > 0) {
    alert(
      `Uruchomiono wysyłkę dla ${scheduledCount} grup z paczki Polska1-Polska9. System powoli w tle roześle wiadomości. Przejdź do zakładki "Scheduled".`,
    );
    navigateTo("panelScheduled");
  }
}

async function loadScheduledJobs() {
  const container = document.getElementById("scheduledList");
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/scheduled");
    const jobs = await res.json();
    if (!jobs.length) {
      container.innerHTML =
        '<p class="placeholder-text">No scheduled emails yet — use the Send tab to schedule a newsletter.</p>';
      return;
    }
    // Sort: pending first, then by scheduledAt desc
    jobs.sort((a, b) => {
      const order = { pending: 0, sending: 1, partial: 2, sent: 3, failed: 4 };
      if ((order[a.status] || 0) !== (order[b.status] || 0))
        return (order[a.status] || 0) - (order[b.status] || 0);
      return new Date(b.scheduledAt) - new Date(a.scheduledAt);
    });

    let html = "";
    jobs.forEach((job) => {
      const dt = new Date(job.scheduledAt);
      const dtStr = dt.toLocaleString();
      const statusClass = `sched-status-${job.status}`;
      const statusLabel =
        job.status.charAt(0).toUpperCase() + job.status.slice(1);
      const sentInfo = job.sentAt
        ? `<span class="sched-meta">Sent: ${new Date(job.sentAt).toLocaleString()}</span>`
        : "";
      const resultsSummary = job.results?.length
        ? (() => {
            const ok = job.results.filter((r) => r.ok).length;
            const fail = job.results.length - ok;
            return `<span class="sched-meta">${ok} sent${fail ? `, ${fail} failed` : ""}</span>`;
          })()
        : "";

      const canCancel = job.status === "pending";
      const canSendNow = job.status === "pending";

      html += `<div class="sched-card">
                <div class="sched-card-header">
                    <div>
                        <strong>${escapeHtml(job.name)}</strong>
                        <span class="sched-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="sched-actions">
                        ${canSendNow ? `<button class="btn btn-sm btn-primary" onclick="sendScheduledNow('${job.id}')">🚀 Send Now</button>` : ""}
                        ${canCancel ? `<button class="btn btn-sm btn-ghost" onclick="cancelScheduledJob('${job.id}')">🗑️ Cancel</button>` : ""}
                    </div>
                </div>
                <div class="sched-card-body">
                    <span class="sched-meta">📅 ${dtStr}</span>
                    <span class="sched-meta">📧 ${job.recipients.length} recipient(s)</span>
                    <span class="sched-meta">📝 ${escapeHtml(job.subject)}</span>
                    ${sentInfo}
                    ${resultsSummary}
                </div>
            </div>`;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="placeholder-text">Error loading: ${err.message}</p>`;
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function cancelScheduledJob(id) {
  if (!confirm("Cancel this scheduled email?")) return;
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/scheduled/" + id, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) loadScheduledJobs();
    else alert("Error: " + data.error);
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function sendScheduledNow(id) {
  if (!confirm("Send this email immediately?")) return;
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/scheduled/" + id + "/send-now", {
      method: "POST",
    });
    const data = await res.json();
    if (data.success) {
      alert(
        `✅ Sending complete! ${data.job.results?.filter((r) => r.ok).length || 0}/${data.job.recipients.length} sent.`,
      );
      loadScheduledJobs();
    } else alert("Error: " + data.error);
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function loadHistoryJobs() {
  const container = document.getElementById("historyList");
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/scheduled");
    const jobs = await res.json();

    // Filter for completed jobs
    const history = jobs.filter(
      (j) => j.status !== "pending" && j.status !== "sending",
    );

    if (!history.length) {
      container.innerHTML =
        '<p class="placeholder-text">No sent history yet.</p>';
      return;
    }

    // Sort by sentAt desc
    history.sort(
      (a, b) =>
        new Date(b.sentAt || b.createdAt) - new Date(a.sentAt || a.createdAt),
    );

    let html = "";
    history.forEach((job) => {
      const dt = new Date(job.sentAt || job.createdAt);
      const dtStr = dt.toLocaleString();
      const statusClass = `sched-status-${job.status}`;
      const statusLabel =
        job.status.charAt(0).toUpperCase() + job.status.slice(1);

      // Calculate success rate
      const okCount = job.results?.filter((r) => r.ok).length || 0;
      const total = job.recipients.length;
      const rate = total > 0 ? Math.round((okCount / total) * 100) : 0;

      html += `<div class="sched-card">
                <div class="sched-card-header">
                    <div>
                        <strong>${escapeHtml(job.name)}</strong>
                        <span class="sched-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="sched-actions">
                         <span class="sched-meta" style="font-size:1.1em;font-weight:bold;color:${rate === 100 ? "#4caf50" : "#f44336"}">${rate}% Success</span>
                         <button class="btn btn-sm btn-secondary" onclick="restoreHistoryJob('${job.id || job.createdAt}')" style="margin-left:10px;">Load / Edit</button>
                    </div>
                </div>
                <div class="sched-card-body">
                    <span class="sched-meta">📨 Sent: ${dtStr}</span>
                    <span class="sched-meta">👥 ${total} recipient(s)</span>
                    <span class="sched-meta">📝 ${escapeHtml(job.subject)}</span>
                </div>
            </div>`;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="placeholder-text">Error loading history: ${err.message}</p>`;
  }
}

async function restoreHistoryJob(jobId) {
  try {
    const res = await fetch(SERVER_URL + "/api/newsletter/scheduled");
    const jobs = await res.json();
    const job = jobs.find((j) => (j.id || j.createdAt) == jobId);

    if (!job) {
      alert("Job not found!");
      return;
    }

    const confirm = window.confirm(
      `Load "${job.name}" into the editor? This will overwrite your current design.`,
    );
    if (!confirm) return;

    // Restore content
    generatedHTML = job.html;

    // Restore config if available (legacy jobs might not have it)
    if (job.config) {
      document.querySelector(
        `input[name="template"][value="${job.config.template}"]`,
      ).checked = true;
      document.getElementById("cfgHeader").value = job.config.header || "";
      document.getElementById("cfgSubtitle").value = job.config.subtitle || "";
      document.getElementById("cfgLogo").value = job.config.logo || "";
      document.getElementById("cfgFooter").value = job.config.footer || "";
      document.getElementById("cfgColorHex").value =
        job.config.color || "#1a1a2e";
      document.getElementById("cfgColor").value = job.config.color || "#1a1a2e";
      document.getElementById("cfgBtnColorHex").value =
        job.config.btnColor || "#c9a84c";
      document.getElementById("cfgBtnColor").value =
        job.config.btnColor || "#c9a84c";
    }

    // Navigate to Design Step
    navigateTo("step4");

    // Render Preview
    const vis = document.getElementById("previewVisual");
    vis.innerHTML = `
            <div class="preview-edit-controls">
                <button onclick="toggleEditMode()" id="editModeBtn">✏️ Enable Editing</button>
                <button onclick="addTextBlock()" id="addTextBtn" style="display:none;">+ Add Text Block</button>
                <button onclick="savePreviewChanges()" id="saveChangesBtn" style="display:none;">💾 Save Changes</button>
                <span class="edit-status" id="editStatus"></span>
            </div>
        `;
    const frame = document.createElement("iframe");
    frame.id = "newsletterPreviewFrame";
    frame.style.cssText =
      "width:100%;min-height:600px;border:none;background:#fff;border-radius:0 0 8px 8px;";
    vis.appendChild(frame);
    previewIframe = frame;
    frame.contentDocument.open();
    frame.contentDocument.write(generatedHTML);
    frame.contentDocument.close();

    // Update code view
    document.getElementById("htmlCodeArea").value = generatedHTML;

    // Enable buttons
    document.getElementById("copyBtn").disabled = false;
    document.getElementById("dlBtn").disabled = false;
    document.getElementById("toSendBtn").disabled = false;
  } catch (err) {
    alert("Failed to restore job: " + err.message);
  }
}

// ============================================================
// TRANSLATE TO ENGLISH
// ============================================================
async function translateContent() {
  // Get the iframe content or generatedHTML
  let html = "";
  const iframe = document.getElementById("newsletterPreviewFrame");
  if (iframe && iframe.contentDocument) {
    html = iframe.contentDocument.body
      ? iframe.contentDocument.body.innerHTML
      : iframe.contentDocument.documentElement.outerHTML;
  } else if (generatedHTML) {
    html = generatedHTML;
  } else {
    alert("Please generate a newsletter preview first before translating.");
    return;
  }

  const lmUrl =
    (document.getElementById("cfgLmStudioUrl") &&
      document.getElementById("cfgLmStudioUrl").value.trim()) ||
    "http://localhost:1234/v1";

  const btn = document.querySelector(
    'button[onclick="translateContent()"]'
  );
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Translating…";
  }

  try {
    const resp = await fetch(SERVER_URL + "/api/newsletter/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: html, baseUrl: lmUrl }),
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || "Unknown error");

    // Replace inner HTML with translated version
    const translatedHtml = data.translation;

    if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
      iframe.contentDocument.body.innerHTML = translatedHtml;
      // Also update generatedHTML so copy/download work
      generatedHTML = iframe.contentDocument.documentElement.outerHTML;
    } else {
      // Rebuild full doc if we only have the HTML string
      generatedHTML = translatedHtml;
      const vis = document.getElementById("previewVisual");
      if (vis) {
        const frame = document.createElement("iframe");
        frame.id = "newsletterPreviewFrame";
        frame.style.cssText =
          "width:100%;min-height:600px;border:none;background:#fff;border-radius:0 0 8px 8px;";
        vis.innerHTML = "";
        vis.appendChild(frame);
        previewIframe = frame;
        frame.contentDocument.open();
        frame.contentDocument.write(generatedHTML);
        frame.contentDocument.close();
      }
    }
    document.getElementById("htmlCodeArea").value = generatedHTML;
    alert("✅ Translation complete!");
  } catch (err) {
    alert(
      "❌ Translation failed: " +
        err.message +
        "\n\nMake sure LM Studio is running at: " +
        lmUrl
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🌐 Translate to English";
    }
  }
}

// ============================================================
// EMAIL BUILDER — Drag & Drop Block System
// ============================================================
const EB_TEMPLATES_KEY = "eb_email_templates";

let ebBlocks = []; // array of { id, type, data }
let ebDragSrcIdx = null;
let ebDragOverIdx = null;

function ebGenId() {
  return "blk_" + Math.random().toString(36).slice(2, 9);
}

// Default data per block type
function ebDefaultData(type) {
  switch (type) {
    case "header":
      return { text: "Your Newsletter Header", level: "h1", align: "center", color: "#1a1a2e", bgColor: "#f5f5f5" };
    case "text":
      return { text: "Write your paragraph here. Click to edit.", align: "left", color: "#333333", fontSize: "16px" };
    case "image":
      return { url: "", alt: "Image", width: "100%", align: "center", link: "" };
    case "button":
      return { label: "Shop Now", url: "#", bgColor: "#c9a84c", color: "#ffffff", align: "center", radius: "6px" };
    case "spacer":
      return { height: "30" };
    case "divider":
      return { color: "#e0e0e0", thickness: "1" };
    case "columns":
      return {
        left: "Left column content",
        right: "Right column content",
        leftWidth: "50",
        gap: "20",
      };
    case "html":
      return { code: "<!-- Custom HTML -->" };
    case "product":
      return { productIdx: "0", showImage: true, showPrice: true, showDescription: true, showButton: true, buttonLabel: "View Product", bgColor: "#ffffff" };
    default:
      return {};
  }
}

// ---- Render block list ----
function ebRender() {
  const canvas = document.getElementById("ebCanvas");
  if (!canvas) return;
  if (ebBlocks.length === 0) {
    canvas.innerHTML = `
      <div style="padding:60px 20px;text-align:center;color:#888;border:2px dashed #333;border-radius:10px;margin:10px;">
        <div style="font-size:2.5rem;margin-bottom:10px;">📦</div>
        <p style="font-size:1rem;">Drag blocks from the panel on the left, or click the <b>+</b> buttons below to add them.</p>
      </div>`;
    return;
  }

  canvas.innerHTML = ebBlocks
    .map((blk, i) => ebRenderBlockItem(blk, i))
    .join("");

  // Attach drag events
  canvas.querySelectorAll(".eb-block-item").forEach((el) => {
    const idx = parseInt(el.dataset.idx);
    el.addEventListener("dragstart", (e) => {
      ebDragSrcIdx = idx;
      el.style.opacity = "0.5";
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", () => {
      el.style.opacity = "";
      ebDragSrcIdx = null;
      canvas.querySelectorAll(".eb-block-item").forEach((b) => b.classList.remove("drag-over"));
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      canvas.querySelectorAll(".eb-block-item").forEach((b) => b.classList.remove("drag-over"));
      el.classList.add("drag-over");
      ebDragOverIdx = idx;
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      if (ebDragSrcIdx !== null && ebDragSrcIdx !== ebDragOverIdx) {
        const moved = ebBlocks.splice(ebDragSrcIdx, 1)[0];
        ebBlocks.splice(ebDragOverIdx, 0, moved);
        ebRender();
        ebUpdatePreview();
      }
    });
  });

  // Attach edit input listeners
  ebAttachEditors();
}

function ebRenderBlockItem(blk, i) {
  const icon = { header: "🔤", text: "¶", image: "🖼️", button: "🔘", spacer: "↕️", divider: "─", columns: "⬛⬛", html: "</>", product: "🛍️"}[blk.type] || "📦";
  const preview = ebBlockPreviewHTML(blk);
  return `
    <div class="eb-block-item" data-idx="${i}" data-id="${blk.id}" draggable="true">
      <div class="eb-block-header">
        <span class="eb-block-drag-handle">⠿</span>
        <span class="eb-block-type-label">${icon} ${blk.type.charAt(0).toUpperCase() + blk.type.slice(1)}</span>
        <div class="eb-block-actions">
          <button onclick="ebMoveBlock(${i},-1)" title="Move Up" ${i === 0 ? "disabled" : ""}>▲</button>
          <button onclick="ebMoveBlock(${i},1)" title="Move Down" ${i === ebBlocks.length - 1 ? "disabled" : ""}>▼</button>
          <button onclick="ebDuplicateBlock(${i})" title="Duplicate">⧉</button>
          <button onclick="ebDeleteBlock(${i})" title="Delete" style="color:#ff6b6b;">✕</button>
        </div>
      </div>
      <div class="eb-block-editor">
        ${ebBlockEditor(blk, i)}
      </div>
    </div>`;
}

function ebBlockPreviewHTML(blk) {
  // Small in-canvas preview text
  switch (blk.type) {
    case "header": return `<b>${blk.data.text.slice(0, 50)}</b>`;
    case "text": return blk.data.text.slice(0, 80);
    case "image": return blk.data.url ? `<img src="${blk.data.url}" style="max-height:40px;">` : "(no image)";
    case "button": return `[${blk.data.label}]`;
    case "spacer": return `spacer ${blk.data.height}px`;
    case "divider": return `─── divider ───`;
    case "columns": return "[ col | col ]";
    case "html": return blk.data.code.slice(0, 60);
    case "product": {
      const pidx = parseInt(blk.data.productIdx) || 0;
      const pid = selectedProductsOrder[pidx];
      const p = mappedProducts.find(prod => prod.id === pid);
      return p ? `🛍️ ${p.name.slice(0, 50)}` : "(no product selected)";
    }
    default: return "";
  }
}

function ebBlockEditor(blk, i) {
  const d = blk.data;
  switch (blk.type) {
    case "header":
      return `
        <div class="eb-field-row">
          <label>Text</label><input type="text" class="eb-input" data-field="text" data-idx="${i}" value="${escAttr(d.text)}">
        </div>
        <div class="eb-field-row">
          <label>Level</label>
          <select class="eb-input" data-field="level" data-idx="${i}">
            <option ${d.level==="h1"?"selected":""}>h1</option>
            <option ${d.level==="h2"?"selected":""}>h2</option>
            <option ${d.level==="h3"?"selected":""}>h3</option>
          </select>
          <label>Align</label>
          <select class="eb-input" data-field="align" data-idx="${i}">
            <option ${d.align==="left"?"selected":""}>left</option>
            <option ${d.align==="center"?"selected":""}>center</option>
            <option ${d.align==="right"?"selected":""}>right</option>
          </select>
        </div>
        <div class="eb-field-row">
          <label>Text Color</label><input type="color" class="eb-input" data-field="color" data-idx="${i}" value="${d.color||"#1a1a2e"}">
          <label>BG Color</label><input type="color" class="eb-input" data-field="bgColor" data-idx="${i}" value="${d.bgColor||"#f5f5f5"}">
        </div>`;

    case "text":
      return `
        <div class="eb-field-row">
          <label>Content</label><textarea class="eb-input" rows="3" data-field="text" data-idx="${i}">${escAttr(d.text)}</textarea>
        </div>
        <div class="eb-field-row">
          <label>Align</label>
          <select class="eb-input" data-field="align" data-idx="${i}">
            <option ${d.align==="left"?"selected":""}>left</option>
            <option ${d.align==="center"?"selected":""}>center</option>
            <option ${d.align==="right"?"selected":""}>right</option>
          </select>
          <label>Color</label><input type="color" class="eb-input" data-field="color" data-idx="${i}" value="${d.color||"#333"}">
          <label>Size</label><input type="text" class="eb-input" style="width:60px;" data-field="fontSize" data-idx="${i}" value="${d.fontSize||"16px"}">
        </div>`;

    case "image":
      return `
        <div class="eb-field-row">
          <label>Image URL</label><input type="text" class="eb-input" data-field="url" data-idx="${i}" placeholder="https://..." value="${escAttr(d.url)}">
        </div>
        <div class="eb-field-row">
          <label>Alt text</label><input type="text" class="eb-input" data-field="alt" data-idx="${i}" value="${escAttr(d.alt)}">
          <label>Width</label><input type="text" class="eb-input" style="width:70px;" data-field="width" data-idx="${i}" value="${escAttr(d.width)}">
        </div>
        <div class="eb-field-row">
          <label>Link URL</label><input type="text" class="eb-input" data-field="link" data-idx="${i}" placeholder="https://..." value="${escAttr(d.link)}">
          <label>Align</label>
          <select class="eb-input" data-field="align" data-idx="${i}">
            <option ${d.align==="left"?"selected":""}>left</option>
            <option ${d.align==="center"?"selected":""}>center</option>
            <option ${d.align==="right"?"selected":""}>right</option>
          </select>
        </div>
        ${d.url ? `<div style="margin-top:6px;"><img src="${d.url}" style="max-width:100%;max-height:80px;border-radius:4px;"></div>` : ""}`;

    case "button":
      return `
        <div class="eb-field-row">
          <label>Label</label><input type="text" class="eb-input" data-field="label" data-idx="${i}" value="${escAttr(d.label)}">
          <label>URL</label><input type="text" class="eb-input" data-field="url" data-idx="${i}" value="${escAttr(d.url)}">
        </div>
        <div class="eb-field-row">
          <label>BG</label><input type="color" class="eb-input" data-field="bgColor" data-idx="${i}" value="${d.bgColor||"#c9a84c"}">
          <label>Text</label><input type="color" class="eb-input" data-field="color" data-idx="${i}" value="${d.color||"#ffffff"}">
          <label>Align</label>
          <select class="eb-input" data-field="align" data-idx="${i}">
            <option ${d.align==="left"?"selected":""}>left</option>
            <option ${d.align==="center"?"selected":""}>center</option>
            <option ${d.align==="right"?"selected":""}>right</option>
          </select>
          <label>Radius</label><input type="text" class="eb-input" style="width:55px;" data-field="radius" data-idx="${i}" value="${escAttr(d.radius||"6px")}">
        </div>`;

    case "spacer":
      return `
        <div class="eb-field-row">
          <label>Height (px)</label><input type="number" class="eb-input" style="width:80px;" data-field="height" data-idx="${i}" value="${d.height||30}">
        </div>`;

    case "divider":
      return `
        <div class="eb-field-row">
          <label>Color</label><input type="color" class="eb-input" data-field="color" data-idx="${i}" value="${d.color||"#e0e0e0"}">
          <label>Thickness (px)</label><input type="number" class="eb-input" style="width:70px;" data-field="thickness" data-idx="${i}" value="${d.thickness||1}">
        </div>`;

    case "columns":
      return `
        <div class="eb-field-row">
          <label>Left Content</label><textarea class="eb-input" rows="2" data-field="left" data-idx="${i}">${escAttr(d.left)}</textarea>
        </div>
        <div class="eb-field-row">
          <label>Right Content</label><textarea class="eb-input" rows="2" data-field="right" data-idx="${i}">${escAttr(d.right)}</textarea>
        </div>
        <div class="eb-field-row">
          <label>Left Width %</label><input type="number" class="eb-input" style="width:70px;" data-field="leftWidth" data-idx="${i}" value="${d.leftWidth||50}">
          <label>Gap (px)</label><input type="number" class="eb-input" style="width:60px;" data-field="gap" data-idx="${i}" value="${d.gap||20}">
        </div>`;

    case "html":
      return `
        <div class="eb-field-row">
          <label>HTML</label><textarea class="eb-input" rows="4" data-field="code" data-idx="${i}" style="font-family:monospace;font-size:12px;">${escAttr(d.code)}</textarea>
        </div>`;

    case "product": {
      const productOptions = selectedProductsOrder.map((pid, idx) => {
        const p = mappedProducts.find(prod => prod.id === pid);
        return p ? `<option value="${idx}" ${String(d.productIdx) === String(idx) ? "selected" : ""}>${p.name.slice(0, 40)}</option>` : "";
      }).join("");
      const noProducts = selectedProductsOrder.length === 0
        ? `<p style="color:#f6a623;font-size:12px;margin:4px 0;">⚠️ No products selected — go to Step 3 first.</p>` : "";
      return `
        <div class="eb-field-row">
          <label>Product</label>
          <select class="eb-input" data-field="productIdx" data-idx="${i}">
            ${productOptions || '<option value="">— none —</option>'}
          </select>
        </div>
        ${noProducts}
        <div class="eb-field-row">
          <label>Button Label</label><input type="text" class="eb-input" data-field="buttonLabel" data-idx="${i}" value="${escAttr(d.buttonLabel||"View Product")}">
          <label>BG</label><input type="color" class="eb-input" data-field="bgColor" data-idx="${i}" value="${d.bgColor||"#ffffff"}">
        </div>`;
    }

    default:
      return "";
  }
}

function escAttr(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ebAttachEditors() {
  const canvas = document.getElementById("ebCanvas");
  if (!canvas) return;
  canvas.querySelectorAll(".eb-input[data-field]").forEach((el) => {
    const field = el.dataset.field;
    const idx = parseInt(el.dataset.idx);
    const handler = () => {
      if (ebBlocks[idx]) {
        ebBlocks[idx].data[field] = el.value;
        ebUpdatePreview();
        // Re-render image preview if image URL changed
        if (ebBlocks[idx].type === "image" && field === "url") {
          ebRender(); // re-render whole canvas for image preview
        }
      }
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });
}

// Move block up(-1) or down(+1)
function ebMoveBlock(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= ebBlocks.length) return;
  [ebBlocks[idx], ebBlocks[newIdx]] = [ebBlocks[newIdx], ebBlocks[idx]];
  ebRender();
  ebUpdatePreview();
}

function ebDuplicateBlock(idx) {
  const clone = JSON.parse(JSON.stringify(ebBlocks[idx]));
  clone.id = ebGenId();
  ebBlocks.splice(idx + 1, 0, clone);
  ebRender();
  ebUpdatePreview();
}

function ebDeleteBlock(idx) {
  ebBlocks.splice(idx, 1);
  ebRender();
  ebUpdatePreview();
}

function ebAddBlock(type) {
  ebBlocks.push({ id: ebGenId(), type, data: ebDefaultData(type) });
  ebRender();
  ebUpdatePreview();
  // Scroll to canvas bottom
  const canvas = document.getElementById("ebCanvas");
  if (canvas) canvas.scrollTop = canvas.scrollHeight;
}

// Build full HTML from blocks
function ebBuildHTML() {
  const bodyRows = ebBlocks.map((blk) => ebBlockToHTML(blk)).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Email</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
  <tr><td align="center" style="padding:20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
${bodyRows}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function ebBlockToHTML(blk) {
  const d = blk.data;
  switch (blk.type) {
    case "header": {
      const tag = d.level || "h1";
      const sizes = { h1: "28px", h2: "22px", h3: "18px" };
      return `      <tr><td style="background:${d.bgColor||"#f5f5f5"};padding:24px 30px;text-align:${d.align||"center"};">
        <${tag} style="margin:0;color:${d.color||"#1a1a2e"};font-size:${sizes[tag]};font-family:Arial,sans-serif;">${escHtml(d.text)}</${tag}>
      </td></tr>`;
    }
    case "text":
      return `      <tr><td style="padding:16px 30px;text-align:${d.align||"left"};">
        <p style="margin:0;color:${d.color||"#333"};font-size:${d.fontSize||"16px"};line-height:1.6;font-family:Arial,sans-serif;">${escHtml(d.text)}</p>
      </td></tr>`;
    case "image": {
      const img = `<img src="${d.url}" alt="${escHtml(d.alt||"")}" width="${d.width||"100%"}" style="max-width:100%;display:block;border:0;">`;
      const linked = d.link ? `<a href="${d.link}">${img}</a>` : img;
      return `      <tr><td style="padding:10px 0;text-align:${d.align||"center"};">${linked}</td></tr>`;
    }
    case "button":
      return `      <tr><td style="padding:16px 30px;text-align:${d.align||"center"};">
        <a href="${d.url||"#"}" style="display:inline-block;padding:12px 28px;background:${d.bgColor||"#c9a84c"};color:${d.color||"#fff"};text-decoration:none;border-radius:${d.radius||"6px"};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${escHtml(d.label)}</a>
      </td></tr>`;
    case "spacer":
      return `      <tr><td style="height:${parseInt(d.height)||30}px;line-height:${parseInt(d.height)||30}px;">&nbsp;</td></tr>`;
    case "divider":
      return `      <tr><td style="padding:0 30px;">
        <hr style="border:none;border-top:${parseInt(d.thickness)||1}px solid ${d.color||"#e0e0e0"};margin:0;">
      </td></tr>`;
    case "columns": {
      const lw = parseInt(d.leftWidth) || 50;
      const rw = 100 - lw;
      const gap = parseInt(d.gap) || 20;
      return `      <tr><td style="padding:16px 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="width:${lw}%;vertical-align:top;padding-right:${gap/2}px;font-family:Arial,sans-serif;font-size:15px;color:#333;">${escHtml(d.left)}</td>
          <td style="width:${rw}%;vertical-align:top;padding-left:${gap/2}px;font-family:Arial,sans-serif;font-size:15px;color:#333;">${escHtml(d.right)}</td>
        </tr></table>
      </td></tr>`;
    }
    case "html":
      return `      <tr><td>${d.code}</td></tr>`;
    case "product": {
      const pidx = parseInt(d.productIdx) || 0;
      const pid = selectedProductsOrder[pidx];
      const p = mappedProducts.find(prod => prod.id === pid);
      if (!p) return `      <tr><td style="padding:20px;text-align:center;color:#999;font-family:Arial,sans-serif;font-size:14px;">[Product block — no product selected]</td></tr>`;
      const imgRow = (d.showImage !== false && p.image)
        ? `<tr><td style="padding:0;text-align:center;background:${d.bgColor||"#ffffff"};"><img src="${p.image}" alt="${escHtml(p.name)}" style="max-width:100%;max-height:260px;object-fit:cover;display:block;margin:0 auto;"></td></tr>` : "";
      const priceRow = (d.showPrice !== false && p.price)
        ? `<tr><td style="padding:4px 20px 0;text-align:center;"><span style="font-size:18px;font-weight:bold;color:#c9a84c;font-family:Arial,sans-serif;">${escHtml(p.price)}</span></td></tr>` : "";
      const descRow = (d.showDescription !== false && p.description)
        ? `<tr><td style="padding:8px 20px 0;text-align:center;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.5;">${escHtml(p.description.slice(0, 200))}</td></tr>` : "";
      const btnRow = (d.showButton !== false)
        ? `<tr><td style="padding:14px 20px 20px;text-align:center;"><a href="${p.link||"#"}" style="display:inline-block;padding:10px 24px;background:#c9a84c;color:#fff;text-decoration:none;border-radius:6px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${escHtml(d.buttonLabel||"View Product")}</a></td></tr>` : "";
      return `      <tr><td style="background:${d.bgColor||"#ffffff"};border-radius:6px;overflow:hidden;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${imgRow}
          <tr><td style="padding:16px 20px 4px;text-align:center;"><span style="font-size:16px;font-weight:bold;color:#1a1a2e;font-family:Arial,sans-serif;">${escHtml(p.name)}</span></td></tr>
          ${priceRow}${descRow}${btnRow}
        </table>
      </td></tr>`;
    }
    default:
      return "";
  }
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ebUpdatePreview() {
  const html = ebBuildHTML();
  const previewFrame = document.getElementById("ebPreviewFrame");
  if (!previewFrame) return;
  previewFrame.contentDocument.open();
  previewFrame.contentDocument.write(html);
  previewFrame.contentDocument.close();
}

function ebExportToSend() {
  const html = ebBuildHTML();
  generatedHTML = html;
  document.getElementById("htmlCodeArea").value = html;
  // Update newsletter preview if open
  const vis = document.getElementById("previewVisual");
  if (vis) {
    vis.innerHTML = `
      <div class="preview-edit-controls">
        <button onclick="toggleEditMode()" id="editModeBtn">✏️ Enable Editing</button>
        <button onclick="addTextBlock()" id="addTextBtn" style="display:none;">+ Add Text Block</button>
        <button onclick="savePreviewChanges()" id="saveChangesBtn" style="display:none;">💾 Save Changes</button>
        <span class="edit-status" id="editStatus"></span>
      </div>`;
    const frame = document.createElement("iframe");
    frame.id = "newsletterPreviewFrame";
    frame.style.cssText = "width:100%;min-height:600px;border:none;background:#fff;border-radius:0 0 8px 8px;";
    vis.appendChild(frame);
    previewIframe = frame;
    frame.contentDocument.open();
    frame.contentDocument.write(html);
    frame.contentDocument.close();
  }
  document.getElementById("copyBtn").disabled = false;
  document.getElementById("dlBtn").disabled = false;
  document.getElementById("toSendBtn").disabled = false;
  navigateTo("step4");
  alert("✅ Email exported to Design panel! You can now Copy, Download, or Send it.");
}

// ---- Template Save / Load ----
function ebSaveTemplate() {
  const name = prompt("Save template as:");
  if (!name) return;
  const templates = JSON.parse(localStorage.getItem(EB_TEMPLATES_KEY) || "[]");
  const existing = templates.findIndex((t) => t.name === name);
  const entry = { name, blocks: JSON.parse(JSON.stringify(ebBlocks)), savedAt: new Date().toISOString() };
  if (existing >= 0) templates[existing] = entry;
  else templates.push(entry);
  localStorage.setItem(EB_TEMPLATES_KEY, JSON.stringify(templates));
  ebRenderTemplateList();
  alert(`✅ Template "${name}" saved!`);
}

function ebLoadTemplate(name) {
  const templates = JSON.parse(localStorage.getItem(EB_TEMPLATES_KEY) || "[]");
  const tpl = templates.find((t) => t.name === name);
  if (!tpl) return;
  if (ebBlocks.length > 0 && !confirm(`Load template "${name}"? This will replace your current blocks.`)) return;
  ebBlocks = JSON.parse(JSON.stringify(tpl.blocks));
  ebRender();
  ebUpdatePreview();
}

function ebDeleteTemplate(name) {
  if (!confirm(`Delete template "${name}"?`)) return;
  let templates = JSON.parse(localStorage.getItem(EB_TEMPLATES_KEY) || "[]");
  templates = templates.filter((t) => t.name !== name);
  localStorage.setItem(EB_TEMPLATES_KEY, JSON.stringify(templates));
  ebRenderTemplateList();
}

function ebRenderTemplateList() {
  const list = document.getElementById("ebTemplateList");
  if (!list) return;
  const templates = JSON.parse(localStorage.getItem(EB_TEMPLATES_KEY) || "[]");
  if (templates.length === 0) {
    list.innerHTML = `<p style="color:#888;font-size:13px;margin:0;">No saved templates yet.</p>`;
    return;
  }
  list.innerHTML = templates
    .map(
      (t) => `
    <div class="eb-template-row">
      <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.name}</span>
      <button class="btn btn-sm" onclick="ebLoadTemplate('${escAttr(t.name)}')" style="padding:3px 8px;font-size:12px;">Load</button>
      <button class="btn btn-sm btn-ghost" onclick="ebDeleteTemplate('${escAttr(t.name)}')" style="padding:3px 8px;font-size:12px;color:#ff6b6b;">Del</button>
    </div>`
    )
    .join("");
}

function ebClearAll() {
  if (ebBlocks.length === 0) return;
  if (!confirm("Clear all blocks?")) return;
  ebBlocks = [];
  ebRender();
  ebUpdatePreview();
}

// Init email builder when its panel is shown
function initEmailBuilder() {
  ebRender();
  ebUpdatePreview();
  ebRenderTemplateList();
}

// ============ PANEL: ARTYKUŁY BLOGA ============

let articlesCache = [];

async function loadArticles() {
  const grid = document.getElementById("articlesGrid");
  if (!grid) return;
  grid.innerHTML = '<p style="color:#999">Ładowanie artykułów…</p>';

  try {
    const res = await fetch("/api/articles?limit=30&status=published");
    const articles = await res.json();

    if (!Array.isArray(articles) || articles.length === 0) {
      grid.innerHTML = '<p style="color:#999">Brak opublikowanych artykułów.</p>';
      return;
    }

    articlesCache = articles;
    grid.innerHTML = articles.map((a) => renderArticleCard(a)).join("");

    // Enable drag
    grid.querySelectorAll(".article-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        const idx = Number(card.dataset.idx);
        e.dataTransfer.setData("application/json", JSON.stringify(articlesCache[idx]));
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:#c00">Błąd ładowania: ${err.message}</p>`;
  }
}

function renderArticleCard(a, idx) {
  const tags = (a.tags ?? []).slice(0, 3).map((t) => `<span class="article-tag">${t}</span>`).join("");
  const img = a.image
    ? `<img src="${a.image}" alt="${a.title}" style="width:100%;height:140px;object-fit:cover;border-radius:6px 6px 0 0;display:block;">`
    : `<div style="width:100%;height:140px;background:#e8e8e8;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center;font-size:2rem;">📰</div>`;

  return `
<div class="article-card" draggable="true" data-idx="${idx ?? articlesCache.indexOf(a)}"
  style="border:1px solid #ddd;border-radius:8px;background:#fff;cursor:grab;transition:box-shadow .15s;overflow:hidden;">
  ${img}
  <div style="padding:12px;">
    <div style="font-size:.7rem;color:#888;margin-bottom:4px;">${a.category ?? ""}</div>
    <div style="font-weight:600;font-size:.9rem;margin-bottom:6px;line-height:1.3;">${a.title}</div>
    <div style="font-size:.78rem;color:#555;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${a.excerpt ?? ""}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${tags}</div>
    <div style="display:flex;gap:6px;">
      <button class="btn btn-primary" style="font-size:.75rem;padding:5px 10px;"
        onclick='insertArticleBlock(${JSON.stringify(a).replace(/'/g, "&#39;")})'>
        + Dodaj do newslettera
      </button>
      <a href="${a.url}" target="_blank" class="btn btn-ghost" style="font-size:.75rem;padding:5px 10px;">Podgląd</a>
    </div>
  </div>
</div>`;
}

function insertArticleBlock(article) {
  const baseUrl = window.location.origin;
  const articleUrl = baseUrl + article.url;
  const img = article.image
    ? `<img src="${article.image}" alt="${article.title}" width="560" style="width:560px;max-width:100%;height:auto;display:block;border-radius:6px;margin-bottom:12px;">`
    : "";

  const block = `
<!-- ARTYKUŁ: ${article.title} -->
<tr>
  <td style="padding:20px 30px;border-bottom:1px solid #eee;">
    ${img}
    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${article.category ?? "Blog"}</div>
    <h3 style="margin:0 0 8px;font-size:18px;line-height:1.3;color:#1a1a2e;">
      <a href="${articleUrl}" style="color:#1a1a2e;text-decoration:none;">${article.title}</a>
    </h3>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#555;">${article.excerpt ?? ""}</p>
    <a href="${articleUrl}" style="display:inline-block;background:#0066cc;color:#fff;padding:9px 20px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600;">Czytaj artykuł →</a>
  </td>
</tr>`;

  // Wstaw do generatedHTML (do <tbody> lub za ostatnim </tr>)
  if (generatedHTML) {
    const insertBefore = "</table>";
    const pos = generatedHTML.lastIndexOf(insertBefore);
    if (pos !== -1) {
      generatedHTML = generatedHTML.slice(0, pos) + block + "\n" + generatedHTML.slice(pos);
    } else {
      generatedHTML += block;
    }

    // Odśwież podgląd jeśli iframe otwarty
    const frame = document.getElementById("newsletterPreviewFrame");
    if (frame && frame.contentDocument) {
      frame.contentDocument.open();
      frame.contentDocument.write(generatedHTML);
      frame.contentDocument.close();
    }
    showToast(`✅ Artykuł „${article.title}" dodany do newslettera`);
  } else {
    showToast("⚠️ Najpierw wygeneruj newsletter (krok 4), a potem dodaj artykuł.", "warning");
  }
}

function showToast(msg, type = "success") {
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === "success" ? "#22c55e" : "#f59e0b"};
    color:#fff;padding:10px 18px;border-radius:8px;
    font-size:.85rem;box-shadow:0 4px 12px rgba(0,0,0,.2);
    animation:fadeIn .2s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}



