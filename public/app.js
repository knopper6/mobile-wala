const tokenKey = "mobilewala_token";
const userKey = "mobilewala_user";

const state = {
  lots: [],
  selectedLot: null
};

const els = {
  loginForm: document.querySelector("#loginForm"),
  loginStatus: document.querySelector("#loginStatus"),
  lots: document.querySelector("#lots"),
  refreshBtn: document.querySelector("#refreshBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  lotCount: document.querySelector("#lotCount"),
  unitCount: document.querySelector("#unitCount"),
  bidCount: document.querySelector("#bidCount"),
  modal: document.querySelector("#actionModal"),
  modalContent: document.querySelector("#modalContent"),
  loginCta: document.querySelector("#loginCta"),
  signupCta: document.querySelector("#signupCta"),
  inlineSignupBtn: document.querySelector("#inlineSignupBtn")
};

function money(value, currency = "USD") {
  if (value === null || value === undefined) return "No bids";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value));
}

function setStatus(message, type = "") {
  els.loginStatus.textContent = message;
  els.loginStatus.className = `status-line ${type}`;
}

function token() {
  return localStorage.getItem(tokenKey);
}

function currentUser() {
  const raw = localStorage.getItem(userKey);
  return raw ? JSON.parse(raw) : null;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token()) headers.Authorization = `Bearer ${token()}`;

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Request failed");
  }
  return data;
}

function deadlineText(iso) {
  const end = new Date(iso);
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 36e5);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  return `${hours}h left`;
}

function minimumBid(item) {
  return item.minimumBid || (item.highestBid ? item.highestBid + item.bidIncrement : item.startingBid);
}

function variantRows(lot) {
  return lot.variants.map((variant) => `
    <div class="variant-row">
      <strong>${variant.colorIndicator} ${variant.storageCapacity}</strong>
      <span>${variant.colorName}</span>
      <span>${variant.gradeLabel || ""}</span>
      <strong>${variant.quantity} PCS</strong>
      <div class="variant-bid-cell">
        <span>${money(variant.highestBid || variant.startingBid, lot.currency)}</span>
        <button class="btn primary" type="button" data-bid-now="${lot.id}" data-variant-id="${variant.id}">Bid Now</button>
      </div>
    </div>
  `).join("");
}

function lotCard(lot) {
  return `
    <article class="lot-card ${lot.status}" data-lot-id="${lot.id}">
      <div>
        <div class="lot-title">
          <div>
            <div class="live-label"><span class="live-dot"></span>LIVE</div>
            <h3>${lot.title}</h3>
            <p>${lot.series} · ${lot.gradeLabel} · ${deadlineText(lot.endsAt)}</p>
          </div>
          <span class="badge ${lot.status}">${lot.status}</span>
        </div>
        <div class="variant-list">${variantRows(lot)}</div>
      </div>
      <aside class="lot-side">
        <div class="price-stack">
          <div class="price-box"><span>Rows sold separately</span><strong>${lot.variants.length} Models</strong></div>
          <div class="price-box"><span>Total row bids</span><strong>${lot.bidCount}</strong></div>
          <div class="price-box"><span>Total quantity</span><strong>${lot.totalQuantity} PCS</strong></div>
        </div>
      </aside>
    </article>
  `;
}

async function loadLots() {
  els.lots.innerHTML = `<div class="notice">Loading auction lots...</div>`;
  try {
    const { lots } = await api("/api/lots");
    state.lots = lots;
    els.lotCount.textContent = lots.length;
    els.unitCount.textContent = lots.reduce((total, lot) => total + lot.totalQuantity, 0);
    els.bidCount.textContent = lots.reduce((total, lot) => total + lot.bidCount, 0);
    els.lots.innerHTML = lots.length
      ? lots.map(lotCard).join("")
      : `<div class="empty">No active auction lots yet. Ask admin to create or activate a lot.</div>`;
  } catch (error) {
    els.lots.innerHTML = `<div class="notice">${error.message}</div>`;
  }
}

