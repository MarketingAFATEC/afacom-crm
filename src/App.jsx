import { useState, useEffect, useCallback } from "react";
import { Users, LogOut, Phone, Mail, Calendar, MessageSquare, Send, Trash2, X, ChevronRight, AlertCircle } from "lucide-react";

const SUPABASE_URL = "https://wrecjgxbhwfswapldrmb.supabase.co";
const SUPABASE_KEY = "sb_publishable_5v9BRvU757Ltgvcwj0vmrA_rycLRalJ";

const PROJECTS = ["CAV", "CTM", "MPS", "Empresa Rica"];
const STATUSES = ["Novo", "Tentativa de Contato", "Em Qualificação", "Qualificado", "Não Qualificado", "Perdido"];

const STATUS_STYLE = {
  "Novo":                 { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
  "Tentativa de Contato": { bg: "#fffbeb", color: "#b45309", dot: "#f59e0b" },
  "Em Qualificação":      { bg: "#faf5ff", color: "#7c3aed", dot: "#8b5cf6" },
  "Qualificado":          { bg: "#ecfdf5", color: "#065f46", dot: "#10b981" },
  "Não Qualificado":      { bg: "#f3f4f6", color: "#4b5563", dot: "#9ca3af" },
  "Perdido":              { bg: "#fef2f2", color: "#991b1b", dot: "#ef4444" },
};

const hdrs = (token) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${token || SUPABASE_KEY}`,
});

const db = {
  signIn: (email, password) =>
    fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: hdrs(), body: JSON.stringify({ email, password }),
    }).then(r => r.json()),
  getProfile: (uid, token) =>
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=*`, { headers: hdrs(token) })
      .then(r => r.json()).then(d => d[0]),
  getLeads: (project, token) =>
    fetch(`${SUPABASE_URL}/rest/v1/leads?project=eq.${encodeURIComponent(project)}&order=created_at.desc&select=*`, { headers: hdrs(token) })
      .then(r => r.json()),
  updateLead: (id, data, token) =>
    fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH", headers: hdrs(token), body: JSON.stringify(data),
    }),
  deleteLead: (id, token) =>
    fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, { method: "DELETE", headers: hdrs(token) }),
  getComments: (lid, token) =>
    fetch(`${SUPABASE_URL}/rest/v1/comments?lead_id=eq.${lid}&order=created_at.asc&select=*,profiles(name)`, { headers: hdrs(token) })
      .then(r => r.json()),
  addComment: (lid, uid, content, token) =>
    fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: "POST", headers: hdrs(token), body: JSON.stringify({ lead_id: lid, user_id: uid, content }),
    }),
};

