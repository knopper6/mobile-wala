const tokenKey = "mobilewala_admin_token";
const userKey = "mobilewala_admin_user";

const els = {
  loginForm: document.querySelector("#adminLoginForm"),
  loginStatus: document.querySelector("#adminLoginStatus"),
  lotForm: document.querySelector("#lotForm"),
  formStatus: document.querySelector("#formStatus"),
  stepTabs: document.querySelectorAll("[data-step-tab]"),
  formSteps: document.querySelectorAll("[data-step]"),
  prevStepBtn: document.querySelector("#prevStepBtn"),
  nextStepBtn: document.querySelector("#nextStepBtn"),
  createLotBtn: document.querySelector("#createLotBtn"),
  variantEditor: document.querySelector("#variantEditor"),
  addVariantBtn: document.querySelector("#addVariantBtn"),
  lots: document.querySelector("#adminLots"),
  refreshBtn: document.querySelector("#adminRefreshBtn"),
  resellerForm: document.querySelector("#resellerForm"),
  resellerFormStatus: document.querySelector("#resellerFormStatus"),
  resellerRefreshBtn: document.querySelector("#resellerRefreshBtn"),
  pendingResellers: document.querySelector("#pendingResellers"),
  logoutBtn: document.querySelector("#logoutBtn"),
  changePwdBtn: document.querySelector("#changePwdBtn"),
  pwdModal: document.querySelector("#pwdModal"),
  pwdForm: document.querySelector("#pwdForm"),
  pwdStatus: document.querySelector("#pwdStatus"),
  pwdCloseBtn: document.querySelector("#pwdCloseBtn"),
  resetPwdModal: document.querySelector("#resetPwdModal"),
  resetPwdForm: document.querySelector("#resetPwdForm"),
  resetPwdInfo: document.querySelector("#resetPwdInfo"),
  resetPwdStatus: document.querySelector("#resetPwdStatus"),
  resetPwdCloseBtn: document.querySelector("#resetPwdCloseBtn"),
  lotCount: document.querySelector("#adminLotCount"),
  activeCount: document.querySelector("#adminActiveCount"),
  pendingCount: document.querySelector("#adminPendingCount")
};

let currentLotStep = 1;

function token() {
  return localStorage.getItem(tokenKey);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token()) headers.Authorization = `Bearer ${token()}`;

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Request failed");
  return data;
}

function setStatus(node, message, type = "") {
  node.textContent = message;
  node.className = `status-line ${type}`;
}

function localDateValue(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function money(value, currency = "USD") {
  if (value === null || value === undefined) return "No bids";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value));
}

function setLotStep(step) {
  currentLotStep = Math.max(1, Math.min(3, step));
  els.formSteps.forEach((panel) => {
    panel.classList.toggle("active", Number(panel.dataset.step) === currentLotStep);
  });
  els.stepTabs.forEach((tab) => {
    tab.classList.toggle("active", Number(tab.dataset.stepTab) === currentLotStep);
  });
  els.prevStepBtn.style.visibility = currentLotStep === 1 ? "hidden" : "visible";
  els.nextStepBtn.style.display = currentLotStep === 3 ? "none" : "block";
  els.createLotBtn.style.display = currentLotStep === 3 ? "block" : "none";
}

function validateVisibleStep() {
  const panel = document.querySelector(`[data-step="${currentLotStep}"]`);
  const fields = [...panel.querySelectorAll("input, select, textarea")];
  const invalid = fields.find((field) => field.required && !String(field.value || "").trim());
  if (invalid) {
    invalid.focus();
    setStatus(els.formStatus, "Complete the visible fields before continuing.", "error");
    return false;
  }
  setStatus(els.formStatus, "");
  return true;
}