function openModal(html) {
  els.modalContent.innerHTML = html;
  els.modal.classList.add("open");
  els.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  els.modal.classList.remove("open");
  els.modal.setAttribute("aria-hidden", "true");
  els.modalContent.innerHTML = "";
}

function loginModal() {
  openModal(`
    <h2>Login to bid</h2>
    <p class="hint">Use your reseller name or company name with your password.</p>
    <form id="modalLoginForm">
      <div class="field">
        <label for="modalLoginName">Name or Company</label>
        <input id="modalLoginName" value="KK Mobiles" required>
      </div>
      <div class="field">
        <label for="modalLoginPassword">Password</label>
        <input id="modalLoginPassword" type="password" value="MobileWala@123" required>
      </div>
      <button class="btn primary block" type="submit">Login</button>
      <p class="status-line" id="modalStatus"></p>
    </form>
  `);
}

function signupModal() {
  openModal(`
    <h2>Create reseller account</h2>
    <p class="hint">Signup requests are reviewed by admin before bidding access is enabled.</p>
    <form id="signupForm">
      <div class="field"><label for="signupName">Your Name</label><input id="signupName" required></div>
      <div class="field"><label for="signupCompany">Company</label><input id="signupCompany" required></div>
      <div class="field"><label for="signupEmail">Email</label><input id="signupEmail" type="email" required></div>
      <div class="field"><label for="signupPhone">Phone</label><input id="signupPhone" required></div>
      <div class="field"><label for="signupPassword">Password</label><input id="signupPassword" type="password" minlength="8" required></div>
      <button class="btn primary block" type="submit">Submit For Approval</button>
      <p class="status-line" id="modalStatus"></p>
    </form>
  `);
}

function bidModal(lot, variant) {
  const user = currentUser();
  if (!token() || !user) {
    openModal(`
      <h2>Sign up to place this bid</h2>
      <p class="hint">${lot.title} · ${variant.colorIndicator} ${variant.storageCapacity} ${variant.colorName}</p>
      <div class="price-box"><span>Current price</span><strong>${money(variant.highestBid || variant.startingBid, lot.currency)}</strong></div>
      <div class="price-box" style="margin-top:10px"><span>Minimum next bid</span><strong>${money(minimumBid(variant), lot.currency)}</strong></div>
      <div class="modal-actions">
        <button class="btn primary" type="button" data-open-signup>Sign Up</button>
        <button class="btn gold" type="button" data-open-login>Login</button>
      </div>
    `);
    return;
  }

  openModal(`
    <h2>Place bid</h2>
    <p class="hint">${lot.title} · ${variant.colorIndicator} ${variant.storageCapacity} ${variant.colorName}</p>
    <form id="bidForm" data-lot-id="${lot.id}" data-variant-id="${variant.id}">
      <div class="field">
        <label for="bidAmount">Bid Price</label>
        <input id="bidAmount" type="number" min="${minimumBid(variant)}" step="${variant.bidIncrement}" value="${minimumBid(variant)}" required>
      </div>
      <button class="btn primary block" type="submit">Submit Bid</button>
      <p class="status-line" id="modalStatus">Minimum bid ${money(minimumBid(variant), lot.currency)}</p>
    </form>
  `);
}

