import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPA_URL, SUPA_KEY);

const AUTH_KEY = "egho_auth_v1";
const USUARIOS = {
  "romerio": "egho2026",
  "equipe": "egho2026",
  "financeiro": "egho@fin",
};

function LoginScreen({ onLogin }) {
  const [u, setU] = useState(""); const [s, setS] = useState(""); const [err, setErr] = useState("");
  const login = () => {
    if (USUARIOS[u.toLowerCase()] === s) { sessionStorage.setItem(AUTH_KEY, btoa(u)); onLogin(u); }
    else { setErr("Usuário ou senha incorretos."); setS(""); }
  };
  return (
    <div style={{ fontFamily: "'IBM Plex Mono',monospace", background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width: 320, padding: "40px 32px", background: "#0e0e0e", border: "0.5px solid #1e1e1e", borderRadius: 4 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.25em", color: "#e8e0d0" }}>EGHO</div>
          <div style={{ fontSize: 9, color: "#333", letterSpacing: "0.12em", marginTop: 4 }}>OPS DASHBOARD — ACESSO RESTRITO</div>
        </div>
        {[["Usuário", u, setU, "text"], ["Senha", s, setS, "password"]].map(([lbl, val, set, type]) => (
          <div key={lbl} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>{lbl}</div>
            <input type={type} value={val} onChange={e => { set(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && login()} style={{ width: "100%", background: "#080808", border: "0.5px solid #2a2a2a", borderRadius: 2, padding: "9px 12px", fontFamily: "inherit", fontSize: 12, color: "#e8e0d0", outline: "none" }} />
          </div>
        ))}
        {err && <div style={{ fontSize: 11, color: "#c05a5a", background: "#1a0f0f", border: "0.5px solid #3a1515", borderRadius: 2, padding: "8px 12px", marginBottom: 12 }}>{err}</div>}
        <button onClick={login} style={{ width: "100%", background: "#c8a96e", border: "none", borderRadius: 2, padding: 10, fontFamily: "inherit", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0a0a0a", cursor: "pointer" }}>Entrar →</button>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(AUTH_KEY));
  const [user, setUser] = useState(() => { try { return atob(sessionStorage.getItem(AUTH_KEY) || ""); } catch { return ""; } });
  if (!authed) return <LoginScreen onLogin={u => { setAuthed(true); setUser(u); }} />;
  return <Dashboard user={user} onLogout={() => { sessionStorage.removeItem(AUTH_KEY); setAuthed(false); }} />;
}

function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [pedidos, setPedidos] = useState([]);
  const [metricas, setMetricas] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [config, setConfig] = useState({ breakeven: 130000, meta_mes: 120000, divida_itau: 95500, investimento_midia: 11000 });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [liveCount, setLiveCount] = useState(0);
  const chatEndRef = useRef(null);
  const [messages, setMessages] = useState([{ role: "assistant", content: "Dashboard em tempo real conectado. Dados carregando do Supabase..." }]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Carrega dados iniciais
  useEffect(() => {
    loadAll();
    setupRealtime();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadAll = async () => {
    const [p, m, e, pi, c] = await Promise.all([
      supabase.from("pedidos").select("*").order("data", { ascending: false }).limit(500),
      supabase.from("metricas_diarias").select("*").order("data", { ascending: false }).limit(90),
      supabase.from("estoque").select("*").order("quantidade", { ascending: false }).limit(100),
      supabase.from("pipeline").select("*").order("colecao"),
      supabase.from("config").select("*"),
    ]);
    if (p.data) setPedidos(p.data);
    if (m.data) setMetricas(m.data);
    if (e.data) setEstoque(e.data);
    if (pi.data) setPipeline(pi.data);
    if (c.data) {
      const cfg = {};
      c.data.forEach(r => { cfg[r.chave] = parseFloat(r.valor) || r.valor; });
      setConfig(prev => ({ ...prev, ...cfg }));
    }
    setLastSync(new Date());
  };

  const setupRealtime = () => {
    // Escuta novos pedidos em tempo real
    supabase.channel("pedidos-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, payload => {
        setPedidos(prev => [payload.new, ...prev]);
        setLiveCount(n => n + 1);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "metricas_diarias" }, () => {
        supabase.from("metricas_diarias").select("*").order("data", { ascending: false }).limit(90).then(r => { if (r.data) setMetricas(r.data); });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque" }, () => {
        supabase.from("estoque").select("*").order("quantidade", { ascending: false }).limit(100).then(r => { if (r.data) setEstoque(r.data); });
      })
      .subscribe();
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      await loadAll();
      setLastSync(new Date());
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  // Cálculos
  const hoje = new Date().toISOString().split("T")[0];
  const mesAtual = new Date().toISOString().slice(0, 7);
  const metricaHoje = metricas.find(m => m.data === hoje) || { faturamento: 0, pedidos: 0, ticket_medio: 0 };
  const metricasMes = metricas.filter(m => m.data?.startsWith(mesAtual));
  const fatMes = metricasMes.reduce((s, m) => s + (m.faturamento || 0), 0);
  const pedidosMes = metricasMes.reduce((s, m) => s + (m.pedidos || 0), 0);
  const diasPassados = new Date().getDate();
  const diasMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projecao = diasPassados > 0 ? Math.round((fatMes / diasPassados) * diasMes) : 0;
  const pctMeta = config.meta_mes > 0 ? Math.round((fatMes / config.meta_mes) * 100) : 0;
  const ticketMedio = pedidosMes > 0 ? Math.round(fatMes / pedidosMes) : 0;

  const fmt = v => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  const fmtk = v => `R$${Math.round(v / 1000)}k`;

  const sendAI = async () => {
    if (!input.trim() || aiLoading) return;
    const userMsg = { role: "user", content: input };
    const hist = [...messages, userMsg];
    setMessages(hist);
    setInput("");
    setAiLoading(true);
    const ctx = `DADOS REALTIME:\nFaturamento hoje: ${fmt(metricaHoje.faturamento)}\nPedidos hoje: ${metricaHoje.pedidos}\nFat mês: ${fmt(fatMes)} (${pctMeta}% da meta)\nProjeção fechamento: ${fmt(projecao)}\nTicket médio: ${fmt(ticketMedio)}\nPedidos mês: ${pedidosMes}\nBreakeven: ${fmt(config.breakeven)}\nDívida Itaú: ${fmt(config.divida_itau)}\nTop estoque parado: ${estoque.slice(0, 5).map(e => `${e.nome}: ${e.quantidade}un`).join(", ")}\nPipeline próximos lançamentos: ${pipeline.filter(p => p.status === "Em produção" || p.status === "Em pilotagem").slice(0, 5).map(p => p.nome).join(", ")}`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800, system: `Você é o consultor da EGHO, marca de streetwear de SP. Fale em português informal. Seja direto e prático. ${ctx}`, messages: hist.map(m => ({ role: m.role, content: m.content })) })
      });
      const d = await r.json();
      setMessages(prev => [...prev, { role: "assistant", content: d.content?.find(b => b.type === "text")?.text || "Erro." }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão." }]); }
    setAiLoading(false);
  };

  const tabs = ["overview", "realtime", "estoque", "pipeline", "chat"];
  const tabLabels = { overview: "Visão Geral", realtime: "Ao Vivo", estoque: "Estoque", pipeline: "Pipeline", chat: "Chat IA" };

  return (
    <div style={{ fontFamily: "'IBM Plex Mono',monospace", background: "#0a0a0a", minHeight: "100vh", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333}
        .tab{background:none;border:none;cursor:pointer;padding:8px 14px;font-family:inherit;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#444;border-bottom:1px solid transparent;transition:color .2s}
        .tab.on{color:#c8a96e;border-bottom-color:#c8a96e}.tab:hover{color:#888}
        .card{background:#111;border:.5px solid #1e1e1e;border-radius:3px;padding:14px}
        .kv{font-size:20px;font-weight:600;margin:4px 0 2px}.kl{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#555}.ks{font-size:10px;color:#555}
        .pos{color:#6bb87a}.neg{color:#c05a5a}.warn{color:#c8a96e}
        .inp{background:#0d0d0d;border:.5px solid #2a2a2a;border-radius:2px;padding:7px 10px;font-family:inherit;font-size:11px;color:#e8e0d0;width:100%;outline:none}
        .inp:focus{border-color:#c8a96e}
        .btn{background:none;border:.5px solid #333;border-radius:2px;padding:7px 14px;font-family:inherit;font-size:10px;letter-spacing:.08em;color:#c8a96e;cursor:pointer;text-transform:uppercase}
        .btn:hover{background:#1a1a14;border-color:#c8a96e}.btnp{background:#c8a96e;color:#0a0a0a;border-color:#c8a96e}.btnp:hover{background:#dab97e}
        .chat-u{background:#14140e;border-left:2px solid #c8a96e;padding:10px 14px;border-radius:2px;margin-bottom:8px;font-size:12px;line-height:1.6}
        .chat-a{background:#0f0f0f;border-left:2px solid #2a2a2a;padding:10px 14px;border-radius:2px;margin-bottom:8px;font-size:12px;line-height:1.6;color:#aaa;white-space:pre-wrap}
        .trk{background:#151515;border-radius:2px;height:5px}
        .sec{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#444;margin:16px 0 10px;padding-bottom:5px;border-bottom:.5px solid #151515}
        .live-dot{width:6px;height:6px;border-radius:50%;background:#6bb87a;display:inline-block;margin-right:6px;animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        textarea.inp{resize:none}
        .tag{display:inline-block;font-size:9px;padding:2px 6px;border-radius:2px;letter-spacing:.06em;text-transform:uppercase}
        .tag-r{background:#1a0f0f;color:#c05a5a;border:.5px solid #3a1515}
        .tag-g{background:#0f1a0f;color:#6bb87a;border:.5px solid #153515}
        .tag-w{background:#1a160a;color:#c8a96e;border:.5px solid #3a2e10}
        .tag-b{background:#0f0f1a;color:#6b8ac0;border:.5px solid #151535}
      `}</style>

      {/* Header */}
      <div style={{ background: "#060606", borderBottom: ".5px solid #151515", padding: "11px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: ".2em" }}>EGHO</span>
          <span style={{ fontSize: 9, color: "#333", letterSpacing: ".1em" }}>REALTIME OPS</span>
          <span className="live-dot" style={{ marginLeft: 8 }} />
          <span style={{ fontSize: 9, color: "#6bb87a" }}>LIVE</span>
          {liveCount > 0 && <span style={{ fontSize: 9, color: "#c8a96e", marginLeft: 6 }}>+{liveCount} novos</span>}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#444" }}>HOJ. <span className="pos">{fmt(metricaHoje.faturamento)}</span></span>
          <span style={{ fontSize: 9, color: "#444" }}>MÊS <span className={pctMeta >= 80 ? "pos" : "warn"}>{fmtk(fatMes)}</span></span>
          {lastSync && <span style={{ fontSize: 8, color: "#333" }}>sync {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={syncNow} disabled={syncing} className="btn" style={{ padding: "3px 10px", fontSize: 9 }}>{syncing ? "..." : "↻ sync"}</button>
          <span style={{ fontSize: 9, color: "#555" }}>{user.toUpperCase()}</span>
          <button onClick={onLogout} style={{ background: "none", border: ".5px solid #1e1e1e", borderRadius: 2, padding: "3px 8px", fontFamily: "inherit", fontSize: 9, color: "#444", cursor: "pointer" }}>SAIR</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#060606", borderBottom: ".5px solid #151515", padding: "0 20px", display: "flex" }}>
        {tabs.map(t => <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{tabLabels[t]}</button>)}
      </div>

      <div style={{ padding: "16px 20px", maxWidth: 960 }}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { l: "Hoje", v: fmt(metricaHoje.faturamento), s: `${metricaHoje.pedidos} pedidos`, c: metricaHoje.faturamento > 0 ? "pos" : "" },
                { l: "Mês atual", v: fmt(fatMes), s: `${pctMeta}% da meta`, c: pctMeta >= 80 ? "pos" : pctMeta >= 50 ? "warn" : "neg" },
                { l: "Projeção", v: fmt(projecao), s: `meta: ${fmt(config.meta_mes)}`, c: projecao >= config.meta_mes ? "pos" : "warn" },
                { l: "Ticket médio", v: fmt(ticketMedio), s: `${pedidosMes} pedidos no mês`, c: "" },
              ].map((k, i) => (
                <div key={i} className="card"><div className="kl">{k.l}</div><div className={`kv ${k.c}`}>{k.v}</div><div className="ks">{k.s}</div></div>
              ))}
            </div>

            {/* Progresso meta */}
            <div className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "#555", letterSpacing: ".1em", textTransform: "uppercase" }}>Progresso — meta do mês</span>
                <span style={{ fontSize: 10, color: "#c8a96e" }}>{fmt(fatMes)} / {fmt(config.meta_mes)}</span>
              </div>
              <div className="trk" style={{ height: 8, marginBottom: 6 }}>
                <div style={{ height: 8, borderRadius: 2, width: `${Math.min(100, pctMeta)}%`, background: pctMeta >= 80 ? "#6bb87a" : pctMeta >= 50 ? "#c8a96e" : "#c05a5a", transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555" }}>
                <span>Dia {diasPassados} de {diasMes}</span>
                <span>Projeção: {fmt(projecao)}</span>
              </div>
            </div>

            {/* Gráfico últimos 14 dias */}
            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">Últimos 14 dias</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
                {metricas.slice(0, 14).reverse().map((m, i) => {
                  const maxVal = Math.max(...metricas.slice(0, 14).map(x => x.faturamento || 0), 1);
                  const h = Math.max(4, ((m.faturamento || 0) / maxVal) * 60);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <div style={{ width: "100%", background: m.data === hoje ? "#c8a96e33" : "#1a2e1a", border: `.5px solid ${m.data === hoje ? "#c8a96e" : "#3a5a3a"}`, borderRadius: 2, height: h + "px" }} title={`${m.data}: ${fmt(m.faturamento || 0)}`} />
                      <div style={{ fontSize: 8, color: "#333" }}>{m.data?.slice(8)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alertas */}
            <div className="card">
              <div className="sec">Alertas</div>
              {[
                config.divida_itau > 0 && { t: "tag-r", txt: `Dívida Itaú ${fmt(config.divida_itau)} — sem quitação definida` },
                fatMes < config.breakeven && { t: "tag-r", txt: `Faturamento do mês abaixo do breakeven (${fmt(config.breakeven)})` },
                pctMeta < 50 && diasPassados > 15 && { t: "tag-r", txt: `Apenas ${pctMeta}% da meta atingida na metade do mês` },
                estoque.filter(e => e.quantidade > 60).length > 0 && { t: "tag-w", txt: `${estoque.filter(e => e.quantidade > 60).length} produtos com estoque acima de 60 unidades` },
                pipeline.filter(p => p.status === "Em produção").length > 0 && { t: "tag-b", txt: `${pipeline.filter(p => p.status === "Em produção").length} produtos em produção no pipeline` },
              ].filter(Boolean).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 12, lineHeight: 1.5 }}>
                  <span className={`tag ${a.t}`}>{a.t === "tag-r" ? "▲" : a.t === "tag-w" ? "◆" : "◉"}</span>
                  <span style={{ color: "#aaa" }}>{a.txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REALTIME */}
        {tab === "realtime" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div className="card">
                <div className="kl">Hoje</div>
                <div className="kv pos">{fmt(metricaHoje.faturamento)}</div>
                <div className="ks">{metricaHoje.pedidos} pedidos · ticket {fmt(metricaHoje.ticket_medio || 0)}</div>
              </div>
              <div className="card">
                <div className="kl">Últimas 24h</div>
                <div className="kv">{pedidos.filter(p => new Date(p.data) > new Date(Date.now() - 86400000)).length} pedidos</div>
                <div className="ks">{fmt(pedidos.filter(p => new Date(p.data) > new Date(Date.now() - 86400000)).reduce((s, p) => s + (p.valor || 0), 0))}</div>
              </div>
            </div>

            <div className="card">
              <div className="sec">Pedidos recentes <span className="live-dot" /></div>
              <div style={{ maxHeight: 460, overflowY: "auto" }}>
                {pedidos.slice(0, 30).map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: ".5px solid #0f0f0f", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 9, color: "#444", width: 80 }}>{p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—"}</div>
                    <div style={{ fontSize: 11, color: "#aaa", flex: 1 }}>{p.nome || "Cliente"}</div>
                    <div style={{ fontSize: 10, color: "#555" }}>{p.cidade || ""} {p.estado || ""}</div>
                    <span className={`tag ${p.status === "paid" ? "tag-g" : p.status === "refunded" ? "tag-r" : "tag-w"}`}>{p.status}</span>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#c8a96e", width: 90, textAlign: "right" }}>{fmt(p.valor || 0)}</div>
                  </div>
                ))}
                {pedidos.length === 0 && <div style={{ fontSize: 11, color: "#444", padding: "20px 0", textAlign: "center" }}>Nenhum pedido ainda. Clique em "↻ sync" para carregar.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ESTOQUE */}
        {tab === "estoque" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
              <div className="card"><div className="kl">Total SKUs</div><div className="kv">{estoque.length}</div><div className="ks">variantes ativas</div></div>
              <div className="card"><div className="kl">Estoque crítico</div><div className="kv neg">{estoque.filter(e => e.quantidade <= 3 && e.quantidade >= 0).length}</div><div className="ks">SKUs com ≤3 unidades</div></div>
              <div className="card"><div className="kl">Excesso</div><div className="kv warn">{estoque.filter(e => e.quantidade > 50).length}</div><div className="ks">SKUs com +50 unidades</div></div>
            </div>

            <div className="card">
              <div className="sec">Produtos por estoque <span className="live-dot" /></div>
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                {estoque.slice(0, 60).map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: ".5px solid #0a0a0a" }}>
                    <div style={{ flex: 1, fontSize: 11, color: "#aaa" }}>{e.nome}</div>
                    <div style={{ fontSize: 10, color: "#555", width: 80, textAlign: "right" }}>{e.sku}</div>
                    <div style={{ width: 60, textAlign: "right" }}>
                      <span className={`tag ${e.quantidade > 50 ? "tag-w" : e.quantidade <= 3 ? "tag-r" : "tag-g"}`}>{e.quantidade} un</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#c8a96e", width: 70, textAlign: "right" }}>R${e.preco}</div>
                  </div>
                ))}
                {estoque.length === 0 && <div style={{ fontSize: 11, color: "#444", padding: "20px 0", textAlign: "center" }}>Clique em "↻ sync" para carregar o estoque da Shopify.</div>}
              </div>
            </div>
          </div>
        )}

        {/* PIPELINE NOTION */}
        {tab === "pipeline" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
              {["Em produção", "Em pilotagem", "Desenvolvimento de ficha", "Entregue"].map(s => (
                <div key={s} className="card">
                  <div className="kl" style={{ fontSize: 8 }}>{s}</div>
                  <div className="kv">{pipeline.filter(p => p.status === s).length}</div>
                  <div className="ks">produtos</div>
                </div>
              ))}
            </div>

            {["LANÇAMENTO MAIO/JUNHO - DRK HRSE", "LANÇAMENTO/RESTOCK - MARÇO", "COLLAB EGHO x WT", "EGHO X FÔRNO", "UNIFORMS", "RESTOCK"].map(col => {
              const prods = pipeline.filter(p => p.colecao === col);
              if (!prods.length) return null;
              return (
                <div key={col} className="card" style={{ marginBottom: 8 }}>
                  <div className="sec">{col}</div>
                  {prods.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: ".5px solid #0a0a0a" }}>
                      <div style={{ flex: 1, fontSize: 11, color: "#aaa" }}>{p.nome}</div>
                      <span className={`tag ${p.status === "Entregue" || p.status === "Pedido feito" ? "tag-g" : p.status === "Em produção" || p.status === "Em pilotagem" ? "tag-b" : p.status === "Cancelado" ? "tag-r" : "tag-w"}`}>{p.status || "—"}</span>
                      {p.preco_venda > 0 && <div style={{ fontSize: 10, color: "#6bb87a", width: 80, textAlign: "right" }}>R${p.preco_venda}</div>}
                      {p.preco_custo > 0 && <div style={{ fontSize: 10, color: "#555", width: 70, textAlign: "right" }}>cst R${p.preco_custo}</div>}
                    </div>
                  ))}
                </div>
              );
            })}

            {pipeline.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: "30px" }}>
                <div style={{ fontSize: 11, color: "#444" }}>Clique em "↻ sync" para carregar o pipeline do Notion.</div>
              </div>
            )}
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div>
            <div className="card" style={{ marginBottom: 8, height: 440, overflowY: "auto" }}>
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "chat-u" : "chat-a"}>
                  <div style={{ fontSize: 8, color: "#444", marginBottom: 5 }}>{m.role === "user" ? "VOCÊ" : "EGHO ADVISOR"}</div>
                  <div style={{ color: m.role === "user" ? "#e8e0d0" : "#aaa" }}>{m.content}</div>
                </div>
              ))}
              {aiLoading && <div className="chat-a"><div style={{ fontSize: 8, color: "#444", marginBottom: 5 }}>EGHO ADVISOR</div><div style={{ color: "#444" }}>analisando...</div></div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea className="inp" rows={3} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAI(); } }} placeholder="o que tá acontecendo hoje? cole dados, peça análise..." />
              <button className="btn btnp" onClick={sendAI} disabled={aiLoading} style={{ alignSelf: "flex-end", padding: "12px 20px" }}>{aiLoading ? "..." : "→"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
