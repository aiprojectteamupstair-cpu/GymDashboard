import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import readXlsxFile from "read-excel-file/browser";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, BarChart3, Users, UploadCloud, LogOut, Menu, X,
  Plus, Pencil, Trash2, Search, ShieldCheck, Eye, EyeOff, Download,
  FileSpreadsheet, CheckCircle2, AlertTriangle, Info, KeyRound, RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Brand tokens                                                      */
/* ------------------------------------------------------------------ */
const COLORS = {
  indigo: "#2b2d42",
  lavender: "#8d99ae",
  platinum: "#edf2f4",
  punch: "#ef233c",
  flag: "#d90429",
  owner: "#168a74",
};
const TYPES = ["Member", "Student", "Staff", "Owner"];
const TYPE_COLOR = {
  Member: COLORS.indigo,
  Student: COLORS.punch,
  Staff: COLORS.lavender,
  Owner: COLORS.owner,
};
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const DEFAULT_PERMS = { dashboard: true, analytics: false, upload: false, editMembers: false, deleteMembers: false };
const FULL_PERMS = { dashboard: true, analytics: true, upload: true, editMembers: true, deleteMembers: true };

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */
async function storeGet(key, fallback) {
  try {
    if (window.storage?.get) {
      const r = await window.storage.get(key, true);
      return r ? JSON.parse(r.value) : fallback;
    }
    const value = window.localStorage.getItem(`gym-active-member:${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
async function storeSet(key, value) {
  try {
    if (window.storage?.set) {
      await window.storage.set(key, JSON.stringify(value), true);
      return;
    }
    window.localStorage.setItem(`gym-active-member:${key}`, JSON.stringify(value));
  } catch (e) {
    console.error("storage set failed", key, e);
  }
}
async function hashText(text) {
  try {
    const enc = new TextEncoder().encode(text);
    const buf = await window.crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // fallback simple hash if subtle crypto unavailable
    let h = 0;
    for (let i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) | 0; }
    return "fb" + h;
  }
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function slugName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function firstSheetRows(workbookResult) {
  const rows = workbookResult?.[0]?.data ?? workbookResult;
  if (!Array.isArray(rows)) throw new Error("The workbook does not contain a readable worksheet.");
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Excel parsing                                                      */
/* ------------------------------------------------------------------ */
function parseWorkbookRows(rows) {
  if (!rows.length) throw new Error("The sheet appears to be empty.");

  // Title guess (month + year), e.g. "JULY,2026 Daily Active Membere List"
  const titleCell = String(rows[0]?.[0] ?? "");
  let guessMonth = null, guessYear = null;
  const m = titleCell.match(/([A-Za-z]{3,9})[,\s]+(\d{4})/);
  if (m) {
    const idx = MONTH_NAMES.findIndex((mn) => mn.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
    if (idx >= 0) guessMonth = idx;
    guessYear = parseInt(m[2], 10);
  }

  // Find header row: first column literally "No."
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const c0 = String(rows[i]?.[0] ?? "").trim().toLowerCase();
    if (c0 === "no." || c0 === "no") { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) throw new Error('Could not find the header row (looking for "No." in column A).');

  const headerRow = rows[headerRowIdx];
  let totalColIdx = headerRow.findIndex((h) => typeof h === "string" && /total/i.test(h));
  if (totalColIdx === -1) totalColIdx = headerRow.length; // fallback: no total column

  const dayCols = [];
  for (let c = 2; c < totalColIdx; c++) {
    const v = headerRow[c];
    if (typeof v === "number" && v >= 1 && v <= 31) dayCols.push({ col: c, day: v });
  }
  if (!dayCols.length) throw new Error("Could not find any day columns (1-31) in the header row.");
  const daysInMonth = Math.max(...dayCols.map((d) => d.day));

  const records = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = row[1];
    if (name === null || name === undefined || String(name).trim() === "") continue;
    const days = {};
    let sum = 0;
    for (const { col, day } of dayCols) {
      const v = Number(row[col]) || 0;
      days[day] = v;
      sum += v;
    }
    const total = totalColIdx < row.length && row[totalColIdx] != null ? Number(row[totalColIdx]) || sum : sum;
    records.push({ name: String(name).trim(), days, total });
  }
  if (!records.length) throw new Error("No member rows were found under the header.");

  return { guessMonth, guessYear, daysInMonth, records };
}

/* ------------------------------------------------------------------ */
/*  Small UI atoms                                                     */
/* ------------------------------------------------------------------ */
function Toast({ toast, onClose }) {
  if (!toast) return null;
  const icon = toast.type === "error" ? <AlertTriangle size={16} /> : toast.type === "info" ? <Info size={16} /> : <CheckCircle2 size={16} />;
  return (
    <div className={`toast toast--${toast.type}`} role="status">
      {icon}<span>{toast.message}</span>
      <button className="toast__close" onClick={onClose} aria-label="Dismiss"><X size={14} /></button>
    </div>
  );
}

function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: width }}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon" style={{ background: `${color}1a`, color }}>{icon}</div>
      <div>
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  );
}

function Badge({ type }) {
  return <span className="badge" style={{ background: `${TYPE_COLOR[type]}1a`, color: TYPE_COLOR[type] }}>{type}</span>;
}

/* ------------------------------------------------------------------ */
/*  Login screen                                                       */
/* ------------------------------------------------------------------ */
function LoginScreen({ onLogin, firstRunNotice, busy, error }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__brand">
          <div className="login-card__logo">AM</div>
          <div>
            <div className="login-card__title">Active Member Dashboard</div>
            <div className="login-card__subtitle">Sign in to continue</div>
          </div>
        </div>

        {firstRunNotice && (
          <div className="notice">
            <ShieldCheck size={16} />
            <div>
              A default administrator account was created for first-time setup.
              <br />
              <strong>Username:</strong> admin &nbsp; <strong>Password:</strong> admin123
              <br />
              Please sign in and change this password right away.
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); onLogin(username.trim(), password); }}
          className="login-form"
        >
          <label className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="admin" />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="pw-wrap">
              <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password visibility">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && <div className="form-error"><AlertTriangle size={14} />{error}</div>}
          <button className="btn btn--primary btn--block" type="submit" disabled={busy || !username || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main app                                                            */
/* ------------------------------------------------------------------ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [sheets, setSheets] = useState({}); // key "YYYY-MM" -> {label, daysInMonth, records:[{memberId,days,total}]}
  const [currentUser, setCurrentUser] = useState(null);
  const [firstRunNotice, setFirstRunNotice] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /* ---------------- initial load ---------------- */
  useEffect(() => {
    (async () => {
      let u = await storeGet("users", null);
      let m = await storeGet("members", []);
      let s = await storeGet("sheets", {});
      const sessionUserId = await storeGet("sessionUserId", null);
      if (!u || !u.length) {
        const passwordHash = await hashText("admin123");
        u = [{
          id: uid("usr"), username: "admin", passwordHash,
          displayName: "Administrator", role: "superadmin",
          permissions: FULL_PERMS, createdAt: Date.now(),
        }];
        await storeSet("users", u);
        setFirstRunNotice(true);
      }

      // One-time cleanup for data that older versions automatically seeded from
      // the project workbook. From now on, only user-uploaded workbooks are used.
      const seedCleanupDone = await storeGet("bundledSeedRetired", false);
      if (!seedCleanupDone) {
        const julySheet = s["2026-07"];
        const looksLikeBundledSeed =
          Object.keys(s).length === 1 &&
          julySheet?.label === "July 2026" &&
          julySheet?.records?.length === 157 &&
          m.some((member) => member.id === "ko thu");
        if (looksLikeBundledSeed) {
          m = [];
          s = {};
          await storeSet("members", m);
          await storeSet("sheets", s);
        }
        await storeSet("bundledSeedRetired", true);
      }

      // Retire legacy categories that are no longer available in the UI.
      if (m.some((member) => !TYPES.includes(member.type))) {
        m = m.map((member) => (
          TYPES.includes(member.type) ? member : { ...member, type: "Member" }
        ));
        await storeSet("members", m);
      }

      setUsers(u);
      setMembers(m);
      setSheets(s);
      setCurrentUser(u.find((user) => user.id === sessionUserId) || null);
      setLoading(false);
    })();
  }, []);

  const persistUsers = useCallback(async (next) => { setUsers(next); await storeSet("users", next); }, []);
  const persistMembers = useCallback(async (next) => { setMembers(next); await storeSet("members", next); }, []);
  const persistSheets = useCallback(async (next) => { setSheets(next); await storeSet("sheets", next); }, []);

  /* ---------------- auth ---------------- */
  async function handleLogin(username, password) {
    setLoginError("");
    setLoginBusy(true);
    const hash = await hashText(password);
    const found = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    setLoginBusy(false);
    if (!found || found.passwordHash !== hash) {
      setLoginError("Incorrect username or password.");
      return;
    }
    setCurrentUser(found);
    await storeSet("sessionUserId", found.id);
    setFirstRunNotice(false);
    setActiveTab("dashboard");
  }
  async function handleLogout() {
    await storeSet("sessionUserId", null);
    setCurrentUser(null);
    setActiveTab("dashboard");
    setSidebarOpen(false);
  }

  const perms = currentUser?.role === "superadmin" ? FULL_PERMS : (currentUser?.permissions || DEFAULT_PERMS);
  const isSuperadmin = currentUser?.role === "superadmin";

  /* ---------------- derived month list ---------------- */
  const monthKeys = useMemo(
    () => Object.keys(sheets).sort((a, b) => (a < b ? 1 : -1)),
    [sheets]
  );
  const [selectedMonth, setSelectedMonth] = useState(null);
  const selectedMonthKey =
    selectedMonth && sheets[selectedMonth] ? selectedMonth : (monthKeys[0] || null);

  const membersById = useMemo(() => {
    const map = {};
    members.forEach((m) => (map[m.id] = m));
    return map;
  }, [members]);

  const currentSheet = selectedMonthKey ? sheets[selectedMonthKey] : null;

  const activeList = useMemo(() => {
    if (!currentSheet) return [];
    return currentSheet.records
      .map((r) => ({ ...r, member: membersById[r.memberId] }))
      .filter((r) => r.member);
  }, [currentSheet, membersById]);

  if (loading) {
    return (
      <div className="boot">
        <style>{GLOBAL_CSS}</style>
        <div className="boot__spinner" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <LoginScreen onLogin={handleLogin} firstRunNotice={firstRunNotice} busy={loginBusy} error={loginError} />
      </>
    );
  }

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, show: perms.dashboard },
    { key: "analytics", label: "Analytics", icon: <BarChart3 size={18} />, show: perms.analytics },
    { key: "upload", label: "Upload Data", icon: <UploadCloud size={18} />, show: perms.upload },
    { key: "users", label: "User Management", icon: <Users size={18} />, show: isSuperadmin },
  ].filter((t) => t.show);

  return (
    <div className="app-root">
      <style>{GLOBAL_CSS}</style>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      <div className="layout">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar__brand">
            <div className="sidebar__logo">AM</div>
            <div>
              <div className="sidebar__title">Active Members</div>
              <div className="sidebar__subtitle">Daily attendance</div>
            </div>
            <button className="icon-btn icon-btn--light sidebar__close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
          </div>

          <nav className="sidebar__nav">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`nav-item ${activeTab === t.key ? "active" : ""}`}
                onClick={() => { setActiveTab(t.key); setSidebarOpen(false); }}
              >
                {t.icon}<span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar__footer">
            <div className="sidebar__user">
              <div className="sidebar__avatar">{currentUser.displayName?.[0]?.toUpperCase() || "U"}</div>
              <div>
                <div className="sidebar__user-name">{currentUser.displayName}</div>
                <div className="sidebar__user-role">{currentUser.role === "superadmin" ? "Main Admin" : "Admin"}</div>
              </div>
            </div>
            <button className="nav-item" onClick={handleLogout}><LogOut size={18} /><span>Log out</span></button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="icon-btn hamburger" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <h1 className="topbar__title">{tabs.find((t) => t.key === activeTab)?.label || ""}</h1>
            <div className="topbar__spacer" />
            {monthKeys.length > 0 && (
              <div className="month-select">
                <select value={selectedMonthKey || ""} onChange={(e) => setSelectedMonth(e.target.value)}>
                  {monthKeys.map((k) => <option key={k} value={k}>{sheets[k].label}</option>)}
                </select>
              </div>
            )}
          </header>

          <main className="content">
            {activeTab === "dashboard" && (
              <DashboardTab
                currentSheet={currentSheet}
                activeList={activeList}
                monthKeys={monthKeys}
                members={members}
                canEdit={perms.editMembers}
                canDelete={perms.deleteMembers}
                onUpdateMember={async (id, patch) => {
                  const next = members.map((m) => (m.id === id ? { ...m, ...patch } : m));
                  await persistMembers(next);
                  notify("Member updated.");
                }}
                onDeleteMember={async (id) => {
                  const next = members.filter((m) => m.id !== id);
                  await persistMembers(next);
                  const nextSheets = { ...sheets };
                  Object.keys(nextSheets).forEach((k) => {
                    nextSheets[k] = { ...nextSheets[k], records: nextSheets[k].records.filter((r) => r.memberId !== id) };
                  });
                  await persistSheets(nextSheets);
                  notify("Member removed.", "info");
                }}
                onAddMember={async (name, type) => {
                  const id = slugName(name);
                  if (members.some((m) => m.id === id)) { notify("A member with this name already exists.", "error"); return; }
                  const next = [...members, { id, name: name.trim(), type }];
                  await persistMembers(next);
                  notify("Member added.");
                }}
                goToUpload={() => setActiveTab("upload")}
                canUpload={perms.upload}
              />
            )}

            {activeTab === "analytics" && perms.analytics && (
              <AnalyticsTab
                sheets={sheets}
                monthKeys={monthKeys}
                selectedMonth={selectedMonthKey}
                currentSheet={currentSheet}
                activeList={activeList}
                members={members}
                notify={notify}
              />
            )}

            {activeTab === "upload" && perms.upload && (
              <UploadTab
                onImport={async ({ monthKey, label, daysInMonth, records }) => {
                  // merge members
                  let nextMembers = [...members];
                  const mapNameToId = {};
                  nextMembers.forEach((m) => (mapNameToId[m.id] = true));
                  const sheetRecords = records.map((r) => {
                    const id = slugName(r.name);
                    if (!nextMembers.some((m) => m.id === id)) {
                      nextMembers.push({ id, name: r.name, type: "Member" });
                    }
                    return { memberId: id, days: r.days, total: r.total };
                  });
                  await persistMembers(nextMembers);
                  const nextSheets = { ...sheets, [monthKey]: { label, daysInMonth, records: sheetRecords } };
                  await persistSheets(nextSheets);
                  setSelectedMonth(monthKey);
                  setActiveTab("dashboard");
                  notify(`Imported ${sheetRecords.length} members for ${label}.`);
                }}
                existingMonthKeys={monthKeys}
              />
            )}

            {activeTab === "users" && isSuperadmin && (
              <UsersTab
                users={users}
                currentUser={currentUser}
                onSave={async (user) => {
                  const exists = users.some((u) => u.id === user.id);
                  const next = exists ? users.map((u) => (u.id === user.id ? user : u)) : [...users, user];
                  await persistUsers(next);
                  notify(exists ? "User updated." : "User created.");
                }}
                onDelete={async (id) => {
                  if (id === currentUser.id) { notify("You can't delete your own account.", "error"); return; }
                  const next = users.filter((u) => u.id !== id);
                  await persistUsers(next);
                  notify("User deleted.", "info");
                }}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard tab                                                      */
/* ------------------------------------------------------------------ */
function DashboardTab({ currentSheet, activeList, monthKeys, members, canEdit, canDelete, onUpdateMember, onDeleteMember, onAddMember, goToUpload, canUpload }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [editing, setEditing] = useState(null); // member id being edited
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const counts = useMemo(() => {
    const base = Object.fromEntries(TYPES.map((type) => [type, 0]));
    activeList.forEach((r) => { if (r.member) base[r.member.type] = (base[r.member.type] || 0) + 1; });
    return base;
  }, [activeList]);

  const filtered = useMemo(() => {
    return activeList
      .filter((r) => (typeFilter === "All" ? true : r.member.type === typeFilter))
      .filter((r) => r.member.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [activeList, typeFilter, search]);

  if (!monthKeys.length) {
    return (
      <div className="empty-state">
        <FileSpreadsheet size={40} />
        <h2>No attendance data yet</h2>
        <p>Upload a monthly Excel sheet to see your active members here.</p>
        {canUpload && <button className="btn btn--primary" onClick={goToUpload}><UploadCloud size={16} /> Upload data</button>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="stat-grid">
        <StatCard label="Total Active" value={activeList.length} color={COLORS.indigo} icon={<Users size={20} />} />
        <StatCard label="Members" value={counts.Member} color={TYPE_COLOR.Member} icon={<Users size={20} />} />
        <StatCard label="Students" value={counts.Student} color={TYPE_COLOR.Student} icon={<Users size={20} />} />
        <StatCard label="Staff" value={counts.Staff} color={TYPE_COLOR.Staff} icon={<Users size={20} />} />
        <StatCard label="Owners" value={counts.Owner} color={TYPE_COLOR.Owner} icon={<ShieldCheck size={20} />} />
      </div>

      <div className="panel">
        <div className="panel__head">
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search member name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-chips">
            {["All", ...TYPES].map((t) => (
              <button key={t} className={`chip ${typeFilter === t ? "chip--active" : ""}`} onClick={() => setTypeFilter(t)}>{t}</button>
            ))}
          </div>
          {canEdit && (
            <button className="btn btn--primary btn--sm" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Member</button>
          )}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Type</th><th>Times attended</th>{(canEdit || canDelete) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.memberId}>
                  <td>{i + 1}</td>
                  <td>{r.member.name}</td>
                  <td>
                    {editing === r.memberId ? (
                      <select
                        autoFocus
                        defaultValue={r.member.type}
                        onBlur={() => setEditing(null)}
                        onChange={(e) => { onUpdateMember(r.memberId, { type: e.target.value }); setEditing(null); }}
                      >
                        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : <Badge type={r.member.type} />}
                  </td>
                  <td><span className="pill">{r.total}</span></td>
                  {(canEdit || canDelete) && (
                    <td className="row-actions">
                      {canEdit && <button className="icon-btn" title="Edit type" onClick={() => setEditing(r.memberId)}><Pencil size={15} /></button>}
                      {canDelete && <button className="icon-btn icon-btn--danger" title="Delete member" onClick={() => setConfirmDelete(r.memberId)}><Trash2 size={15} /></button>}
                    </td>
                  )}
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={5} className="table-empty">No members match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <AddMemberModal onClose={() => setShowAdd(false)} onAdd={(name, type) => { onAddMember(name, type); setShowAdd(false); }} />
      )}

      {confirmDelete && (
        <Modal title="Remove member" onClose={() => setConfirmDelete(null)} width={380}>
          <p>Remove <strong>{members.find((m) => m.id === confirmDelete)?.name}</strong> and all their attendance history? This can't be undone.</p>
          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn btn--danger" onClick={() => { onDeleteMember(confirmDelete); setConfirmDelete(null); }}>Remove</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddMemberModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Member");
  return (
    <Modal title="Add member" onClose={onClose} width={380}>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onAdd(name, type); }} className="stack" style={{ gap: 14 }}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Full name" />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>Add member</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Analytics tab                                                       */
/* ------------------------------------------------------------------ */
function AnalyticsTab({ sheets, monthKeys, selectedMonth, currentSheet, activeList, notify }) {
  const [exporting, setExporting] = useState(false);
  const typeData = useMemo(() => {
    const base = Object.fromEntries(TYPES.map((type) => [type, 0]));
    activeList.forEach((r) => { base[r.member.type] = (base[r.member.type] || 0) + 1; });
    return TYPES.map((t) => ({ name: t, value: base[t] })).filter((d) => d.value > 0);
  }, [activeList]);

  const attendanceShare = useMemo(() => {
    const base = Object.fromEntries(TYPES.map((type) => [type, 0]));
    activeList.forEach((r) => { base[r.member.type] += r.total; });
    return TYPES.map((t) => ({ name: t, value: base[t] })).filter((d) => d.value > 0);
  }, [activeList]);

  const dailyTrend = useMemo(() => {
    if (!currentSheet) return [];
    const totals = Array.from({ length: currentSheet.daysInMonth }, (_, i) => ({ day: i + 1, attendance: 0 }));
    currentSheet.records.forEach((r) => {
      Object.entries(r.days).forEach(([day, val]) => {
        const idx = Number(day) - 1;
        if (totals[idx]) totals[idx].attendance += val;
      });
    });
    return totals;
  }, [currentSheet]);

  const monthlyTrend = useMemo(() => {
    return [...monthKeys].reverse().map((k) => ({
      month: sheets[k].label,
      total: sheets[k].records.reduce((s, r) => s + r.total, 0),
      members: sheets[k].records.length,
    }));
  }, [monthKeys, sheets]);

  if (!currentSheet) {
    return (
      <div className="empty-state">
        <BarChart3 size={40} />
        <h2>No data to analyze yet</h2>
        <p>Upload a monthly sheet first to unlock charts.</p>
      </div>
    );
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { downloadAttendanceWorkbook } = await import("./exportWorkbook.js");
      downloadAttendanceWorkbook({
        label: sheets[selectedMonth]?.label || selectedMonth,
        daysInMonth: currentSheet.daysInMonth,
        records: activeList,
      });
      notify("Excel attendance report exported.");
    } catch (error) {
      console.error("Excel export failed.", error);
      notify("Could not export the Excel report.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="stack">
      <div className="analytics-toolbar">
        <div>
          <h2>{sheets[selectedMonth]?.label} analytics</h2>
          <p className="muted">Export the selected month with member types and daily attendance.</p>
        </div>
        <button className="btn btn--primary" onClick={handleExport} disabled={exporting}>
          <Download size={16} />
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </div>
      <div className="chart-grid">
        <div className="panel chart-card">
          <h3>Active members by type</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                {typeData.map((d) => <Cell key={d.name} fill={TYPE_COLOR[d.name]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-card">
          <h3>Attendance share by type</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={attendanceShare} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                {attendanceShare.map((d) => <Cell key={d.name} fill={TYPE_COLOR[d.name]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel chart-card">
        <h3>Daily attendance — {sheets[selectedMonth]?.label}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dailyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.platinum} />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="attendance" stroke={COLORS.punch} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel chart-card">
        <h3>Month-over-month attendance</h3>
        {monthlyTrend.length > 1 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.platinum} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" name="Total check-ins" stroke={COLORS.indigo} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="members" name="Active members" stroke={COLORS.lavender} strokeWidth={2.5} dot={{ r: 3 }} />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted">Upload at least two months of data to see a month-over-month trend.</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload tab                                                          */
/* ------------------------------------------------------------------ */
function UploadTab({ onImport, existingMonthKeys }) {
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState("");
  const [monthName, setMonthName] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(file) {
    setError("");
    setParsed(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const workbookResult = await readXlsxFile(file);
      const result = parseWorkbookRows(firstSheetRows(workbookResult));
      setParsed(result);
      setMonthName(result.guessMonth != null ? MONTH_NAMES[result.guessMonth] : "");
      setYear(result.guessYear ? String(result.guessYear) : "");
    } catch (e) {
      setError(e.message || "Could not read this file.");
    }
  }

  const monthIdx = MONTH_NAMES.indexOf(monthName);
  const monthKey = monthIdx >= 0 && year ? `${year}-${String(monthIdx + 1).padStart(2, "0")}` : null;
  const label = monthIdx >= 0 && year ? `${MONTH_NAMES[monthIdx]} ${year}` : "";
  const willOverwrite = monthKey && existingMonthKeys.includes(monthKey);

  return (
    <div className="stack">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Import a monthly sheet</h3>
        <p className="muted">Upload the Daily Active Member List (.xlsx). We'll detect member names, daily check-ins, and totals automatically.</p>

        <div
          className={`dropzone ${dragOver ? "dropzone--over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud size={28} />
          <p><strong>Click to upload</strong> or drag and drop</p>
          <span className="muted">.xlsx files only</span>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>

        {fileName && !error && <p className="muted">Selected: {fileName}</p>}
        {error && <div className="form-error"><AlertTriangle size={14} />{error}</div>}

        {parsed && (
          <div className="stack" style={{ marginTop: 16 }}>
            <div className="grid-2">
              <label className="field">
                <span>Month</span>
                <select value={monthName} onChange={(e) => setMonthName(e.target.value)}>
                  <option value="">Select month</option>
                  {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Year</span>
                <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2026" />
              </label>
            </div>

            {willOverwrite && (
              <div className="notice notice--warn"><AlertTriangle size={16} /> A sheet for {label} already exists. Importing will overwrite it.</div>
            )}

            <div className="table-wrap" style={{ maxHeight: 260 }}>
              <table className="table">
                <thead><tr><th>#</th><th>Name</th><th>Total times</th></tr></thead>
                <tbody>
                  {parsed.records.slice(0, 8).map((r, i) => (
                    <tr key={i}><td>{i + 1}</td><td>{r.name}</td><td>{r.total}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">{parsed.records.length} member rows detected across {parsed.daysInMonth} days.</p>

            <div className="modal__actions" style={{ justifyContent: "flex-start" }}>
              <button
                className="btn btn--primary"
                disabled={!monthKey}
                onClick={() => onImport({ monthKey, label, daysInMonth: parsed.daysInMonth, records: parsed.records })}
              >
                <UploadCloud size={16} /> Confirm &amp; Save
              </button>
              <button className="btn btn--ghost" onClick={() => { setParsed(null); setFileName(""); }}>Start over</button>
            </div>
          </div>
        )}
      </div>

      {existingMonthKeys.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Uploaded months</h3>
          <div className="filter-chips">
            {existingMonthKeys.map((k) => <span key={k} className="chip">{k}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  User management tab (superadmin only)                              */
/* ------------------------------------------------------------------ */
function UsersTab({ users, currentUser, onSave, onDelete }) {
  const [editUser, setEditUser] = useState(null); // {} for new, object for edit, null closed
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel__head">
          <p className="muted" style={{ margin: 0 }}>As the main admin, you control which pages each admin account can access.</p>
          <button className="btn btn--primary btn--sm" onClick={() => setEditUser({ new: true })}><Plus size={16} /> Add user</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Access</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.username}</td>
                  <td>{u.role === "superadmin" ? <span className="pill pill--indigo"><ShieldCheck size={12} /> Main Admin</span> : "Admin"}</td>
                  <td>
                    {u.role === "superadmin" ? "Full access" : (
                      <div className="perm-tags">
                        {Object.entries(u.permissions || {}).filter(([, v]) => v).map(([k]) => <span key={k} className="chip chip--sm">{k}</span>)}
                        {!Object.values(u.permissions || {}).some(Boolean) && <span className="muted">No access granted</span>}
                      </div>
                    )}
                  </td>
                  <td className="row-actions">
                    <button className="icon-btn" title="Edit" onClick={() => setEditUser(u)}><Pencil size={15} /></button>
                    {u.id !== currentUser.id && (
                      <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => setConfirmDelete(u.id)}><Trash2 size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editUser && (
        <UserEditModal
          user={editUser.new ? null : editUser}
          onClose={() => setEditUser(null)}
          onSave={async (u) => { await onSave(u); setEditUser(null); }}
          usernameTaken={(name, id) => users.some((u) => u.username.toLowerCase() === name.toLowerCase() && u.id !== id)}
        />
      )}

      {confirmDelete && (
        <Modal title="Delete user" onClose={() => setConfirmDelete(null)} width={380}>
          <p>Delete <strong>{users.find((u) => u.id === confirmDelete)?.displayName}</strong>'s account? They'll immediately lose access.</p>
          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn btn--danger" onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const PERM_LABELS = {
  dashboard: "View dashboard",
  analytics: "View analytics",
  upload: "Upload monthly data",
  editMembers: "Edit member types",
  deleteMembers: "Delete members",
};

function UserEditModal({ user, onClose, onSave, usernameTaken }) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState(user?.permissions || DEFAULT_PERMS);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!displayName.trim() || !username.trim()) { setError("Name and username are required."); return; }
    if (usernameTaken(username.trim(), user?.id)) { setError("That username is already in use."); return; }
    if (!user && !password) { setError("Set a password for the new account."); return; }
    setSaving(true);
    const passwordHash = password ? await hashText(password) : user.passwordHash;
    setSaving(false);
    onSave({
      id: user?.id || uid("usr"),
      displayName: displayName.trim(),
      username: username.trim(),
      passwordHash,
      role: user?.role || "admin",
      permissions: user?.role === "superadmin" ? FULL_PERMS : permissions,
      createdAt: user?.createdAt || Date.now(),
    });
  }

  return (
    <Modal title={user ? "Edit user" : "Add user"} onClose={onClose} width={460}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 14 }}>
        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span>{user ? "New password (leave blank to keep current)" : "Password"}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>

        {user?.role !== "superadmin" && (
          <div className="field">
            <span>Page access</span>
            <div className="perm-list">
              {Object.entries(PERM_LABELS).map(([key, label]) => (
                <label key={key} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!permissions[key]}
                    onChange={(e) => setPermissions((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div className="form-error"><AlertTriangle size={14} />{error}</div>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? "Saving…" : "Save user"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Global CSS                                                          */
/* ------------------------------------------------------------------ */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

:root{
  --indigo:${COLORS.indigo};
  --lavender:${COLORS.lavender};
  --platinum:${COLORS.platinum};
  --punch:${COLORS.punch};
  --flag:${COLORS.flag};
}

*{box-sizing:border-box;}
html,body,#root{margin:0;min-height:100%;}
.app-root, .login-screen, .boot{
  font-family:'Inter',system-ui,sans-serif;
  color:var(--indigo);
  background:var(--platinum);
}
h1,h2,h3{font-family:'Sora',system-ui,sans-serif;letter-spacing:-0.01em;}

/* ---- boot ---- */
.boot{height:100vh;display:flex;align-items:center;justify-content:center;}
.boot__spinner{width:36px;height:36px;border-radius:50%;border:3px solid #dfe4e8;border-top-color:var(--punch);animation:spin 0.8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* ---- login ---- */
.login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:radial-gradient(1100px 500px at 15% -10%, rgba(43,45,66,0.08), transparent),
             radial-gradient(900px 500px at 110% 10%, rgba(239,35,60,0.10), transparent),
             var(--platinum);}
.login-card{width:100%;max-width:400px;background:#fff;border-radius:18px;padding:32px 28px;box-shadow:0 20px 50px rgba(43,45,66,0.12);border:1px solid #e3e8eb;}
.login-card__brand{display:flex;align-items:center;gap:12px;margin-bottom:22px;}
.login-card__logo{width:44px;height:44px;border-radius:12px;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Sora';font-weight:800;font-size:15px;}
.login-card__title{font-family:'Sora';font-weight:700;font-size:17px;}
.login-card__subtitle{color:var(--lavender);font-size:13px;}
.login-form{display:flex;flex-direction:column;gap:16px;margin-top:6px;}

/* ---- fields ---- */
.field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:var(--indigo);}
.field input, .field select{
  font-family:inherit;font-size:14px;font-weight:500;color:var(--indigo);
  padding:10px 12px;border-radius:9px;border:1.5px solid #dfe4e8;background:#fff;outline:none;transition:border-color .15s;
}
.field input:focus, .field select:focus{border-color:var(--punch);}
.pw-wrap{position:relative;}
.pw-wrap input{width:100%;padding-right:38px;}
.pw-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--lavender);cursor:pointer;padding:4px;}

.notice{display:flex;gap:10px;align-items:flex-start;background:#eef4ff;border:1px solid #cfe0ff;color:var(--indigo);padding:12px 14px;border-radius:10px;font-size:13px;line-height:1.5;margin-bottom:16px;}
.notice--warn{background:#fff4e5;border-color:#ffdca8;}
.form-error{display:flex;gap:6px;align-items:center;color:var(--flag);font-size:13px;font-weight:600;}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;font-weight:700;font-size:14px;padding:10px 16px;border-radius:9px;border:none;cursor:pointer;transition:filter .15s, transform .1s;}
.btn:active{transform:translateY(1px);}
.btn:disabled{opacity:0.5;cursor:not-allowed;}
.btn--primary{background:var(--punch);color:#fff;}
.btn--primary:hover:not(:disabled){filter:brightness(0.94);}
.btn--ghost{background:transparent;color:var(--indigo);border:1.5px solid #dfe4e8;}
.btn--ghost:hover{background:#f4f6f7;}
.btn--danger{background:var(--flag);color:#fff;}
.btn--danger:hover{filter:brightness(0.94);}
.btn--block{width:100%;}
.btn--sm{padding:8px 12px;font-size:13px;}

/* ---- layout ---- */
.layout{display:flex;min-height:100vh;}
.overlay{position:fixed;inset:0;background:rgba(20,20,30,.45);z-index:900;display:none;}
.overlay.show{display:block;}

.sidebar{
  width:258px;background:var(--indigo);color:#fff;flex-shrink:0;
  position:fixed;top:0;left:0;height:100vh;z-index:1000;
  display:flex;flex-direction:column;transform:translateX(-100%);transition:transform .28s ease;
  overflow-y:auto;
}
.sidebar.open{transform:translateX(0);}
.sidebar__brand{display:flex;align-items:center;gap:12px;padding:22px 18px 18px;position:relative;}
.sidebar__logo{width:38px;height:38px;border-radius:10px;background:var(--punch);display:flex;align-items:center;justify-content:center;font-family:'Sora';font-weight:800;font-size:14px;flex-shrink:0;}
.sidebar__title{font-family:'Sora';font-weight:700;font-size:15px;}
.sidebar__subtitle{font-size:11.5px;color:var(--lavender);}
.sidebar__close{position:absolute;right:12px;top:18px;}

.sidebar__nav{display:flex;flex-direction:column;gap:2px;padding:10px 12px;flex:1;}
.nav-item{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;background:transparent;border:none;color:#c9cee0;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;text-align:left;transition:background .15s,color .15s;}
.nav-item:hover{background:rgba(255,255,255,0.07);color:#fff;}
.nav-item.active{background:var(--punch);color:#fff;}

.sidebar__footer{padding:14px 12px 18px;border-top:1px solid rgba(255,255,255,0.08);}
.sidebar__user{display:flex;align-items:center;gap:10px;padding:10px 8px 14px;}
.sidebar__avatar{width:34px;height:34px;border-radius:50%;background:var(--lavender);color:var(--indigo);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;}
.sidebar__user-name{font-size:13.5px;font-weight:700;}
.sidebar__user-role{font-size:11.5px;color:var(--lavender);}

.main{flex:1;min-width:0;display:flex;flex-direction:column;}
.topbar{display:flex;align-items:center;gap:14px;padding:16px 22px;background:#fff;border-bottom:1px solid #e3e8eb;position:sticky;top:0;z-index:80;}
.topbar__title{font-size:19px;font-weight:700;}
.topbar__spacer{flex:1;}
.hamburger{display:inline-flex;}
.content{padding:22px;flex:1;}

.month-select{display:flex;align-items:center;gap:6px;border:1.5px solid #dfe4e8;border-radius:9px;padding:7px 10px;background:#fff;}
.month-select select{border:none;outline:none;font-family:inherit;font-weight:600;font-size:13.5px;color:var(--indigo);background:transparent;}

@media (min-width: 960px){
  .sidebar{position:sticky;transform:none;}
  .sidebar .sidebar__close{display:none;}
  .overlay{display:none !important;}
  .topbar .hamburger{display:none;}
  .content{padding:28px 32px;}
}

/* ---- icon buttons ---- */
.icon-btn{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:none;background:transparent;color:var(--indigo);cursor:pointer;transition:background .15s;}
.icon-btn:hover{background:#eef1f3;}
.icon-btn--light{color:#fff;}
.icon-btn--light:hover{background:rgba(255,255,255,0.1);}
.icon-btn--danger:hover{background:#fde7e9;color:var(--flag);}

/* ---- stat cards ---- */
.stack{display:flex;flex-direction:column;gap:20px;}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;}
.stat-card{background:#fff;border:1px solid #e3e8eb;border-radius:14px;padding:16px;display:flex;align-items:center;gap:12px;}
.stat-card__icon{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.stat-card__value{font-family:'Sora';font-weight:800;font-size:22px;line-height:1;}
.stat-card__label{color:var(--lavender);font-size:12.5px;font-weight:600;margin-top:4px;}

/* ---- panel / table ---- */
.panel{background:#fff;border:1px solid #e3e8eb;border-radius:14px;padding:18px;}
.panel__head{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:14px;}
.search-box{display:flex;align-items:center;gap:8px;border:1.5px solid #dfe4e8;border-radius:9px;padding:8px 12px;flex:1;min-width:180px;color:var(--lavender);}
.search-box input{border:none;outline:none;font-family:inherit;font-size:13.5px;color:var(--indigo);width:100%;background:transparent;}
.filter-chips{display:flex;gap:6px;flex-wrap:wrap;}
.chip{border:1.5px solid #dfe4e8;background:#fff;color:var(--indigo);border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer;}
.chip--active{background:var(--indigo);color:#fff;border-color:var(--indigo);}
.chip--sm{padding:3px 9px;font-size:11px;cursor:default;background:var(--platinum);}

.table-wrap{overflow-x:auto;}
.table{width:100%;border-collapse:collapse;font-size:13.5px;}
.table th{text-align:left;color:var(--lavender);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;padding:10px 12px;border-bottom:1.5px solid #eef1f3;white-space:nowrap;}
.table td{padding:11px 12px;border-bottom:1px solid #f1f3f5;white-space:nowrap;}
.table tr:last-child td{border-bottom:none;}
.table-empty{text-align:center;color:var(--lavender);padding:26px !important;}
.row-actions{display:flex;gap:4px;}

.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;}
.pill{background:var(--platinum);padding:3px 10px;border-radius:999px;font-weight:700;font-size:12.5px;}
.pill--indigo{background:rgba(43,45,66,0.1);color:var(--indigo);display:inline-flex;align-items:center;gap:5px;}

/* ---- empty state ---- */
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:70px 20px;color:var(--lavender);}
.empty-state h2{color:var(--indigo);margin:6px 0 0;}
.empty-state svg{color:var(--lavender);}
.muted{color:var(--lavender);font-size:13px;}

/* ---- charts ---- */
.chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;}
.chart-card h3{margin:0 0 10px;font-size:15px;}
.analytics-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.analytics-toolbar h2{margin:0 0 4px;font-size:20px;}
.analytics-toolbar p{margin:0;}

/* ---- upload ---- */
.dropzone{border:2px dashed #cfd7dc;border-radius:14px;padding:36px 20px;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--lavender);cursor:pointer;transition:border-color .15s,background .15s;text-align:center;}
.dropzone:hover, .dropzone--over{border-color:var(--punch);background:#fff5f6;}
.dropzone svg{color:var(--punch);margin-bottom:6px;}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media (max-width:520px){.grid-2{grid-template-columns:1fr;}}

/* ---- modal ---- */
.modal-backdrop{position:fixed;inset:0;background:rgba(20,20,30,.5);display:flex;align-items:center;justify-content:center;padding:16px;z-index:1200;}
.modal{background:#fff;border-radius:16px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.25);}
.modal__head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #eef1f3;}
.modal__head h3{margin:0;font-size:16px;}
.modal__body{padding:20px;}
.modal__actions{display:flex;justify-content:flex-end;gap:10px;margin-top:6px;}

.perm-list{display:flex;flex-direction:column;gap:9px;background:var(--platinum);border-radius:10px;padding:12px;}
.checkbox-row{display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:500;color:var(--indigo);cursor:pointer;}
.perm-tags{display:flex;gap:4px;flex-wrap:wrap;}

/* ---- toast ---- */
.toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2000;background:var(--indigo);color:#fff;padding:11px 16px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:600;box-shadow:0 12px 30px rgba(0,0,0,.2);}
.toast--error{background:var(--flag);}
.toast--info{background:var(--lavender);color:var(--indigo);}
.toast__close{background:none;border:none;color:inherit;opacity:.8;cursor:pointer;margin-left:4px;}
`;