async function loginWithIdentifier(identifier, password, statusNode = els.loginStatus) {
  statusNode.textContent = "Logging in...";
  statusNode.className = "status-line";
  const data = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password })
  });
  if (data.user.role !== "reseller") {
    throw new Error("Use a reseller account on this page");
  }
  localStorage.setItem(tokenKey, data.token);
  localStorage.setItem(userKey, JSON.stringify(data.user));
  statusNode.textContent = `Logged in as ${data.user.companyName || data.user.displayName}`;
  statusNode.className = "status-line ok";
  return data;
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const identifier = document.querySelector("#loginName").value;
  const password = document.querySelector("#password").value;

  try {
    await loginWithIdentifier(identifier, password);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

document.addEventListener("click", (event) => {
  const demo = event.target.closest("[data-demo]");
  if (demo) {
    document.querySelector("#loginName").value = demo.dataset.demo;
    document.querySelector("#password").value = "MobileWala@123";
  }

  const bidNow = event.target.closest("[data-bid-now]");
  if (bidNow) {
    const lot = state.lots.find((item) => item.id === Number(bidNow.dataset.bidNow));
    const variant = lot?.variants.find((item) => item.id === Number(bidNow.dataset.variantId));
    if (lot && variant) bidModal(lot, variant);
  }

  if (event.target.closest("[data-close-modal]") || event.target === els.modal) closeModal();
  if (event.target.closest("[data-open-signup]")) signupModal();
  if (event.target.closest("[data-open-login]")) loginModal();
});

document.addEventListener("submit", async (event) => {
  if (event.target.id === "modalLoginForm") {
    event.preventDefault();
    const statusNode = document.querySelector("#modalStatus");
    try {
      await loginWithIdentifier(
        document.querySelector("#modalLoginName").value,
        document.querySelector("#modalLoginPassword").value,
        statusNode
      );
      closeModal();
    } catch (error) {
      statusNode.textContent = error.message;
      statusNode.className = "status-line error";
    }
  }

  if (event.target.id === "signupForm") {
    event.preventDefault();
    const statusNode = document.querySelector("#modalStatus");
    statusNode.textContent = "Creating account...";
    try {
      const payload = {
        displayName: document.querySelector("#signupName").value,
        companyName: document.querySelector("#signupCompany").value,
        email: document.querySelector("#signupEmail").value,
        phone: document.querySelector("#signupPhone").value,
        password: document.querySelector("#signupPassword").value
      };
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(userKey);
      statusNode.textContent = data.message || "Registration submitted. Admin approval is required before login.";
      statusNode.className = "status-line ok";
      setStatus("Signup submitted. Wait for admin approval.", "ok");
    } catch (error) {
      statusNode.textContent = error.message;
      statusNode.className = "status-line error";
    }
  }

  if (event.target.id === "bidForm") {
    event.preventDefault();
    const statusNode = document.querySelector("#modalStatus");
    const lotId = event.target.dataset.lotId;
    const variantId = Number(event.target.dataset.variantId);
    statusNode.textContent = "Submitting bid...";
    try {
      await api(`/api/lots/${lotId}/bids`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(document.querySelector("#bidAmount").value),
          variantId
        })
      });
      closeModal();
      await loadLots();
    } catch (error) {
      statusNode.textContent = error.message;
      statusNode.className = "status-line error";
    }
  }
});

els.refreshBtn.addEventListener("click", loadLots);
els.loginCta.addEventListener("click", loginModal);
els.signupCta.addEventListener("click", signupModal);
els.inlineSignupBtn.addEventListener("click", signupModal);
els.logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  setStatus("Logged out");
});

if (currentUser()) {
  setStatus(`Logged in as ${currentUser().companyName || currentUser().displayName}`, "ok");
}

loadLots();

/* ── Spotlight Glow Card — pointer tracker ─────────────────── */
// Sync cursor position as CSS custom properties onto every .lot-card
// so the radial-gradient spotlight follows the mouse in real time.
function syncGlowPointer(e) {
  const { clientX: x, clientY: y } = e;
  const xp = (x / window.innerWidth).toFixed(4);
  const yp = (y / window.innerHeight).toFixed(4);
  document.querySelectorAll('.lot-card').forEach((card) => {
    card.style.setProperty('--x', x.toFixed(2));
    card.style.setProperty('--xp', xp);
    card.style.setProperty('--y', y.toFixed(2));
    card.style.setProperty('--yp', yp);
  });
}

document.addEventListener('pointermove', syncGlowPointer);
