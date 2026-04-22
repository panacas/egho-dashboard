import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "egho_dashboard_v1";

const INITIAL_DATA = {
  months: [
    { mes: "Jan/26", faturamento: 257391, custo_producao: 78405, despesa_fixa: 29984, despesa_variavel: 58284, emprestimo: 0, saldo: 64481 },
    { mes: "Fev/26", faturamento: 152376, custo_producao: 73969, despesa_fixa: 16561, despesa_variavel: 44921, emprestimo: 0, saldo: -1445 },
    { mes: "Mar/26", faturamento: 193624, custo_producao: 65878, despesa_fixa: 46943, despesa_variavel: 40063, emprestimo: 18136, saldo: 14581 },
  ],
  crm: {
    receita_edrone: 69944,
    sms_receita: 46732,
    email_receita: 21453,
    carrinho_abandonado: 9090,
    boas_vindas: 9002,
    base_email: 10116,
    base_sms: 6282,
  },
  estoque_destaque: [
    { nome: "Post Viva Band Tee", qty: 109 },
    { nome: "Black Bird Tee OW", qty: 94 },
    { nome: "Black Metal Cap", qty: 78 },
    { nome: "Board Shorts Camo", qty: 71 },
    { nome: "Guerrilla Denim", qty: 64 },
    { nome: "Army Dad Hat Camo", qty: 61 },
  ],
  notas: [],
  abr_parcial: 66352,
};

const SYSTEM_PROMPT = `Você é o consultor financeiro e estratégico da EGHO, marca de streetwear brasileira fundada por Romério Castro em São Paulo.

CONTEXTO DA MARCA:
- Streetwear com estética militarista, urbana, rustica e guerrilha
- Vende principalmente via Shopify (DTC) + atacado
- CRM: Edrone (email + SMS + WhatsApp)
- Fulfillment: Cubbo
- ERP: Bling

DADOS FINANCEIROS HISTÓRICOS:
- Jan/26: Faturamento R$257k, Saldo +R$64k (inclui empréstimo R$95.5k Itaú)
- Fev/26: Faturamento R$152k, Saldo -R$1.4k
- Mar/26: Faturamento R$193k, Saldo +R$14.5k (pagou R$18k empréstimo)
- Abr/26 (parcial até dia 22): R$66k Shopify, ritmo R$3k/dia

ESTRUTURA DE CUSTOS TÍPICA:
- Custo de produção: 35–55% da receita (ALTO - deveria ser 25-35%)
- Despesa variável (fretes + mkt + financeiras): 22-34%
- Despesa fixa (aluguel, consultoria, pessoas): 12-25%
- Dívida Itaú R$95.5k acumulando juros - não quitada

CRM (fev–abr):
- SMS é o canal mais eficiente: R$46.7k gerados, 66% da receita CRM
- Email: R$21.4k com 132k mensagens enviadas (baixa conversão)
- Automação boas-vindas: R$9k automático (29 pedidos)
- Carrinho abandonado: R$9k (7.3% CTR) - mas pouco tráfego qualificado
- Base email: 10.1k inscritos | Base SMS: 6.3k inscritos

ESTOQUE CRÍTICO (produtos com 40+ unidades paradas):
Post Viva Band Tee Charcoal (109), Black Bird Tee OW (94), Black Metal Cap Resin (78), Board Shorts Camo (71), Guerrilla Denim Preta (64), Army Dad Hat Camo (61)

PADRÕES OBSERVADOS:
- Meses com restock de best sellers = faturamento alto (R$150k+)
- Meses com lançamentos novos = faturamento baixo (base fria)
- SMS com oferta direta gera R$2.5k–5.8k em 24h
- Email de lançamento gera próximo de zero (ex: Working Title = R$0)
- Investimento mensal em mídia paga: R$10–12k

Quando o usuário compartilhar novos dados ou perguntar o que fazer, analise com base nesse contexto, seja direto e prático. Fale em português informal (tutear). Dê recomendações priorizadas e acionáveis. Mencione números concretos quando possível.`;

