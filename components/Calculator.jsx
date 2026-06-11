"use client";

import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────
// PROOF-OF-VALUE CALCULATOR — sales enablement for staffing agencies
//
// User: the agency's AE / sales manager, live on a discovery call.
// Flow: AE enters the prospect's numbers -> the cost gap appears on
// screen -> AI builds a placement plan + a ready-to-send follow-up.
// The agency configures its own hubs and rates (white-label).
//
// JS owns the money math; Claude owns the reasoning.
// In-chat demo calls the Claude API via claude.ai's proxy.
// Vercel deploy: move fetch to a server route, key from env,
// model -> "claude-sonnet-4-6".
// ─────────────────────────────────────────────────────────────

const C = {
  ink: "#0E1525", surface: "#FFFFFF", paper: "#F6F7F9", muted: "#6B7280",
  line: "#E6E8EC", shock: "#C2410C", save: "#0F766E", brand: "#1D4ED8",
};
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const STATES = {
  "California": 0.093, "New York": 0.092, "Texas": 0.086, "Washington": 0.096,
  "Massachusetts": 0.095, "Florida": 0.085, "Colorado": 0.091, "Illinois": 0.089,
  "New Jersey": 0.094, "Other / custom": 0.090,
};
const SEN = { Mid: 95000, Senior: 120000, Lead: 165000 };
const TITLES = ["Frontend", "Backend", "Full-stack", "Mobile", "UI/UX Designer", "Architect", "DevOps", "Product Owner", "QA"];

// The agency's delivery hubs — its own rate card (editable, white-label).
// factor = all-in annual cost as a fraction of US base salary.
const DEFAULT_HUBS = [
  { key: "Poland",    flag: "🇵🇱", factor: 0.62, tz: "Afternoon overlap", on: true },
  { key: "Romania",   flag: "🇷🇴", factor: 0.58, tz: "Afternoon overlap", on: true },
  { key: "Ukraine",   flag: "🇺🇦", factor: 0.48, tz: "Afternoon overlap", on: true },
  { key: "Brazil",    flag: "🇧🇷", factor: 0.45, tz: "Full US hours",     on: true },
  { key: "Argentina", flag: "🇦🇷", factor: 0.40, tz: "Full US hours",     on: true },
  { key: "India",     flag: "🇮🇳", factor: 0.35, tz: "Night gap",         on: true },
];
const HUB_NOTES = {
  Poland: "Senior EU talent, strong process, GDPR.",
  Romania: "Strong seniority, EU, partial US overlap.",
  Ukraine: "Strong engineering, lower cost; confirm continuity.",
  Brazil: "US timezone alignment, large pool.",
  Argentina: "US timezone, strong English, cheaper than Brazil.",
  India: "Cheapest, largest pool; best for well-specified work.",
};

const usd = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));
const usdK = (n) => `$${Math.round(n / 1000)}K`;

const usCost = (salary, a) =>
  salary + salary * a.tax + salary * a.benefits + a.equipment + salary * a.recruit + (salary / 12) * a.ramp * 0.5;

let RID = 1;
const newRole = (title, sen) => ({ id: RID++, title, sen, salary: SEN[sen] });