function addVariant(values = {}) {
  const row = document.createElement("div");
  row.className = "variant-edit-row";
  row.innerHTML = `
    <label class="variant-field"><span>Storage</span><input placeholder="128GB" value="${values.storageCapacity || ""}" data-field="storageCapacity" required></label>
    <label class="variant-field"><span>Color</span><input placeholder="Gold" value="${values.colorName || ""}" data-field="colorName" required></label>
    <label class="variant-field"><span>Icon</span><input placeholder="🟠" value="${values.colorIndicator || "⚪"}" data-field="colorIndicator" required></label>
    <label class="variant-field"><span>Qty</span><input placeholder="213" type="number" min="0" value="${values.quantity ?? 0}" data-field="quantity" required></label>
    <label class="variant-field"><span>Price</span><input placeholder="48000" type="number" min="1" value="${values.startingBid ?? 1}" data-field="startingBid" required></label>
    <label class="variant-field"><span>Inc</span><input placeholder="250" type="number" min="1" value="${values.bidIncrement ?? 250}" data-field="bidIncrement" required></label>
    <label class="variant-field"><span>Grade</span><input placeholder="A+" value="${values.gradeLabel || ""}" data-field="gradeLabel"></label>
    <button class="icon-btn" type="button" title="Remove variant">×</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  els.variantEditor.appendChild(row);
}

function collectVariants() {
  return [...els.variantEditor.querySelectorAll(".variant-edit-row")].map((row, index) => {
    const value = (field) => row.querySelector(`[data-field="${field}"]`).value.trim();
    return {
      storageCapacity: value("storageCapacity"),
      colorName: value("colorName"),
      colorIndicator: value("colorIndicator"),
      quantity: Number(value("quantity")),
      startingBid: Number(value("startingBid")),
      bidIncrement: Number(value("bidIncrement")),
      gradeLabel: value("gradeLabel"),
      sortOrder: index + 1
    };
  });
}

function lotCard(lot) {
  const rows = lot.variants.map((variant) => {
    const hasBid = !!variant.highestBid;
    const bidPrice = money(variant.highestBid || variant.startingBid, lot.currency);
    const bidder = variant.highestBidderCompany || variant.highestBidderName;
    
    const bidderBox = hasBid && bidder
      ? `<div style="display:inline-flex; align-items:center; gap:8px; background:rgba(255,159,10,0.15); padding:4px 10px; border-radius:10px; border:1px solid rgba(255,159,10,0.3);">
           <span style="font-size:1.1rem; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🏢</span>
           <div style="display:flex; flex-direction:column; line-height:1.2; text-align:left;">
             <strong style="font-size:0.75rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100px;" title="${bidder}">${bidder}</strong>
             <span style="color:var(--gold); font-weight:700; font-size:0.85rem">${bidPrice}</span>
           </div>
         </div>`
      : `<div style="display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:10px; border:1px solid var(--glass-border);">
           <span style="font-size:1.1rem; opacity:0.7">⏳</span>
           <div style="display:flex; flex-direction:column; line-height:1.2; text-align:left;">
             <span style="font-size:0.75rem; color:var(--muted)">No bids yet</span>
             <span style="color:var(--text); font-weight:500; font-size:0.85rem">Start: ${bidPrice}</span>
           </div>
         </div>`;

    return `
    <div class="variant-row" style="grid-template-columns: 80px minmax(60px, 1fr) 60px 80px 150px; padding-right: 14px;">
      <strong>${variant.colorIndicator} ${variant.storageCapacity}</strong>
      <span>${variant.colorName}</span>
      <span>${variant.gradeLabel || ""}</span>
      <strong>${variant.quantity} PCS</strong>
      <div class="variant-bid-cell" style="display: flex; justify-content: flex-end; width: 100%;">
        ${bidderBox}
      </div>
    </div>
  `}).join("");

  return `
    <article class="lot-card ${lot.status}">
      <div>
        <div class="lot-title">
          <div>
            <h3>${lot.title}</h3>
            <p>${lot.series} · ${lot.gradeLabel}</p>
          </div>
          <span class="badge ${lot.status}">${lot.status}</span>
        </div>
        <div class="variant-list">${rows}</div>
      </div>
      <aside class="lot-side">
        <div class="price-stack">
          <div class="price-box"><span>Starting price</span><strong>${money(lot.startingBid, lot.currency)}</strong></div>
          <div class="price-box"><span>Highest bid</span><strong>${money(lot.highestBid, lot.currency)}</strong></div>
          <div class="price-box"><span>Ends</span><strong>${new Date(lot.endsAt).toLocaleDateString()}</strong></div>
        </div>
        <div class="lot-admin-actions">
          <button class="btn gold" type="button" data-lot-status="${lot.id}" data-status="closed">Force Close</button>
          <button class="btn primary" type="button" data-lot-status="${lot.id}" data-status="sold">Mark Sold</button>
        </div>
      </aside>
    </article>
  `;
}

function resellerCard(reseller) {
  return `
    <article class="reseller-card">
      <div>
        <h3>${reseller.companyName}</h3>
        <p>${reseller.displayName} · ${reseller.email} · ${reseller.phone}</p>
      </div>
      <div class="reseller-actions" style="flex-wrap:wrap;gap:6px">
        <button class="btn" type="button" data-reseller-pwd="${reseller.id}" data-name="${reseller.displayName}" data-email="${reseller.email}">Reset Pwd</button>
        <button class="btn primary" type="button" data-reseller-status="${reseller.id}" data-status="active">Approve</button>
        <button class="btn danger" type="button" data-reseller-status="${reseller.id}" data-status="suspended">Reject</button>
      </div>
    </article>
  `;
}

async function loadResellers() {
  if (!token()) {
    els.pendingResellers.innerHTML = `<div class="notice">Login as admin to review approvals.</div>`;
    return;
  }

  try {
    const { resellers } = await api("/api/admin/resellers");
    const pending = resellers.filter((reseller) => reseller.status === "pending");
    els.pendingCount.textContent = pending.length;
    els.pendingResellers.innerHTML = pending.length
      ? pending.map(resellerCard).join("")
      : `<div class="empty">No pending reseller approvals.</div>`;
  } catch (error) {
    els.pendingResellers.innerHTML = `<div class="notice">${error.message}</div>`;
  }
}

async function loadAdminLots() {
  if (!token()) {
    els.lots.innerHTML = `<div class="notice">Login as admin to manage lots.</div>`;
    return;
  }

  els.lots.innerHTML = `<div class="notice">Loading lots...</div>`;
  try {
    const { lots } = await api("/api/lots/admin/all");
    els.lotCount.textContent = lots.length;
    els.activeCount.textContent = lots.filter((lot) => lot.status === "active").length;
    els.lots.innerHTML = lots.length
      ? lots.map(lotCard).join("")
      : `<div class="empty">No lots created yet.</div>`;
  } catch (error) {
    els.lots.innerHTML = `<div class="notice">${error.message}</div>`;
  }
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(els.loginStatus, "Logging in...");

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#adminEmail").value,
        password: document.querySelector("#adminPassword").value
      })
    });
    if (data.user.role !== "admin") throw new Error("Use an admin account on this page");
    localStorage.setItem(tokenKey, data.token);
    localStorage.setItem(userKey, JSON.stringify(data.user));
    setStatus(els.loginStatus, `Logged in as ${data.user.displayName}`, "ok");
    await loadAdminLots();
    await loadResellers();
  } catch (error) {
    setStatus(els.loginStatus, error.message, "error");
  }
});

els.resellerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!token()) {
    setStatus(els.resellerFormStatus, "Login as admin first", "error");
    return;
  }

  const payload = {
    displayName: document.querySelector("#resellerName").value.trim(),
    companyName: document.querySelector("#resellerCompany").value.trim(),
    email: document.querySelector("#resellerEmail").value.trim(),
    phone: document.querySelector("#resellerPhone").value.trim(),
    password: document.querySelector("#resellerPassword").value,
    status: document.querySelector("#resellerStatus").value
  };

  setStatus(els.resellerFormStatus, "Adding reseller...");
  try {
    await api("/api/admin/resellers", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    event.target.reset();
    document.querySelector("#resellerPassword").value = "";
    document.querySelector("#resellerStatus").value = "active";
    setStatus(els.resellerFormStatus, "Reseller added", "ok");
    await loadResellers();
  } catch (error) {
    setStatus(els.resellerFormStatus, error.message, "error");
  }
});

els.lotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!token()) {
    setStatus(els.formStatus, "Login as admin first", "error");
    return;
  }

  const startsAt = new Date(document.querySelector("#startsAt").value).toISOString();
  const endsAt = new Date(document.querySelector("#endsAt").value).toISOString();

  const payload = {
    title: document.querySelector("#title").value.trim(),
    series: document.querySelector("#series").value.trim(),
    gradeLabel: document.querySelector("#gradeLabel").value.trim(),
    status: document.querySelector("#status").value,
    description: document.querySelector("#description").value.trim(),
    startingBid: Number(document.querySelector("#startingBid").value),
    bidIncrement: Number(document.querySelector("#bidIncrement").value),
    currency: document.querySelector("#currency").value,
    startsAt,
    endsAt,
    variants: collectVariants()
  };

  setStatus(els.formStatus, "Creating lot...");
  try {
    await api("/api/lots/admin", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setStatus(els.formStatus, "Lot created and available in admin list", "ok");
    await loadAdminLots();
  } catch (error) {
    setStatus(els.formStatus, error.message, "error");
  }
});

els.addVariantBtn.addEventListener("click", () => addVariant());
els.stepTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const nextStep = Number(tab.dataset.stepTab);
    if (nextStep <= currentLotStep || validateVisibleStep()) setLotStep(nextStep);
  });
});
els.prevStepBtn.addEventListener("click", () => setLotStep(currentLotStep - 1));
els.nextStepBtn.addEventListener("click", () => {
  if (validateVisibleStep()) setLotStep(currentLotStep + 1);
});
els.refreshBtn.addEventListener("click", loadAdminLots);
els.resellerRefreshBtn.addEventListener("click", loadResellers);
document.addEventListener("click", async (event) => {
  const lotButton = event.target.closest("[data-lot-status]");
  if (lotButton) {
    lotButton.disabled = true;
    try {
      await api(`/api/lots/admin/${lotButton.dataset.lotStatus}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: lotButton.dataset.status })
      });
      await loadAdminLots();
    } catch (error) {
      alert(error.message);
    } finally {
      lotButton.disabled = false;
    }
    return;
  }

  const button = event.target.closest("[data-reseller-status]");
  if (!button) return;
  button.disabled = true;
  const status = button.dataset.status;
  try {
    await api(`/api/admin/resellers/${button.dataset.resellerStatus}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await loadResellers();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
});
/* ---------- Admin change password ---------- */

els.changePwdBtn.addEventListener("click", () => {
  els.pwdModal.classList.add("open");
});

els.pwdCloseBtn.addEventListener("click", () => {
  els.pwdModal.classList.remove("open");
});

els.pwdModal.addEventListener("click", (e) => {
  if (e.target === els.pwdModal) els.pwdModal.classList.remove("open");
});

els.pwdForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const current = document.querySelector("#pwdCurrent").value;
  const pw = document.querySelector("#pwdNew").value;
  const confirm = document.querySelector("#pwdConfirm").value;

  if (pw !== confirm) {
    setStatus(els.pwdStatus, "Passwords do not match", "error");
    return;
  }

  setStatus(els.pwdStatus, "Updating...");
  try {
    await api("/api/admin/profile", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword: current, newPassword: pw })
    });
    setStatus(els.pwdStatus, "Password updated!", "ok");
    els.pwdForm.reset();
    setTimeout(() => els.pwdModal.classList.remove("open"), 1200);
  } catch (err) {
    setStatus(els.pwdStatus, err.message, "error");
  }
});

/* ---------- Reseller password reset ---------- */

let resetResellerId = null;

els.resetPwdCloseBtn.addEventListener("click", () => {
  els.resetPwdModal.classList.remove("open");
});

els.resetPwdModal.addEventListener("click", (e) => {
  if (e.target === els.resetPwdModal) els.resetPwdModal.classList.remove("open");
});

els.resetPwdForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = document.querySelector("#resetPwdNew").value;
  if (!resetResellerId) return;

  setStatus(els.resetPwdStatus, "Resetting...");
  try {
    await api(`/api/admin/resellers/${resetResellerId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword: pw })
    });
    setStatus(els.resetPwdStatus, "Password reset!", "ok");
    els.resetPwdForm.reset();
    setTimeout(() => els.resetPwdModal.classList.remove("open"), 1200);
  } catch (err) {
    setStatus(els.resetPwdStatus, err.message, "error");
  }
});

