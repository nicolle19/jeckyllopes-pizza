import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { loadAllSignups, saveSignups } from "./supabase.js";

const CLUB_NAME = "Jeckyllopes Run Club";

function getNextWednesdays(count = 26) {
  const results = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(today);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow <= 3 ? 3 - dow : 10 - dow));
  for (let i = 0; i < count; i++) {
    results.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return results;
}

function fmtDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtMonth(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function skey(date) {
  return date.toISOString().split("T")[0];
}

function generateICS(date, name) {
  const pad = n => String(n).padStart(2, "0");
  const y = date.getFullYear(), m = pad(date.getMonth() + 1), d = pad(date.getDate());
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jeckyllopes//EN",
    "BEGIN:VEVENT",
    `DTSTART:${y}${m}${d}T180000`, `DTEND:${y}${m}${d}T200000`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `SUMMARY:🍕 Bring Pizza - Jeckyllopes Run Club`,
    `DESCRIPTION:${name} is bringing pizza tonight!`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Don't forget pizza tomorrow! 🍕", "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Bring pizza tonight! 🍕", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(date, name) {
  const a = document.createElement("a");
  a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(generateICS(date, name));
  a.download = `pizza-${skey(date)}.ics`;
  a.click();
}

function buildCSV(weds, signups) {
  const rows = [["Date", "Name", "Cell", "Signed Up At"]];
  for (const w of weds) {
    const list = signups[skey(w)] || [];
    if (!list.length) rows.push([fmtDate(w), "(no one)", "", ""]);
    else list.forEach(s => rows.push([fmtDate(w), s.name, s.cell, s.signedUpAt ? new Date(s.signedUpAt).toLocaleString() : ""]));
  }
  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// ─── Signup / Remove Panel ────────────────────────────────────────────────────
function SignupPanel({ mode, list, onDone, onCancel }) {
  const [name, setName] = useState("");
  const [cell, setCell] = useState("");
  const [error, setError] = useState("");

  function handleClick() {
    setError("");
    const n = name.trim(), c = cell.trim();
    if (mode === "signup") {
      if (!n) { setError("Please enter your name."); return; }
      if (!c) { setError("Please enter your cell number."); return; }
      if (list.find(s => s.name.toLowerCase() === n.toLowerCase())) {
        setError(`${n} is already signed up!`); return;
      }
      onDone({ name: n, cell: c });
    } else {
      if (!n) { setError("Please enter your name."); return; }
      if (!list.find(s => s.name.toLowerCase() === n.toLowerCase())) {
        setError(`Couldn't find "${n}" on this list.`); return;
      }
      onDone({ name: n });
    }
  }

  const isSignup = mode === "signup";

  return (
    <div style={{
      marginTop: "10px", padding: "14px 16px",
      background: "#0d0d0d", borderRadius: "10px",
      border: `1px solid ${isSignup ? "#e74c3c" : "#444"}`,
    }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: "130px" }}>
          <div style={labelStyle}>Your Name</div>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleClick()}
            placeholder="Alex Johnson"
            style={inputStyle}
          />
        </div>
        {isSignup && (
          <div style={{ flex: 1, minWidth: "130px" }}>
            <div style={labelStyle}>Cell Number</div>
            <input
              value={cell}
              onChange={e => setCell(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleClick()}
              placeholder="555-867-5309"
              style={inputStyle}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={handleClick} style={{
            padding: "9px 16px",
            background: isSignup ? "#e74c3c" : "transparent",
            color: isSignup ? "#fff" : "#e74c3c",
            border: isSignup ? "none" : "1px solid #e74c3c",
            borderRadius: "7px", cursor: "pointer",
            fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap",
            fontFamily: "'Georgia', serif",
          }}>
            {isSignup ? "🍕 Sign Me Up!" : "Remove Me"}
          </button>
          <button onClick={onCancel} style={{
            padding: "9px 12px", background: "transparent",
            color: "#555", border: "1px solid #2a2a2a",
            borderRadius: "7px", cursor: "pointer", fontSize: "14px",
          }}>✕</button>
        </div>
      </div>
      {error && <div style={{ marginTop: "8px", color: "#e74c3c", fontSize: "13px" }}>{error}</div>}
    </div>
  );
}

// ─── Date Row ─────────────────────────────────────────────────────────────────
function DateRow({ wed, list, onUpdate }) {
  const [panel, setPanel] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const covered = list.length > 0;
  const k = skey(wed);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function handleDone(data) {
    let updated;
    if (panel === "signup") {
      updated = [...list, { name: data.name, cell: data.cell, signedUpAt: new Date().toISOString() }];
    } else {
      updated = list.filter(s => s.name.toLowerCase() !== data.name.toLowerCase());
    }
    // Optimistic update
    onUpdate(k, updated);
    setPanel(null);
    setExpanded(true);
    // Save to Supabase
    setSaving(true);
    await saveSignups(k, updated);
    setSaving(false);
    showToast(panel === "signup" ? `${data.name} signed up! 🍕` : `${data.name} removed.`);
  }

  return (
    <div style={{
      background: "#141414",
      border: `1px solid ${covered ? "#1e3a1e" : "#252525"}`,
      borderRadius: "10px",
      borderLeft: `3px solid ${covered ? "#27ae60" : "#c0392b"}`,
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", padding: "13px 14px", gap: "10px" }}>
        <div style={{
          width: "9px", height: "9px", borderRadius: "50%", flexShrink: 0,
          background: covered ? "#27ae60" : "#c0392b",
          boxShadow: covered ? "0 0 6px rgba(39,174,96,0.5)" : "0 0 6px rgba(192,57,43,0.4)",
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "#f0ebe0" }}>{fmtDate(wed)}</div>
          <div style={{
            fontSize: "12px", fontFamily: "monospace", marginTop: "2px",
            color: covered ? "#27ae60" : "#884444",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {saving ? "Saving…" : covered ? list.map(s => s.name).join(" · ") : "No one signed up yet"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button onClick={() => { setPanel(panel === "signup" ? null : "signup"); setExpanded(true); }} style={{
            padding: "7px 13px", background: "#e74c3c", color: "#fff",
            border: "none", borderRadius: "7px", cursor: "pointer",
            fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap",
          }}>+ Sign Up</button>
          {covered && (
            <button onClick={() => { setExpanded(e => !e); setPanel(null); }} style={{
              padding: "7px 11px", background: "transparent", color: "#777",
              border: "1px solid #2a2a2a", borderRadius: "7px", cursor: "pointer", fontSize: "13px",
            }}>
              {expanded ? "▲" : `▼ ${list.length}`}
            </button>
          )}
        </div>
      </div>

      {(expanded || panel) && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid #1e1e1e" }}>
          {toast && (
            <div style={{
              marginTop: "10px", padding: "10px 14px", borderRadius: "8px",
              background: "rgba(39,174,96,0.12)", border: "1px solid #27ae60",
              color: "#2ecc71", fontSize: "13px",
            }}>{toast}</div>
          )}
          {covered && (
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "7px" }}>
              {list.map((s, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 12px", background: "#1a1a1a", borderRadius: "8px",
                  border: "1px solid #222", flexWrap: "wrap", gap: "8px",
                }}>
                  <div>
                    <span style={{ color: "#e74c3c", fontFamily: "monospace", fontSize: "12px", marginRight: "8px" }}>#{i + 1}</span>
                    <span style={{ color: "#f0ebe0", fontWeight: "600" }}>{s.name}</span>
                    <span style={{ color: "#484848", marginLeft: "10px", fontSize: "13px" }}>{s.cell}</span>
                  </div>
                  <button onClick={() => downloadICS(wed, s.name)} style={{
                    padding: "5px 10px", background: "transparent", color: "#555",
                    border: "1px solid #2a2a2a", borderRadius: "6px", cursor: "pointer",
                    fontSize: "11px", fontFamily: "monospace",
                  }}>📅 Add to Cal</button>
                </div>
              ))}
            </div>
          )}
          {panel && (
            <SignupPanel mode={panel} list={list} onDone={handleDone} onCancel={() => setPanel(null)} />
          )}
          {expanded && !panel && covered && (
            <div style={{ marginTop: "10px", textAlign: "right" }}>
              <button onClick={() => setPanel("remove")} style={{
                background: "none", border: "none", color: "#884444",
                cursor: "pointer", fontSize: "12px", fontFamily: "monospace",
                textDecoration: "underline",
              }}>Remove my name</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const allWeds = getNextWednesdays(52);
  const [signups, setSignups] = useState(() => Object.fromEntries(allWeds.map(w => [skey(w), []])));
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [csvModal, setCsvModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);

  useEffect(() => {
    (async () => {
      const keys = allWeds.map(w => skey(w));
      const data = await loadAllSignups(keys);
      setSignups(prev => ({ ...prev, ...data }));
      setLoading(false);
    })();
  }, []);

  const handleUpdate = useCallback((k, updated) => {
    setSignups(prev => ({ ...prev, [k]: updated }));
  }, []);

  const scopedWeds = monthFilter === "all" ? allWeds : allWeds.filter(w => skey(w).substring(0, 7) === monthFilter);
  const coveredCount = scopedWeds.filter(w => (signups[skey(w)] || []).length > 0).length;
  const openCount = scopedWeds.length - coveredCount;

  // Unique months for the dropdown
  const monthOptions = [...new Map(allWeds.map(w => [skey(w).substring(0, 7), fmtMonth(w)])).entries()];

  const filtered = allWeds.filter(w => {
    const cnt = (signups[skey(w)] || []).length;
    const matchesStatus = filter === "all" || (filter === "needs" && cnt === 0) || (filter === "covered" && cnt > 0);
    const matchesMonth = monthFilter === "all" || skey(w).substring(0, 7) === monthFilter;
    return matchesStatus && matchesMonth;
  });

  const byMonth = [];
  let lastM = null;
  for (const w of filtered) {
    const m = fmtMonth(w);
    if (m !== lastM) { byMonth.push({ m, dates: [] }); lastM = m; }
    byMonth[byMonth.length - 1].dates.push(w);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", fontFamily: "'Georgia', serif", color: "#f5f0e8" }}>
      {/* Marquee banner */}
      <style>{`
        @keyframes saveArtScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div style={{
        height: "34px", background: "#0f0f0f",
        borderBottom: "1px solid #2a1512", overflow: "hidden",
        display: "flex", alignItems: "center", whiteSpace: "nowrap",
      }}>
        <div style={{
          display: "inline-flex", flexShrink: 0,
          animation: "saveArtScroll 18s linear infinite",
          willChange: "transform",
        }}>
          {Array.from({ length: 2 }).map((_, g) => (
            <span key={g} aria-hidden={g === 1 ? "true" : undefined} style={{ display: "inline-flex", flexShrink: 0 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} style={{
                  fontSize: "16px", fontWeight: "bold", letterSpacing: "3px",
                  textTransform: "uppercase", color: "#ff6b35",
                  textShadow: "0 0 12px rgba(231,76,60,0.5)",
                  padding: "0 32px",
                }}>
                  🏃 Run 🍕 Pizza 🍺 Beer 🔄 Repeat
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #c0392b, #e74c3c 50%, #ff6b35)",
        padding: "28px 24px 22px", textAlign: "center", borderBottom: "4px solid #ff6b35",
        position: "relative", overflow: "hidden",
      }}>
        {/* Jackalope left (facing inward) */}
        <img src="/jackalope.jpg" alt="" aria-hidden="true" style={{
          position: "absolute", left: 0, bottom: 0,
          height: "140px", width: "auto",
          opacity: 0.18,
          transform: "scaleX(-1)",
          maskImage: "linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)",
          pointerEvents: "none",
        }} />
        {/* Jackalope right (mirror, facing inward) */}
        <img src="/jackalope.jpg" alt="" aria-hidden="true" style={{
          position: "absolute", right: 0, bottom: 0,
          height: "140px", width: "auto",
          opacity: 0.18,
          maskImage: "linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "40px", marginBottom: "4px" }}>🍕</div>
          <h1 style={{ margin: "0 0 4px", fontSize: "clamp(20px,5vw,30px)", fontWeight: "bold", textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            {CLUB_NAME}
          </h1>
          <p style={{ margin: 0, fontSize: "clamp(13px,3vw,16px)", opacity: 0.9, fontStyle: "italic" }}>
            Wednesday Night Pizza Sign-Up
          </p>
          <button onClick={() => setQrModal(true)} style={{
            marginTop: "10px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: "8px", color: "#fff", cursor: "pointer",
            fontSize: "12px", fontFamily: "monospace", padding: "5px 12px",
            opacity: 0.8,
          }}>
            📱 Share QR Code
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 16px 56px", position: "relative" }}>
        {/* Watermark */}
        <img src="/jackalope.jpg" alt="" aria-hidden="true" style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          height: "420px", width: "auto",
          opacity: 0.04,
          pointerEvents: "none", zIndex: 0,
          userSelect: "none",
        }} />
        {loading ? (
          <div style={{ textAlign: "center", color: "#555", padding: "80px", fontFamily: "monospace", position: "relative", zIndex: 1 }}>
            Loading signups…
          </div>
        ) : (
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Filters */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
              {/* Status pills */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                {[
                  { k: "all", icon: "📋", label: "All", n: scopedWeds.length },
                  { k: "needs", icon: "🔴", label: "Needs Coverage", n: openCount },
                  { k: "covered", icon: "🟢", label: "Covered", n: coveredCount },
                ].map(f => (
                  <button key={f.k} onClick={() => setFilter(f.k)} style={{
                    padding: "8px 14px", borderRadius: "20px",
                    border: filter === f.k ? "2px solid #e74c3c" : "2px solid #252525",
                    background: filter === f.k ? "#e74c3c" : "#181818",
                    color: filter === f.k ? "#fff" : "#777",
                    cursor: "pointer", fontSize: "13px", fontFamily: "monospace",
                    fontWeight: filter === f.k ? "bold" : "normal", whiteSpace: "nowrap",
                  }}>
                    {f.icon} {f.label} ({f.n})
                  </button>
                ))}
              </div>
              {/* Month/year dropdown */}
              <select
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                style={{
                  padding: "7px 14px", borderRadius: "20px",
                  border: monthFilter !== "all" ? "2px solid #e74c3c" : "2px solid #252525",
                  background: "#181818", color: monthFilter !== "all" ? "#fff" : "#777",
                  cursor: "pointer", fontSize: "13px", fontFamily: "monospace",
                  outline: "none", appearance: "none", WebkitAppearance: "none",
                  paddingRight: "28px",
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23555'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
                }}
              >
                <option value="all">📅 All Months</option>
                {monthOptions.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Date list */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "#555", padding: "60px", fontFamily: "monospace" }}>
                {filter === "needs" ? "🎉 Every date is covered!" : "No covered dates yet."}
              </div>
            ) : (
              byMonth.map(({ m, dates }) => (
                <div key={m} style={{ marginBottom: "32px" }}>
                  <div style={{
                    fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase",
                    color: "#444", fontFamily: "monospace", marginBottom: "12px",
                    paddingBottom: "6px", borderBottom: "1px solid #1c1c1c",
                  }}>{m}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {dates.map(wed => (
                      <DateRow key={skey(wed)} wed={wed} list={signups[skey(wed)] || []} onUpdate={handleUpdate} />
                    ))}
                  </div>
                </div>
              ))
            )}

            <div style={{ marginTop: "32px", textAlign: "center", color: "#2e2e2e", fontSize: "11px", fontFamily: "monospace", lineHeight: "2" }}>
              <div>🏃 Jeckyllopes Run Club · Every Wednesday Night</div>
              <div>{scopedWeds.length} Wednesdays · {coveredCount} covered · {openCount} open</div>
              <div style={{ marginTop: "8px" }}>
                <button onClick={() => setCsvModal(true)} style={{
                  background: "none", border: "none", color: "#333",
                  cursor: "pointer", fontSize: "11px", fontFamily: "monospace",
                  textDecoration: "underline", padding: 0,
                }}>export csv</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "16px",
        }} onClick={() => setQrModal(false)}>
          <div style={{
            background: "#1a1a1a", border: "1px solid #333", borderRadius: "16px",
            padding: "32px 28px", textAlign: "center", maxWidth: "320px", width: "100%",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "6px" }}>📱 Scan to Sign Up</div>
            <div style={{ fontSize: "12px", color: "#666", fontFamily: "monospace", marginBottom: "20px" }}>
              Share with the club
            </div>
            <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", display: "inline-block" }}>
              <QRCodeSVG value={window.location.href} size={200} />
            </div>
            <div style={{ marginTop: "16px", fontSize: "11px", color: "#444", fontFamily: "monospace", wordBreak: "break-all" }}>
              {window.location.href}
            </div>
            <button onClick={() => setQrModal(false)} style={{
              marginTop: "20px", padding: "10px 24px", background: "transparent",
              border: "1px solid #333", borderRadius: "8px", color: "#666",
              cursor: "pointer", fontSize: "14px", width: "100%",
            }}>Close</button>
          </div>
        </div>
      )}

      {/* CSV Modal */}
      {csvModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "16px",
        }}>
          <div style={{
            background: "#1a1a1a", border: "1px solid #333", borderRadius: "12px",
            padding: "24px", width: "100%", maxWidth: "600px",
            maxHeight: "80vh", display: "flex", flexDirection: "column", gap: "16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: "16px" }}>📋 Export CSV</div>
              <button onClick={() => setCsvModal(false)} style={{
                background: "transparent", border: "none", color: "#888",
                fontSize: "20px", cursor: "pointer", lineHeight: 1,
              }}>✕</button>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#777" }}>
              Select all and copy the text below, then paste into a spreadsheet or save as a .csv file.
            </p>
            <textarea
              readOnly
              value={buildCSV(allWeds, signups)}
              onClick={e => e.target.select()}
              style={{
                flex: 1, minHeight: "260px", background: "#0d0d0d", border: "1px solid #333",
                borderRadius: "8px", color: "#aaa", fontSize: "12px", fontFamily: "monospace",
                padding: "12px", resize: "vertical", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { const ta = document.querySelector("textarea"); ta.select(); document.execCommand("copy"); }} style={{
                padding: "10px 20px", background: "#e74c3c", color: "#fff", border: "none",
                borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px",
                fontFamily: "'Georgia', serif", flex: 1,
              }}>Copy All</button>
              <button onClick={() => setCsvModal(false)} style={{
                padding: "10px 16px", background: "transparent", color: "#666",
                border: "1px solid #333", borderRadius: "8px", cursor: "pointer", fontSize: "14px",
              }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  fontSize: "10px", color: "#666", marginBottom: "4px",
  letterSpacing: "1px", textTransform: "uppercase", fontFamily: "monospace",
};
const inputStyle = {
  width: "100%", padding: "9px 12px", background: "#1a1a1a",
  border: "1px solid #333", borderRadius: "7px", color: "#f5f0e8",
  fontSize: "14px", outline: "none", boxSizing: "border-box",
  fontFamily: "'Georgia', serif",
};