export default function App() {
  // client card — who the AE is on the call with
  const [client, setClient] = useState("");
  const [roles, setRoles] = useState([newRole("Frontend", "Senior"), newRole("Backend", "Senior")]);
  const [a, setA] = useState({ state: "California", tax: STATES["California"], benefits: 0.22, equipment: 5000, recruit: 0.18, ramp: 3 });

  // agency setup — its own hubs & rates
  const [hubs, setHubs] = useState(DEFAULT_HUBS);
  const [showSetup, setShowSetup] = useState(false);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const activeHubs = hubs.filter((h) => h.on);
  const FACTOR = { US: 1 };
  hubs.forEach((h) => { FACTOR[h.key] = h.factor; });
  const FLAG = { US: "🇺🇸" };
  hubs.forEach((h) => { FLAG[h.key] = h.flag; });
  const regionCost = (salary, loc) => salary * FACTOR[loc];

  const setAssume = (patch) => { setA((x) => ({ ...x, ...patch })); setReport(null); };
  const pickState = (st) => setAssume({ state: st, tax: STATES[st] });
  const update = (id, patch) => { setRoles((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); setReport(null); };
  const remove = (id) => { setRoles((rs) => rs.filter((r) => r.id !== id)); setReport(null); };
  const add = () => { setRoles((rs) => [...rs, newRole("Full-stack", "Senior")]); setReport(null); };
  const setSen = (id, sen) => update(id, { sen, salary: SEN[sen] });
  const setHub = (key, patch) => { setHubs((hs) => hs.map((h) => (h.key === key ? { ...h, ...patch } : h))); setReport(null); };

  const allUS = roles.reduce((s, r) => s + usCost(r.salary, a), 0);
  const totalSalary = roles.reduce((s, r) => s + r.salary, 0);

  const hubRows = [
    { key: "US", flag: "🇺🇸", label: `In-house US (${a.state})`, cost: allUS, tz: "their team" },
    ...activeHubs.map((h) => ({ key: h.key, flag: h.flag, label: h.key, cost: totalSalary * h.factor, tz: h.tz })),
  ];
  const maxCost = Math.max(...hubRows.map((h) => h.cost));

  const buildPlan = (mix) => {
    const byId = {}; mix.forEach((m) => { byId[m.id] = m; });
    const valid = ["US", ...activeHubs.map((h) => h.key)];
    const fallback = activeHubs[0] ? activeHubs[0].key : "US";
    let recommended = 0;
    const rows = roles.map((r) => {
      const m = byId[r.id] || { location: fallback, rationale: "" };
      const loc = valid.includes(m.location) ? m.location : fallback;
      const cost = loc === "US" ? usCost(r.salary, a) : regionCost(r.salary, loc);
      recommended += cost;
      return { ...r, loc, cost, rationale: m.rationale || "" };
    });
    const savings = Math.max(0, allUS - recommended);
    return { rows, recommended, savings };
  };

  const generate = async () => {
    if (activeHubs.length === 0) { setErr("Turn on at least one hub in Agency setup."); return; }
    setLoading(true); setErr(""); setReport(null);
    const roleData = roles.map((r) => {
      const regions = {};
      activeHubs.forEach((g) => { regions[g.key] = Math.round(regionCost(r.salary, g.key)); });
      return { id: r.id, label: `${r.sen} ${r.title}`, usYear1: Math.round(usCost(r.salary, a)), regions };
    });
    const hubProfiles = activeHubs.map((g) => `${g.key}: ${g.tz}; ${HUB_NOTES[g.key] || ""}`).join("\n");
    const prompt = `You are the placement strategist of a US staffing agency. An account executive is on a call with a prospect ("${client || "the client"}", hiring in ${a.state}) and needs a placement plan. For each role you have the year-one loaded US in-house cost (computed with the client's real state tax + benefit assumptions) and the agency's all-in annual rate at each delivery hub.

Roles: ${JSON.stringify(roleData)}

Agency delivery hubs:
${hubProfiles}

For EACH role choose the single best location from: "US", ${activeHubs.map((h) => `"${h.key}"`).join(", ")}. Balance cost against honest tradeoffs — timezone overlap, role sensitivity, seniority risk, continuity. Keep architecture-critical, customer-facing, or real-time-collaboration roles in the US or a high-overlap hub; route well-specified work to cheaper hubs. Do not send everything to the cheapest option — the AE must be able to defend this mix to the client's CFO.

Also write a short follow-up note the AE can paste into an email to the client after the call: 3 calm sentences, first person plural ("we"), no hype, summarizing the gap, the recommended mix, and proposing to show 2-3 vetted candidate profiles for the first role this week.

Return ONLY valid JSON (no markdown, no preamble) in this exact shape:
{
  "headline": "one calm sentence the AE can say out loud to summarize the plan",
  "mix": [{"id": <role id>, "location": "<one allowed location>", "rationale": "under 18 words"}],
  "objection": "the #1 objection the client will raise, and a one-sentence answer, under 35 words total",
  "followUp": "the 3-sentence follow-up email body",
  "tradeoffs": "one honest sentence about what the client gives up"
}`;
    try {
      const res = await fetch("/api/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("api");
      const data = await res.json();
      let text = (data.text || "").trim();
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(text);
      setReport({ ...parsed, ...buildPlan(parsed.mix || []) });
    } catch (e) { setErr("Couldn't generate the plan. Try again in a moment."); }
    finally { setLoading(false); }
  };

  const copyFollowUp = () => {
    if (!report) return;
    const lines = [
      `Subject: Your hiring plan — ${client || "follow-up"}`,
      "",
      report.followUp,
      "",
      "Recommended placement:",
      ...report.rows.map((r) => `· ${r.sen} ${r.title} → ${r.loc} (${usdK(r.cost)}/yr)`),
      "",
      `In-house US total: ${usd(allUS)} / year-one`,
      `With our plan: ${usd(report.recommended)} — saves ${usd(report.savings)} per year.`,
    ].join("\n");
    navigator.clipboard && navigator.clipboard.writeText(lines).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14 };
  const locColor = (loc) => (loc === "US" ? C.shock : C.save);

  return (
    <div style={{ fontFamily: SANS, color: C.ink, background: C.paper, padding: "28px 18px 40px", minHeight: "100%" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Top bar: white-label brand + agency setup */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.muted, textTransform: "uppercase" }}>
            Proof-of-Value · <span style={{ color: C.brand, fontWeight: 700 }}>Your Agency</span>
          </div>
          <button onClick={() => setShowSetup((v) => !v)}
            style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: showSetup ? C.ink : C.muted, background: showSetup ? C.line : "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
            ⚙ Agency setup
          </button>
        </div>

        {/* Agency setup — the agency's own hubs & rates */}
        {showSetup && (
          <div style={{ ...card, padding: 20, marginBottom: 16, borderColor: C.brand }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.brand, textTransform: "uppercase", marginBottom: 4 }}>
              Your delivery hubs & rate card
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
              Set once per agency. Rate = all-in annual cost to the client as % of an equivalent US base salary.
            </div>
            {hubs.map((h) => (
              <div key={h.key} style={{ display: "grid", gridTemplateColumns: "auto 1.2fr 1fr 1fr", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <input type="checkbox" checked={h.on} onChange={(e) => setHub(h.key, { on: e.target.checked })} style={{ accentColor: C.brand, width: 16, height: 16 }} />
                <div style={{ fontSize: 14, fontWeight: 600, opacity: h.on ? 1 : 0.4 }}>{h.flag} {h.key}</div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted, opacity: h.on ? 1 : 0.4 }}>{h.tz}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${C.line}`, borderRadius: 8, padding: "0 8px", opacity: h.on ? 1 : 0.4 }}>
                  <input type="number" step="1" value={Math.round(h.factor * 100)} disabled={!h.on}
                    onChange={(e) => setHub(h.key, { factor: Math.max(0.05, (Number(e.target.value) || 0) / 100) })}
                    style={{ fontFamily: MONO, fontSize: 13, border: "none", outline: "none", width: "100%", padding: "7px 0", background: "transparent", color: C.ink }} />
                  <span style={{ fontFamily: MONO, color: C.muted, fontSize: 12 }}>% of US</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: "0 0 8px", fontWeight: 700, letterSpacing: -0.5 }}>
          Show the client their numbers.<br />
          <span style={{ color: C.shock }}>Close on proof, not promises.</span>
        </h1>
        <p style={{ color: C.muted, fontSize: 15, margin: "0 0 22px", maxWidth: 580 }}>
          On the call: enter the client's roles and state, show the gap live, and walk away with an
          AI placement plan plus a follow-up email ready to send.
        </p>

        {/* Client card */}
        <div style={{ ...card, padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase", marginBottom: 12 }}>
            Client on the call
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
            <Field label="Company">
              <TextInput value={client} onChange={setClient} placeholder="Acme Corp" />
            </Field>
            <Field label="State">
              <select value={a.state} onChange={(e) => pickState(e.target.value)} style={selStyle}>
                {Object.keys(STATES).map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 12 }}>
            <Field label="Employer taxes"><PctInput value={a.tax} onChange={(v) => setAssume({ tax: v })} /></Field>
            <Field label="Benefits"><PctInput value={a.benefits} onChange={(v) => setAssume({ benefits: v })} /></Field>
            <Field label="Recruiting"><PctInput value={a.recruit} onChange={(v) => setAssume({ recruit: v })} /></Field>
            <Field label="Equipment"><MoneyInput value={a.equipment} onChange={(v) => setAssume({ equipment: Math.max(0, Number(v) || 0) })} /></Field>
            <Field label="Ramp (mo)"><NumInput value={a.ramp} onChange={(v) => setAssume({ ramp: Math.max(0, Number(v) || 0) })} /></Field>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 8 }}>
            {a.state} pre-fills employer taxes ≈ {(a.tax * 100).toFixed(1)}% — adjust live if the client corrects you.
          </div>
        </div>

        {/* Roles */}
        <div style={{ ...card, padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase", marginBottom: 12 }}>
            Roles the client wants to fill
          </div>
          {roles.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr auto", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <select value={r.title} onChange={(e) => update(r.id, { title: e.target.value })} style={selStyle}>{TITLES.map((t) => <option key={t}>{t}</option>)}</select>
              <select value={r.sen} onChange={(e) => setSen(r.id, e.target.value)} style={selStyle}>{Object.keys(SEN).map((s) => <option key={s}>{s}</option>)}</select>
              <MoneyInput value={r.salary} onChange={(v) => update(r.id, { salary: Math.max(0, Number(v) || 0) })} />
              <button onClick={() => remove(r.id)} disabled={roles.length <= 1} title="Remove" style={{ border: "none", background: "none", color: roles.length <= 1 ? C.line : C.muted, cursor: roles.length <= 1 ? "default" : "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
            </div>
          ))}
          <button onClick={add} style={{ marginTop: 4, fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.ink, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>+ Add role</button>
        </div>

        {/* Hub comparison — the live "show the gap" moment */}
        <div style={{ ...card, padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase", marginBottom: 14 }}>
            Share this screen · their roster across your hubs (year-one)
          </div>
          {hubRows.map((h) => {
            const isUS = h.key === "US";
            const save = allUS - h.cost;
            return (
              <div key={h.key} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    <span style={{ marginRight: 6 }}>{h.flag}</span>{h.label}
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>{h.tz}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    {!isUS && save > 0 && <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.save }}>−{usdK(save)}</span>}
                    <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: isUS ? C.shock : C.ink }}>{usdK(h.cost)}</span>
                  </span>
                </div>
                <div style={{ height: 8, background: C.paper, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(4, (h.cost / maxCost) * 100)}%`, height: "100%", background: isUS ? C.shock : C.save, borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 6 }}>
            Hub rates are your agency's all-in prices (set in Agency setup). Cheapest ≠ best — generate the plan to get a defensible mix.
          </div>
        </div>

        {/* Baseline + generate */}
        <div style={{ ...card, padding: 20, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{client ? `${client} — all in-house (${a.state})` : `All in-house (${a.state})`}</div>
            <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: C.shock }}>{usd(allUS)}<span style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}> / year-one</span></div>
          </div>
          <button onClick={generate} disabled={loading} style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#fff", background: loading ? C.muted : C.ink, border: "none", borderRadius: 10, padding: "13px 22px", cursor: loading ? "default" : "pointer", whiteSpace: "nowrap" }}>
            {loading ? "Building the plan…" : "Generate placement plan →"}
          </button>
        </div>

        {err && <div style={{ ...card, padding: 16, marginBottom: 18, color: C.shock, borderColor: C.shock }}>{err}</div>}

        {report && (
          <div style={{ ...card, padding: 24, marginBottom: 18, borderColor: C.save }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.save, textTransform: "uppercase", marginBottom: 8 }}>
              Placement plan {client ? `· ${client}` : ""}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, marginBottom: 18 }}>{report.headline}</div>

            <div style={{ background: "#ECF6F4", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Client saves per year vs. all in-house</div>
              <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, color: C.save }}>{usd(report.savings)}</div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: MONO, marginTop: 2 }}>{usd(allUS)} in-house → {usd(report.recommended)} with your plan</div>
            </div>

            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>Recommended placement</div>
            {report.rows.map((r) => (
              <div key={r.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.sen} {r.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: locColor(r.loc), background: r.loc === "US" ? "#FCE7DC" : "#E7F2F0", padding: "3px 9px", borderRadius: 7 }}>{FLAG[r.loc]} {r.loc}</span>
                    <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600 }}>{usdK(r.cost)}/yr</span>
                  </div>
                </div>
                {r.rationale && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{r.rationale}</div>}
              </div>
            ))}

            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <Insight label="Objection you'll hear · and the answer" text={report.objection} />
              <Insight label="Honest tradeoff (say it before they do)" text={report.tradeoffs} />
            </div>

            {/* Follow-up email block */}
            <div style={{ marginTop: 18, background: C.paper, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase" }}>
                  Follow-up email · ready to send
                </div>
                <button onClick={copyFollowUp}
                  style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: copied ? C.save : "#fff", background: copied ? "#E7F2F0" : C.brand, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
                  {copied ? "✓ Copied" : "Copy email + plan"}
                </button>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "#222B3A", whiteSpace: "pre-wrap" }}>{report.followUp}</div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: MONO, lineHeight: 1.6 }}>
          Estimates only. State employer-tax figures are blended approximations (FICA + SUTA/FUTA + state paid-leave where applicable) and editable.
          Hub rates are the agency's configured all-in prices. The placement recommendation is AI-generated and advisory. Not accounting or legal advice.
        </div>
      </div>
    </div>
  );
}