els.logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  setStatus(els.loginStatus, "Logged out");
  loadAdminLots();
  loadResellers();
});

const now = new Date();
const fiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
document.querySelector("#startsAt").value = localDateValue(now);
document.querySelector("#endsAt").value = localDateValue(fiveDays);

[
  { storageCapacity: "128GB", colorName: "Gold", colorIndicator: "🟠", quantity: 213, startingBid: 48000, bidIncrement: 250, gradeLabel: "A+" },
  { storageCapacity: "128GB", colorName: "Silver", colorIndicator: "⚪", quantity: 94, startingBid: 47500, bidIncrement: 250, gradeLabel: "A+" },
  { storageCapacity: "256GB", colorName: "Gold", colorIndicator: "🟠", quantity: 74, startingBid: 55500, bidIncrement: 250, gradeLabel: "DNA" },
  { storageCapacity: "256GB", colorName: "Silver", colorIndicator: "⚪", quantity: 98, startingBid: 55250, bidIncrement: 250, gradeLabel: "DNA" },
  { storageCapacity: "512GB", colorName: "Gold", colorIndicator: "🟠", quantity: 16, startingBid: 64000, bidIncrement: 500, gradeLabel: "A+" }
].forEach(addVariant);

setLotStep(1);
loadAdminLots();
loadResellers();