const fmt = d => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function Badge({ status }) {
  const s = STATUS_STYLE[status] || {};
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

export default function App() {
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [project, setProject]   = useState("CAV");
  const [filter, setFilter]     = useState("Todos");
  const [leads, setLeads]       = useState([]);
  const [lead, setLead]         = useState(null);
  const [comments, setComments] = useState([]);
  const [note, setNote]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [email, setEmail]       = useState("");
  const [pass, setPass]         = useState("");
  const [authErr, setAuthErr]   = useState("");
  const [authLoad, setAuthLoad] = useState(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadLeads = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const data = await db.getLeads(project, session.access_token);
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [session, project]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    if (!lead?.id || !session) return;
    db.getComments(lead.id, session.access_token).then(d => setComments(Array.isArray(d) ? d : []));
  }, [lead?.id, session?.access_token]);

  const login = async () => {
    setAuthLoad(true); setAuthErr("");
    try {
      const data = await db.signIn(email, pass);
      if (data.access_token) {
        const prof = await db.getProfile(data.user.id, data.access_token);
        setSession(data); setProfile(prof);
      } else {
        setAuthErr("Email ou senha incorretos.");
      }
    } catch(e) {
      setAuthErr("Erro de conexão. Tente novamente.");
    }
    setAuthLoad(false);
  };

  const logout = () => { setSession(null); setProfile(null); setLeads([]); setLead(null); };

  const changeStatus = async (id, status) => {
    await db.updateLead(id, { status }, session.access_token);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    setLead(prev => prev?.id === id ? { ...prev, status } : prev);
    showToast("Status atualizado ✓");
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await db.addComment(lead.id, session.user.id, note, session.access_token);
    const data = await db.getComments(lead.id, session.access_token);
    setComments(Array.isArray(data) ? data : []);
    setNote(""); showToast("Comentário adicionado ✓");
  };

  const delLead = async () => {
    if (!confirm("Excluir este lead permanentemente?")) return;
    await db.deleteLead(lead.id, session.access_token);
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    setLead(null); showToast("Lead excluído");
  };

  const filtered = filter === "Todos" ? leads : leads.filter(l => l.status === filter);

  if (!session) return (
    <div style={{ minHeight: "100vh", background: "#01192A", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "40px 32px", width: "100%", maxWidth: 400, boxShadow: "0 25px 60px rgba(0,0,0,.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: "#3030FF", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Users size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#01192A", margin: 0 }}>AFACOM CRM</h1>
          <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Gestão de Leads SDR</p>
        </div>
        {authErr && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            <AlertCircle size={14} />{authErr}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[{ label: "Email", type: "email", val: email, set: setEmail },
            { label: "Senha", type: "password", val: pass, set: setPass }].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} onKeyDown={e => e.key === "Enter" && login()}
                style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <button onClick={login} disabled={authLoad}
            style={{ background: "#3030FF", color: "white", padding: 14, borderRadius: 12, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: authLoad ? .6 : 1 }}>
            {authLoad ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        @media (min-width: 768px) {
          .list-col { display: block !important; }
          .detail-col { width: 420px !important; max-width: 420px !important; }
        }
      `}</style>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, background: "#01192A", color: "white", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.3)" }}>
          {toast}
        </div>
      )}
      <header style={{ background: "#01192A", color: "white", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, background: "#3030FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={17} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>AFACOM CRM</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{profile?.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: profile?.role === "admin" ? "#FDC71C" : "rgba(255,255,255,.1)", color: profile?.role === "admin" ? "#01192A" : "#d1d5db", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {profile?.role === "admin" ? "Admin" : "SDR"}
          </span>
          <button onClick={logout} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 6, borderRadius: 8, display: "flex" }}>
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "0 16px", overflowX: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4, padding: "8px 0", minWidth: "max-content" }}>
          {PROJECTS.map(p => (
            <button key={p} onClick={() => { setProject(p); setLead(null); setFilter("Todos"); }}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: project === p ? "#3030FF" : "transparent", color: project === p ? "white" : "#6b7280" }}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: "white", borderBottom: "1px solid #f3f4f6", padding: "0 16px", overflowX: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, padding: "8px 0", minWidth: "max-content" }}>
          {["Todos", ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: filter === s ? "#01192A" : "#f3f4f6", color: filter === s ? "white" : "#6b7280", whiteSpace: "nowrap" }}>
              {s} ({s === "Todos" ? leads.length : leads.filter(l => l.status === s).length})
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div className="list-col" style={{ flex: 1, overflowY: "auto", padding: 16, display: lead ? "none" : "block" }}>
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12, fontWeight: 500 }}>
            {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
          </p>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 14 }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
              <Users size={36} style={{ margin: "0 auto 10px", opacity: .3, display: "block" }} />
              <div style={{ fontSize: 14 }}>Nenhum lead nesta fila</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(l => (
                <div key={l.id} onClick={() => setLead(l)}
                  style={{ background: "white", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", border: `2px solid ${lead?.id === l.id ? "#3030FF" : "transparent"}`, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#01192A", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                        <Phone size={11} color="#9ca3af" />{l.phone}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 5 }}>
                        <Mail size={11} color="#9ca3af" />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.email}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <Badge status={l.status} />
                      <ChevronRight size={15} color="#d1d5db" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={11} />{fmt(l.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {lead && (
          <div className="detail-col" style={{ width: "100%", background: "white", borderLeft: "1px solid #e5e7eb", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#01192A", marginBottom: 6 }}>{lead.name}</div>
                <Badge status={lead.status} />
              </div>
              <button onClick={() => setLead(null)} style={{ background: "#f3f4f6", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#6b7280", display: "flex" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ padding: 16, borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Contato</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Phone size={13} color="#3030FF" />
                    <a href={`tel:${lead.phone}`} style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}>{lead.phone}</a>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Mail size={13} color="#3030FF" />
                    <a href={`mailto:${lead.email}`} style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}>{lead.email}</a>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Calendar size={13} color="#9ca3af" />
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>{fmt(lead.created_at)}</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: 16, borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Atualizar Status</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {STATUSES.map(s => {
                    const st = STATUS_STYLE[s];
                    const active = lead.status === s;
                    return (
                      <button key={s} onClick={() => changeStatus(lead.id, s)}
                        style={{ padding: "9px 10px", borderRadius: 10, border: `2px solid ${active ? st.color : "transparent"}`, cursor: "pointer", fontSize: 12, fontWeight: 600, textAlign: "left", background: active ? st.bg : "#f9fafb", color: active ? st.color : "#6b7280" }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <MessageSquare size={11} /> Histórico ({comments.length})
                </div>
                {comments.length === 0
                  ? <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "#9ca3af" }}>Nenhuma interação registrada ainda.</div>
                  : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {comments.map(c => (
                        <div key={c.id} style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#01192A" }}>{c.profiles?.name || "Usuário"}</span>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmt(c.created_at)}</span>
                          </div>
                          <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()}
                  placeholder="Registrar interação..."
                  style={{ flex: 1, padding: "10px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none" }} />
                <button onClick={addNote} style={{ background: "#3030FF", color: "white", border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <Send size={15} />
                </button>
              </div>
              {profile?.role === "admin" && (
                <button onClick={delLead} style={{ marginTop: 8, width: "100%", background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 6 }}>
                  <Trash2 size={12} /> Excluir lead
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