const selStyle = { fontFamily: SANS, fontSize: 14, border: "1px solid #E6E8EC", borderRadius: 8, padding: "9px 8px", background: "#fff", color: "#0E1525", outline: "none", width: "100%" };
function Field({ label, children }) { return (<div><div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontFamily: MONO }}>{label}</div>{children}</div>); }
function wrap(children) { return <div style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${C.line}`, borderRadius: 8, padding: "0 8px" }}>{children}</div>; }
function TextInput({ value, onChange, placeholder }) {
  return wrap(<input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
    style={{ fontFamily: SANS, fontSize: 14, border: "none", outline: "none", width: "100%", padding: "9px 0", background: "transparent", color: C.ink }} />);
}
function MoneyInput({ value, onChange, placeholder }) {
  return wrap(<>
    <span style={{ fontFamily: MONO, color: C.muted, fontSize: 13 }}>$</span>
    <input type="number" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: MONO, fontSize: 14, border: "none", outline: "none", width: "100%", padding: "9px 0", background: "transparent", color: C.ink }} />
  </>);
}
function PctInput({ value, onChange }) {
  return wrap(<>
    <input type="number" step="0.1" value={+(value * 100).toFixed(1)} onChange={(e) => onChange(Math.max(0, (Number(e.target.value) || 0) / 100))} style={{ fontFamily: MONO, fontSize: 14, border: "none", outline: "none", width: "100%", padding: "9px 0", background: "transparent", color: C.ink }} />
    <span style={{ fontFamily: MONO, color: C.muted, fontSize: 13 }}>%</span>
  </>);
}
function NumInput({ value, onChange }) {
  return wrap(<input type="number" value={value} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: MONO, fontSize: 14, border: "none", outline: "none", width: "100%", padding: "9px 0", background: "transparent", color: C.ink }} />);
}
function Insight({ label, text, accent }) {
  return (
    <div style={{ borderLeft: `3px solid ${accent ? C.save : C.line}`, paddingLeft: 12 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: "#222B3A", fontWeight: accent ? 600 : 400 }}>{text}</div>
    </div>
  );
}