export default function EGHODashboard() {
  const [data, setData] = useState(INITIAL_DATA);
  const [activeTab, setActiveTab] = useState("overview");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Fala Romério. Dashboard carregado com os dados até abril. Qual número você quer entender melhor hoje ou o que tá rolando?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [newMonth, setNewMonth] = useState({ mes: "", faturamento: "", custo_producao: "", despesa_fixa: "", despesa_variavel: "", emprestimo: "", saldo: "" });
  const chatEndRef = useRef(null);

  useEffect(() => {
    try {
      const saved = window.storage?.get(STORAGE_KEY);
      if (saved) saved.then(r => r && setData(JSON.parse(r.value)));
    } catch {}
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveData = async (newData) => {
    setData(newData);
    try { await window.storage?.set(STORAGE_KEY, JSON.stringify(newData)); } catch {}
  };

  const lastMonth = data.months[data.months.length - 1];
  const avgFat = data.months.reduce((s, m) => s + m.faturamento, 0) / data.months.length;
  const totalSaldo = data.months.reduce((s, m) => s + m.saldo, 0);
  const lastCostoPct = lastMonth ? Math.round((lastMonth.custo_producao / lastMonth.faturamento) * 100) : 0;

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const contextMsg = `DADOS ATUAIS DO DASHBOARD:\n${JSON.stringify({ months: data.months, crm: data.crm, abr_parcial: data.abr_parcial, estoque_destaque: data.estoque_destaque }, null, 2)}\n\nNOTAS SALVAS:\n${data.notas.map(n => `[${n.data}] ${n.texto}`).join("\n") || "nenhuma"}`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT + "\n\n" + contextMsg,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const d = await resp.json();
      const text = d.content?.find(b => b.type === "text")?.text || "Erro na resposta.";
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão. Tenta de novo." }]);
    }
    setLoading(false);
  };

  const addMonth = async () => {
    if (!newMonth.mes || !newMonth.faturamento) return;
    const parsed = {
      mes: newMonth.mes,
      faturamento: Number(newMonth.faturamento),
      custo_producao: Number(newMonth.custo_producao) || 0,
      despesa_fixa: Number(newMonth.despesa_fixa) || 0,
      despesa_variavel: Number(newMonth.despesa_variavel) || 0,
      emprestimo: Number(newMonth.emprestimo) || 0,
      saldo: Number(newMonth.saldo) || 0,
    };
    const newData = { ...data, months: [...data.months, parsed] };
    await saveData(newData);
    setNewMonth({ mes: "", faturamento: "", custo_producao: "", despesa_fixa: "", despesa_variavel: "", emprestimo: "", saldo: "" });
  };

  const addNota = async (texto) => {
    if (!texto.trim()) return;
    const nota = { data: new Date().toLocaleDateString("pt-BR"), texto };
    await saveData({ ...data, notas: [nota, ...data.notas].slice(0, 20) });
  };

  const maxFat = Math.max(...data.months.map(m => m.faturamento));

  const fmt = (v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`;
  const fmtFull = (v) => `R$ ${v.toLocaleString("pt-BR")}`;

  const tabs = ["overview", "financeiro", "crm", "estoque", "chat"];

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace", background: "#0a0a0a", minHeight: "100vh", color: "#e8e0d0", padding: "0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; }
        .tab-btn { background: none; border: none; cursor: pointer; padding: 8px 16px; font-family: inherit; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #555; transition: color 0.2s; }
        .tab-btn.active { color: #c8a96e; border-bottom: 1px solid #c8a96e; }
        .tab-btn:hover { color: #999; }
        .card { background: #111; border: 0.5px solid #222; border-radius: 4px; padding: 16px; }
        .kpi-val { font-size: 22px; font-weight: 600; margin: 4px 0; }
        .kpi-lbl { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #555; }
        .kpi-sub { font-size: 11px; color: #555; }
        .pos { color: #6bb87a; }
        .neg { color: #c05a5a; }
        .warn { color: #c8a96e; }
        .input-field { background: #111; border: 0.5px solid #333; border-radius: 3px; padding: 8px 12px; font-family: inherit; font-size: 12px; color: #e8e0d0; width: 100%; outline: none; }
        .input-field:focus { border-color: #c8a96e; }
        .btn { background: none; border: 0.5px solid #444; border-radius: 3px; padding: 8px 16px; font-family: inherit; font-size: 11px; letter-spacing: 0.08em; color: #c8a96e; cursor: pointer; text-transform: uppercase; transition: all 0.15s; }
        .btn:hover { background: #1a1a1a; border-color: #c8a96e; }
        .btn-primary { background: #c8a96e; color: #0a0a0a; border-color: #c8a96e; }
        .btn-primary:hover { background: #dbb97e; }
        .chat-msg { padding: 10px 14px; border-radius: 3px; font-size: 13px; line-height: 1.6; margin-bottom: 10px; }
        .chat-user { background: #1a1a14; border-left: 2px solid #c8a96e; }
        .chat-ai { background: #111; border-left: 2px solid #444; }
        .bar-track { background: #1a1a1a; border-radius: 2px; height: 6px; margin-top: 4px; }
        .section-title { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #555; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 0.5px solid #1a1a1a; }
        input[type=number] { -moz-appearance: textfield; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
        textarea.input-field { resize: none; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#080808", borderBottom: "0.5px solid #1a1a1a", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.15em", color: "#e8e0d0" }}>EGHO</span>
          <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em" }}>FINANCIAL OPS</span>
        </div>
        <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.08em" }}>
          {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#080808", borderBottom: "0.5px solid #1a1a1a", padding: "0 24px", display: "flex", gap: 4 }}>
        {tabs.map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
            {t === "overview" ? "Visão Geral" : t === "financeiro" ? "Financeiro" : t === "crm" ? "CRM" : t === "estoque" ? "Estoque" : "Chat IA"}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 900 }}>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { lbl: "Último Mês", val: fmtFull(lastMonth?.faturamento || 0), sub: lastMonth?.mes, cls: "" },
                { lbl: "Abr/26 Parcial", val: fmtFull(data.abr_parcial), sub: "shopify · em curso", cls: "warn" },
                { lbl: "Saldo Acum.", val: fmtFull(totalSaldo), sub: "jan–" + (lastMonth?.mes || ""), cls: totalSaldo >= 0 ? "pos" : "neg" },
                { lbl: "Custo Prod.", val: lastCostoPct + "%", sub: "da receita · " + lastMonth?.mes, cls: lastCostoPct > 40 ? "neg" : "warn" },
              ].map((k, i) => (
                <div key={i} className="card">
                  <div className="kpi-lbl">{k.lbl}</div>
                  <div className={`kpi-val ${k.cls}`}>{k.val}</div>
                  <div className="kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Evolução faturamento */}
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="section-title">Evolução do Faturamento</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 80 }}>
                {data.months.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, color: "#555" }}>{fmt(m.faturamento)}</div>
                    <div style={{
                      width: "100%", background: m.saldo >= 0 ? "#2a3d2a" : "#3d2a2a",
                      border: `0.5px solid ${m.saldo >= 0 ? "#4a6a4a" : "#6a3a3a"}`,
                      borderRadius: 2,
                      height: Math.max(8, (m.faturamento / maxFat) * 60) + "px"
                    }} />
                    <div style={{ fontSize: 9, color: "#444" }}>{m.mes}</div>
                  </div>
                ))}
                {data.abr_parcial > 0 && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, color: "#c8a96e" }}>{fmt(data.abr_parcial)}~</div>
                    <div style={{
                      width: "100%", background: "#2a2a1a",
                      border: "0.5px dashed #c8a96e", borderRadius: 2,
                      height: Math.max(8, (data.abr_parcial / maxFat) * 60) + "px"
                    }} />
                    <div style={{ fontSize: 9, color: "#c8a96e" }}>Abr/26</div>
                  </div>
                )}
              </div>
            </div>

            {/* Alertas */}
            <div className="card">
              <div className="section-title">Alertas Ativos</div>
              {[
                { tipo: "neg", txt: "Dívida Itaú R$95.5k acumulando juros — sem prazo de quitação definido" },
                { tipo: "neg", txt: `Custo de produção em ${lastCostoPct}% da receita — ideal seria 25–35%` },
                { tipo: "warn", txt: "Abr/26 no ritmo de R$3k/dia — precisa de ativação pra fechar acima de R$90k" },
                { tipo: "warn", txt: "109 unidades Post Viva Band Tee paradas — maior estoque da loja" },
                { tipo: "pos", txt: "SMS converte 3x mais que email — canal prioritário para ativações" },
                { tipo: "pos", txt: "Base SMS crescendo: 6.0k → 6.3k inscritos em 4 meses" },
              ].map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 12, lineHeight: 1.5 }}>
                  <span style={{ color: a.tipo === "neg" ? "#c05a5a" : a.tipo === "warn" ? "#c8a96e" : "#6bb87a", flexShrink: 0 }}>
                    {a.tipo === "neg" ? "▲" : a.tipo === "warn" ? "◆" : "●"}
                  </span>
                  <span style={{ color: "#aaa" }}>{a.txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FINANCEIRO */}
        {activeTab === "financeiro" && (
          <div>
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="section-title">Histórico Mensal</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#555", fontSize: 10, letterSpacing: "0.08em" }}>
                      {["Mês", "Faturamento", "Custo Prod.", "% CP", "Desp. Fixa", "Desp. Var.", "Empréstimo", "Saldo"].map(h => (
                        <th key={h} style={{ textAlign: "right", padding: "6px 10px", fontWeight: 400, borderBottom: "0.5px solid #1a1a1a" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.map((m, i) => {
                      const cp = Math.round((m.custo_producao / m.faturamento) * 100);
                      return (
                        <tr key={i} style={{ borderBottom: "0.5px solid #151515" }}>
                          <td style={{ padding: "8px 10px", color: "#888", fontSize: 11 }}>{m.mes}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtFull(m.faturamento)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#aaa" }}>{fmtFull(m.custo_producao)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: cp > 40 ? "#c05a5a" : "#6bb87a" }}>{cp}%</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#aaa" }}>{fmtFull(m.despesa_fixa)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#aaa" }}>{fmtFull(m.despesa_variavel)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: m.emprestimo > 0 ? "#c05a5a" : "#444" }}>{m.emprestimo > 0 ? fmtFull(m.emprestimo) : "—"}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: m.saldo >= 0 ? "#6bb87a" : "#c05a5a", fontWeight: 500 }}>{fmtFull(m.saldo)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="section-title">Adicionar Mês</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[
                  ["mes", "Mês (ex: Mai/26)"], ["faturamento", "Faturamento"],
                  ["custo_producao", "Custo Produção"], ["despesa_fixa", "Desp. Fixa"],
                  ["despesa_variavel", "Desp. Variável"], ["emprestimo", "Empréstimo"],
                  ["saldo", "Saldo Operacional"]
                ].map(([k, lbl]) => (
                  <div key={k}>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>{lbl}</div>
                    <input
                      className="input-field"
                      type={k === "mes" ? "text" : "number"}
                      placeholder={k === "mes" ? "Mai/26" : "0"}
                      value={newMonth[k]}
                      onChange={e => setNewMonth(prev => ({ ...prev, [k]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={addMonth}>Salvar Mês</button>
            </div>
          </div>
        )}

        {/* CRM */}
        {activeTab === "crm" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[
                { lbl: "Receita Total Edrone", val: fmtFull(data.crm.receita_edrone), sub: "fev–abr/26", cls: "pos" },
                { lbl: "Receita SMS", val: fmtFull(data.crm.sms_receita), sub: "66.8% da receita CRM", cls: "pos" },
                { lbl: "Receita Email", val: fmtFull(data.crm.email_receita), sub: "30.7% — baixa eficiência", cls: "warn" },
              ].map((k, i) => (
                <div key={i} className="card">
                  <div className="kpi-lbl">{k.lbl}</div>
                  <div className={`kpi-val ${k.cls}`}>{k.val}</div>
                  <div className="kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 10 }}>
              <div className="section-title">Performance por Automação</div>
              {[
                { nome: "Boas-vindas", receita: 9002, pedidos: 29, cor: "#6bb87a" },
                { nome: "Carrinho abandonado", receita: 9090, pedidos: 20, cor: "#6bb87a" },
                { nome: "Produtos recomendados", receita: 7020, pedidos: 21, cor: "#c8a96e" },
                { nome: "After purchase rewards", receita: 6240, pedidos: 11, cor: "#c8a96e" },
                { nome: "Produtos visualizados", receita: 5511, pedidos: 16, cor: "#c8a96e" },
                { nome: "Recuperação de clientes", receita: 1512, pedidos: 4, cor: "#c05a5a" },
                { nome: "Programa de fidelidade", receita: 313, pedidos: 1, cor: "#c05a5a" },
              ].map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 180, fontSize: 12, color: "#aaa" }}>{a.nome}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 2 }}>
                      <span>{fmtFull(a.receita)}</span>
                      <span>{a.pedidos} pedidos</span>
                    </div>
                    <div className="bar-track">
                      <div style={{ height: 6, borderRadius: 2, background: a.cor, width: `${(a.receita / 9090) * 100}%`, transition: "width 0.5s" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="section-title">Base de Contatos</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { lbl: "Email inscritos", val: data.crm.base_email.toLocaleString("pt-BR"), trend: "↑ jan: 9.2k → abr: 10.1k" },
                  { lbl: "SMS inscritos", val: data.crm.base_sms.toLocaleString("pt-BR"), trend: "↑ jan: 6.0k → abr: 6.3k" },
                ].map((b, i) => (
                  <div key={i} style={{ padding: "12px", background: "#0d0d0d", borderRadius: 3, border: "0.5px solid #1a1a1a" }}>
                    <div className="kpi-lbl">{b.lbl}</div>
                    <div style={{ fontSize: 24, fontWeight: 600, margin: "4px 0" }}>{b.val}</div>
                    <div style={{ fontSize: 11, color: "#6bb87a" }}>{b.trend}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ESTOQUE */}
        {activeTab === "estoque" && (
          <div>
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="section-title">Produtos com Maior Estoque</div>
              {data.estoque_destaque.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, textAlign: "right", fontSize: 10, color: "#444" }}>#{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 12, color: "#aaa" }}>{p.nome}</div>
                  <div style={{ width: 80 }}>
                    <div className="bar-track">
                      <div style={{ height: 6, borderRadius: 2, background: p.qty > 80 ? "#c05a5a" : "#c8a96e", width: `${(p.qty / 120) * 100}%` }} />
                    </div>
                  </div>
                  <div style={{ width: 40, textAlign: "right", fontSize: 13, fontWeight: 500, color: p.qty > 80 ? "#c05a5a" : "#c8a96e" }}>{p.qty}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="section-title">Notas de Estoque / Lançamentos</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  id="nota-input"
                  className="input-field"
                  placeholder="ex: restock army dad hat chegou 50 un | Working Title esgotado"
                  onKeyDown={e => { if (e.key === "Enter") { addNota(e.target.value); e.target.value = ""; } }}
                />
                <button className="btn" onClick={() => { const el = document.getElementById("nota-input"); addNota(el.value); el.value = ""; }}>+ Nota</button>
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {data.notas.length === 0 && <div style={{ fontSize: 12, color: "#444" }}>Nenhuma nota ainda. Adiciona aí.</div>}
                {data.notas.map((n, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#888", padding: "6px 0", borderBottom: "0.5px solid #151515" }}>
                    <span style={{ color: "#555", marginRight: 8 }}>{n.data}</span>{n.texto}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CHAT */}
        {activeTab === "chat" && (
          <div>
            <div className="card" style={{ marginBottom: 10, height: 420, overflowY: "auto", padding: "16px" }}>
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role === "user" ? "chat-user" : "chat-ai"}`}>
                  <div style={{ fontSize: 9, color: "#555", marginBottom: 6, letterSpacing: "0.1em" }}>
                    {m.role === "user" ? "VOCÊ" : "EGHO ADVISOR"}
                  </div>
                  <div style={{ color: m.role === "user" ? "#e8e0d0" : "#bbb", whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className="chat-msg chat-ai">
                  <div style={{ fontSize: 9, color: "#555", marginBottom: 6 }}>EGHO ADVISOR</div>
                  <div style={{ color: "#555" }}>analisando...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Cole dados, tire dúvidas, peça análise... ex: 'faturamos 45k na primeira quinzena de maio, o que isso indica?' ou 'quero saber como fechar abril mais forte'"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <button className="btn btn-primary" onClick={sendMessage} style={{ alignSelf: "flex-end", padding: "12px 20px" }} disabled={loading}>
                {loading ? "..." : "→"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#333", marginTop: 6 }}>Enter envia · Shift+Enter quebra linha</div>
          </div>
        )}

      </div>
    </div>
  );
}
