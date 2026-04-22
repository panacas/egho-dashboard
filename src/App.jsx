import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "egho_dashboard_v2";

const INITIAL_DATA = {
  months: [
    { mes: "Jan/26", faturamento: 257391, custo_producao: 78405, despesa_fixa: 29984, despesa_variavel: 58284, emprestimo: 0, saldo: 64481, pedidos: 0, meta: 250000 },
    { mes: "Fev/26", faturamento: 152376, custo_producao: 73969, despesa_fixa: 16561, despesa_variavel: 44921, emprestimo: 0, saldo: -1445, pedidos: 108, meta: 180000 },
    { mes: "Mar/26", faturamento: 193624, custo_producao: 65878, despesa_fixa: 46943, despesa_variavel: 40063, emprestimo: 18136, saldo: 14581, pedidos: 482, meta: 200000 },
  ],
  abr_parcial: 66352,
  abr_pedidos: 200,
  abr_dias_passados: 22,
  abr_dias_mes: 30,
  abr_meta: 120000,
  divida_itau: 95500,
  investimento_midia: 11000,
  breakeven: 130000,
  crm: {
    receita_edrone: 69944,
    sms_receita: 46732,
    email_receita: 21453,
    whatsapp_receita: 1759,
    carrinho_abandonado: 9090,
    boas_vindas: 9002,
    produtos_recomendados: 7020,
    after_purchase: 6240,
    produtos_visualizados: 5511,
    recuperacao: 1512,
    fidelidade: 313,
    base_email: 10116,
    base_sms: 6282,
    base_whatsapp: 592,
  },
  produtos: [
    { nome: "Post Viva Band Tee Charcoal", qty: 109, preco: 269, custo: 95, categoria: "tee" },
    { nome: "Black Bird Tee OW", qty: 94, preco: 269, custo: 90, categoria: "tee" },
    { nome: "Black Metal Cap Resin", qty: 78, preco: 265, custo: 85, categoria: "cap" },
    { nome: "Board Shorts Camo", qty: 71, preco: 559, custo: 190, categoria: "bottom" },
    { nome: "Guerrilla Denim Preta", qty: 64, preco: 569, custo: 210, categoria: "bottom" },
    { nome: "Army Dad Hat Camo", qty: 61, preco: 299, custo: 90, categoria: "cap" },
    { nome: "UNF Loose Sweatshorts Sand", qty: 46, preco: 299, custo: 100, categoria: "bottom" },
    { nome: "Cyber Patrol Cap", qty: 45, preco: 279, custo: 88, categoria: "cap" },
    { nome: "Rusty Signs Boxy Tee", qty: 42, preco: 299, custo: 95, categoria: "tee" },
    { nome: "Gears Boxy Tee Off", qty: 41, preco: 299, custo: 95, categoria: "tee" },
    { nome: "Industry Regular Tee Gray", qty: 39, preco: 269, custo: 88, categoria: "tee" },
    { nome: "Delusional Regular Tee OW", qty: 37, preco: 269, custo: 88, categoria: "tee" },
  ],
  meta_ads: [
    { campanha: "Caps Geral", gasto: 3200, receita: 18400, pedidos: 42 },
    { campanha: "Bottoms / Calças", gasto: 2800, receita: 12600, pedidos: 24 },
    { campanha: "Tees Best Sellers", gasto: 2500, receita: 9800, pedidos: 38 },
    { campanha: "Retargeting", gasto: 1500, receita: 8200, pedidos: 19 },
    { campanha: "Novos lançamentos", gasto: 1000, receita: 2100, pedidos: 8 },
  ],
  recompra: { taxa: 28, primeira_compra: 72 },
  notas: [],
};

const SYSTEM_PROMPT = `Você é o consultor financeiro e estratégico da EGHO, marca de streetwear brasileira fundada por Romério Castro em São Paulo. Estética militarista, urbana, rustica e guerrilha.

CONTEXTO FINANCEIRO:
- Jan/26: Fat R$257k, Saldo +R$64k
- Fev/26: Fat R$152k, Saldo -R$1.4k (custo produção 55% da receita)
- Mar/26: Fat R$193k, Saldo +R$14.5k (pagou R$18k empréstimo)
- Abr/26 parcial (22 dias): R$66k Shopify, ritmo R$3k/dia, meta R$120k
- Dívida Itaú: R$95.5k acumulando juros, não quitada
- Breakeven mensal estimado: R$130k
- Investimento mídia paga: R$10–12k/mês

ESTOQUE CRÍTICO: Post Viva Band (109un), Black Bird Tee (94un), Black Metal Cap (78un), Board Shorts Camo (71un), Guerrilla Denim (64un), Army Dad Hat (61un)

CRM (fev–abr): SMS gera 66.8% da receita CRM com 1/60 do volume de email. Boas-vindas R$9k automático. Carrinho abandonado R$9k (7.3% CTR).

META ADS: Caps têm melhor ROAS (~5.7x). Novos lançamentos com ROAS 2.1x (abaixo do ideal). Retargeting eficiente.

TAXA RECOMPRA: 28% — baixa para streetwear premium (ideal 35-45%).

Fale em português informal (tutear). Seja direto e prático. Priorize ações que impactam caixa imediato. Quando receber novos dados, atualize sua análise.`;

export default function EGHODashboard() {
  const [data, setData] = useState(INITIAL_DATA);
  const [activeTab, setActiveTab] = useState("overview");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Fala Romério. Dashboard v2 carregado — agora com Meta Ads, giro de estoque, projeção e margem por produto. O que quer analisar primeiro?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [newMonth, setNewMonth] = useState({ mes: "", faturamento: "", custo_producao: "", despesa_fixa: "", despesa_variavel: "", emprestimo: "", saldo: "", pedidos: "", meta: "" });
  const [notaInput, setNotaInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    try {
      const load = async () => {
        const saved = await window.storage?.get(STORAGE_KEY);
        if (saved) setData(JSON.parse(saved.value));
      };
      load();
    } catch {}
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const saveData = async (d) => { setData(d); try { await window.storage?.set(STORAGE_KEY, JSON.stringify(d)); } catch {} };

  const fmt = (v) => `R$${(v / 1000).toFixed(0)}k`;
  const fmtFull = (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  const fmtPct = (v) => `${Math.round(v)}%`;

  // Cálculos derivados
  const projecaoAbr = Math.round((data.abr_parcial / data.abr_dias_passados) * data.abr_dias_mes);
  const ritmoAbr = Math.round(data.abr_parcial / data.abr_dias_passados);
  const ritmoNecessario = Math.round((data.abr_meta - data.abr_parcial) / (data.abr_dias_mes - data.abr_dias_passados));
  const abrPctMeta = Math.round((data.abr_parcial / data.abr_meta) * 100);
  const lastMonth = data.months[data.months.length - 1];
  const avgFat = Math.round(data.months.reduce((s, m) => s + m.faturamento, 0) / data.months.length);
  const totalSaldo = data.months.reduce((s, m) => s + m.saldo, 0);
  const totalMidiaRoas = data.meta_ads.reduce((s, c) => s + c.receita, 0) / data.meta_ads.reduce((s, c) => s + c.gasto, 0);
  const estoqueCapitalTotal = data.produtos.reduce((s, p) => s + p.qty * p.custo, 0);
  const estoqueValorVenda = data.produtos.reduce((s, p) => s + p.qty * p.preco, 0);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const hist = [...messages, userMsg];
    setMessages(hist);
    setInput("");
    setLoading(true);
    const ctx = `DADOS ATUAIS:\n${JSON.stringify({ months: data.months, abr_parcial: data.abr_parcial, abr_meta: data.abr_meta, projecao_abr: projecaoAbr, ritmo_diario: ritmoAbr, ritmo_necessario: ritmoNecessario, divida_itau: data.divida_itau, breakeven: data.breakeven, meta_ads: data.meta_ads, roas_total: totalMidiaRoas.toFixed(2), estoque_capital_parado: estoqueCapitalTotal, taxa_recompra: data.recompra, notas: data.notas }, null, 2)}`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM_PROMPT + "\n\n" + ctx, messages: hist.map(m => ({ role: m.role, content: m.content })) })
      });
      const d = await r.json();
      const text = d.content?.find(b => b.type === "text")?.text || "Erro.";
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão." }]); }
    setLoading(false);
  };

  const addMonth = async () => {
    if (!newMonth.mes || !newMonth.faturamento) return;
    const m = { mes: newMonth.mes, faturamento: +newMonth.faturamento, custo_producao: +newMonth.custo_producao||0, despesa_fixa: +newMonth.despesa_fixa||0, despesa_variavel: +newMonth.despesa_variavel||0, emprestimo: +newMonth.emprestimo||0, saldo: +newMonth.saldo||0, pedidos: +newMonth.pedidos||0, meta: +newMonth.meta||0 };
    await saveData({ ...data, months: [...data.months, m] });
    setNewMonth({ mes: "", faturamento: "", custo_producao: "", despesa_fixa: "", despesa_variavel: "", emprestimo: "", saldo: "", pedidos: "", meta: "" });
  };

  const addNota = async () => {
    if (!notaInput.trim()) return;
    const nota = { data: new Date().toLocaleDateString("pt-BR"), texto: notaInput };
    await saveData({ ...data, notas: [nota, ...data.notas].slice(0, 30) });
    setNotaInput("");
  };

  const tabs = ["overview", "projecao", "financeiro", "estoque", "midia", "crm", "chat"];
  const tabLabels = { overview: "Visão Geral", projecao: "Projeção", financeiro: "Financeiro", estoque: "Estoque", midia: "Meta Ads", crm: "CRM", chat: "Chat IA" };

  const maxFat = Math.max(...data.months.map(m => m.faturamento), projecaoAbr);

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace", background: "#0a0a0a", minHeight: "100vh", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; }
        .tab { background: none; border: none; cursor: pointer; padding: 8px 14px; font-family: inherit; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #444; transition: color 0.2s; border-bottom: 1px solid transparent; }
        .tab.on { color: #c8a96e; border-bottom-color: #c8a96e; }
        .tab:hover { color: #888; }
        .card { background: #111; border: 0.5px solid #1e1e1e; border-radius: 3px; padding: 14px; }
        .kv { font-size: 20px; font-weight: 600; margin: 4px 0 2px; }
        .kl { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #555; }
        .ks { font-size: 10px; color: #555; }
        .pos { color: #6bb87a; } .neg { color: #c05a5a; } .warn { color: #c8a96e; } .muted { color: #555; }
        .inp { background: #0d0d0d; border: 0.5px solid #2a2a2a; border-radius: 2px; padding: 7px 10px; font-family: inherit; font-size: 11px; color: #e8e0d0; width: 100%; outline: none; }
        .inp:focus { border-color: #c8a96e; }
        .btn { background: none; border: 0.5px solid #333; border-radius: 2px; padding: 7px 14px; font-family: inherit; font-size: 10px; letter-spacing: 0.08em; color: #c8a96e; cursor: pointer; text-transform: uppercase; }
        .btn:hover { background: #1a1a14; border-color: #c8a96e; }
        .btnp { background: #c8a96e; color: #0a0a0a; border-color: #c8a96e; }
        .btnp:hover { background: #dab97e; }
        .chat-u { background: #14140e; border-left: 2px solid #c8a96e; padding: 10px 14px; border-radius: 2px; margin-bottom: 8px; font-size: 12px; line-height: 1.6; }
        .chat-a { background: #0f0f0f; border-left: 2px solid #2a2a2a; padding: 10px 14px; border-radius: 2px; margin-bottom: 8px; font-size: 12px; line-height: 1.6; color: #aaa; white-space: pre-wrap; }
        .trk { background: #151515; border-radius: 2px; height: 5px; }
        .sec { font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: #444; margin: 16px 0 10px; padding-bottom: 5px; border-bottom: 0.5px solid #151515; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .alert { border-radius: 2px; padding: 10px 14px; margin-bottom: 8px; font-size: 12px; display: flex; gap: 10px; line-height: 1.5; }
        .ar { background: #1a0f0f; color: #c05a5a; border: 0.5px solid #3a1515; }
        .aw { background: #1a160a; color: #c8a96e; border: 0.5px solid #3a2e10; }
        .ag { background: #0f1a0f; color: #6bb87a; border: 0.5px solid #153515; }
        .ai { background: #0f0f1a; color: #6b8ac0; border: 0.5px solid #151535; }
        textarea.inp { resize: none; }
        input[type=number] { -moz-appearance: textfield; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
        .tag { display: inline-block; font-size: 9px; padding: 2px 6px; border-radius: 2px; letter-spacing: 0.06em; text-transform: uppercase; }
        .tag-r { background: #1a0f0f; color: #c05a5a; border: 0.5px solid #3a1515; }
        .tag-g { background: #0f1a0f; color: #6bb87a; border: 0.5px solid #153515; }
        .tag-w { background: #1a160a; color: #c8a96e; border: 0.5px solid #3a2e10; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#060606", borderBottom: "0.5px solid #151515", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.2em" }}>EGHO</span>
          <span style={{ fontSize: 9, color: "#333", letterSpacing: "0.12em" }}>OPS DASHBOARD v2</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ fontSize: 9, color: "#444" }}>BREAKEVEN <span style={{ color: data.abr_parcial > data.breakeven ? "#6bb87a" : "#c05a5a" }}>{fmt(data.breakeven)}</span></div>
          <div style={{ fontSize: 9, color: "#444" }}>DÍVIDA ITAÚ <span style={{ color: "#c05a5a" }}>{fmtFull(data.divida_itau)}</span></div>
          <div style={{ fontSize: 9, color: "#333" }}>{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#060606", borderBottom: "0.5px solid #151515", padding: "0 20px", display: "flex", gap: 2, overflowX: "auto" }}>
        {tabs.map(t => <button key={t} className={`tab ${activeTab === t ? "on" : ""}`} onClick={() => setActiveTab(t)}>{tabLabels[t]}</button>)}
      </div>

      <div style={{ padding: "16px 20px", maxWidth: 960 }}>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <div className="grid4" style={{ marginBottom: 12 }}>
              {[
                { l: "Abr/26 parcial", v: fmtFull(data.abr_parcial), s: `${abrPctMeta}% da meta · dia ${data.abr_dias_passados}`, c: abrPctMeta >= 70 ? "pos" : abrPctMeta >= 50 ? "warn" : "neg" },
                { l: "Projeção Abr", v: fmtFull(projecaoAbr), s: `ritmo ${fmtFull(ritmoAbr)}/dia`, c: projecaoAbr >= data.abr_meta ? "pos" : "warn" },
                { l: "Saldo Acumulado", v: fmtFull(totalSaldo), s: "jan–mar/26", c: totalSaldo >= 0 ? "pos" : "neg" },
                { l: "Média Mensal", v: fmtFull(avgFat), s: "jan–mar/26", c: "" },
              ].map((k, i) => (
                <div key={i} className="card">
                  <div className="kl">{k.l}</div>
                  <div className={`kv ${k.c}`}>{k.v}</div>
                  <div className="ks">{k.s}</div>
                </div>
              ))}
            </div>

            {/* Barra progresso Abril */}
            <div className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Abril — progresso vs meta</span>
                <span style={{ fontSize: 10, color: "#c8a96e" }}>{fmtFull(data.abr_parcial)} / {fmtFull(data.abr_meta)}</span>
              </div>
              <div className="trk" style={{ height: 8, marginBottom: 6 }}>
                <div style={{ height: 8, borderRadius: 2, width: `${Math.min(100, abrPctMeta)}%`, background: abrPctMeta >= 80 ? "#6bb87a" : abrPctMeta >= 50 ? "#c8a96e" : "#c05a5a", transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555" }}>
                <span>Ritmo atual: {fmtFull(ritmoAbr)}/dia</span>
                <span>Precisa: {fmtFull(ritmoNecessario)}/dia nos próximos {data.abr_dias_mes - data.abr_dias_passados} dias</span>
              </div>
            </div>

            {/* Gráfico barras */}
            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">Evolução faturamento</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 80 }}>
                {data.months.map((m, i) => {
                  const pctMeta = m.meta > 0 ? Math.round((m.faturamento / m.meta) * 100) : null;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 9, color: m.saldo >= 0 ? "#6bb87a" : "#c05a5a" }}>{fmt(m.faturamento)}</div>
                      <div style={{ width: "100%", background: m.saldo >= 0 ? "#1a2e1a" : "#2e1a1a", border: `0.5px solid ${m.saldo >= 0 ? "#3a5a3a" : "#5a2a2a"}`, borderRadius: 2, height: `${Math.max(8, (m.faturamento / maxFat) * 65)}px` }} />
                      {pctMeta && <div style={{ fontSize: 8, color: pctMeta >= 100 ? "#6bb87a" : "#c8a96e" }}>{pctMeta}%</div>}
                      <div style={{ fontSize: 9, color: "#444" }}>{m.mes}</div>
                    </div>
                  );
                })}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 9, color: "#c8a96e" }}>{fmt(projecaoAbr)}~</div>
                  <div style={{ width: "100%", background: "#1a1a0a", border: "0.5px dashed #c8a96e", borderRadius: 2, height: `${Math.max(8, (projecaoAbr / maxFat) * 65)}px` }} />
                  <div style={{ fontSize: 8, color: abrPctMeta >= 80 ? "#6bb87a" : "#c8a96e" }}>{abrPctMeta}%</div>
                  <div style={{ fontSize: 9, color: "#c8a96e" }}>Abr/26</div>
                </div>
              </div>
            </div>

            {/* Alertas */}
            <div className="card">
              <div className="sec">Alertas ativos</div>
              {[
                { t: "ar", icon: "▲", txt: `Dívida Itaú ${fmtFull(data.divida_itau)} acumulando juros — sem plano de quitação` },
                { t: "ar", icon: "▲", txt: `Custo de produção em ${Math.round((lastMonth.custo_producao / lastMonth.faturamento) * 100)}% da receita em ${lastMonth.mes} — ideal 25–35%` },
                { t: "aw", icon: "◆", txt: `Ritmo de abr precisa subir de ${fmtFull(ritmoAbr)}/dia para ${fmtFull(ritmoNecessario)}/dia pra bater a meta` },
                { t: "aw", icon: "◆", txt: `${fmtFull(estoqueCapitalTotal)} em capital parado no estoque — ${data.produtos[0].nome} com ${data.produtos[0].qty} unidades` },
                { t: "aw", icon: "◆", txt: `Taxa de recompra em ${data.recompra.taxa}% — abaixo do ideal de 35–45% para streetwear` },
                { t: "ag", icon: "●", txt: `SMS converte 3.4x mais que email — canal prioritário para ativações imediatas` },
                { t: "ag", icon: "●", txt: `ROAS total Meta Ads em ${totalMidiaRoas.toFixed(1)}x — caps com melhor performance` },
                { t: "ai", icon: "◉", txt: `Novos lançamentos com ROAS 2.1x — redistribuir verba para caps e retargeting` },
              ].map((a, i) => (
                <div key={i} className={`alert ${a.t}`}>
                  <span style={{ flexShrink: 0 }}>{a.icon}</span>
                  <span>{a.txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROJEÇÃO */}
        {activeTab === "projecao" && (
          <div>
            <div className="grid3" style={{ marginBottom: 12 }}>
              {[
                { l: "Projeção Fechamento", v: fmtFull(projecaoAbr), s: `baseado em ${fmtFull(ritmoAbr)}/dia`, c: projecaoAbr >= data.abr_meta ? "pos" : "warn" },
                { l: "Meta Abril", v: fmtFull(data.abr_meta), s: `${abrPctMeta}% atingido`, c: "" },
                { l: "Gap pra Meta", v: fmtFull(Math.max(0, data.abr_meta - projecaoAbr)), s: projecaoAbr >= data.abr_meta ? "meta atingível no ritmo atual" : `precisa +${fmtFull(ritmoNecessario - ritmoAbr)}/dia`, c: projecaoAbr >= data.abr_meta ? "pos" : "neg" },
              ].map((k, i) => <div key={i} className="card"><div className="kl">{k.l}</div><div className={`kv ${k.c}`}>{k.v}</div><div className="ks">{k.s}</div></div>)}
            </div>

            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">Cenários de fechamento</div>
              {[
                { label: "Ritmo atual mantido", valor: projecaoAbr, descricao: `${fmtFull(ritmoAbr)}/dia pelos próximos ${data.abr_dias_mes - data.abr_dias_passados} dias` },
                { label: "Com 1 SMS hoje (estimativa)", valor: projecaoAbr + 3500, descricao: "histórico: SMS gera R$2.5k–5.8k em 24h" },
                { label: "Ritmo necessário pra meta", valor: data.abr_meta, descricao: `precisa ${fmtFull(ritmoNecessario)}/dia` },
              ].map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 220, fontSize: 12, color: "#aaa" }}>{c.label}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginBottom: 3 }}>
                      <span>{fmtFull(c.valor)}</span>
                      <span>{c.descricao}</span>
                    </div>
                    <div className="trk">
                      <div style={{ height: 5, borderRadius: 2, background: c.valor >= data.abr_meta ? "#6bb87a" : "#c8a96e", width: `${Math.min(100, Math.round((c.valor / data.abr_meta) * 100))}%` }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, width: 40, textAlign: "right", color: c.valor >= data.abr_meta ? "#6bb87a" : "#c8a96e" }}>{Math.round((c.valor / data.abr_meta) * 100)}%</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">Atualizar dados de abril</div>
              <div className="grid4" style={{ marginBottom: 10 }}>
                {[
                  ["abr_parcial", "Faturamento parcial"],
                  ["abr_dias_passados", "Dias passados"],
                  ["abr_meta", "Meta do mês"],
                  ["abr_pedidos", "Pedidos parcial"],
                ].map(([k, lbl]) => (
                  <div key={k}>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>{lbl}</div>
                    <input className="inp" type="number" value={data[k]} onChange={e => saveData({ ...data, [k]: +e.target.value })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="sec">Configurações base</div>
              <div className="grid3">
                {[
                  ["breakeven", "Breakeven mensal"],
                  ["investimento_midia", "Investimento mídia"],
                  ["divida_itau", "Dívida Itaú"],
                ].map(([k, lbl]) => (
                  <div key={k}>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{lbl}</div>
                    <input className="inp" type="number" value={data[k]} onChange={e => saveData({ ...data, [k]: +e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FINANCEIRO */}
        {activeTab === "financeiro" && (
          <div>
            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">Histórico mensal</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{["Mês", "Faturamento", "Meta", "%", "C.Prod", "%CP", "D.Fixa", "D.Var", "Emprést.", "Saldo", "Pedidos"].map(h => <th key={h} style={{ textAlign: "right", padding: "5px 8px", fontWeight: 400, fontSize: 9, color: "#444", borderBottom: "0.5px solid #151515", letterSpacing: "0.08em" }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.months.map((m, i) => {
                      const cp = Math.round((m.custo_producao / m.faturamento) * 100);
                      const pctMeta = m.meta > 0 ? Math.round((m.faturamento / m.meta) * 100) : null;
                      return (
                        <tr key={i} style={{ borderBottom: "0.5px solid #0f0f0f" }}>
                          <td style={{ padding: "7px 8px", color: "#777", fontSize: 10 }}>{m.mes}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right" }}>{fmtFull(m.faturamento)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#555" }}>{m.meta > 0 ? fmtFull(m.meta) : "—"}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: pctMeta ? (pctMeta >= 100 ? "#6bb87a" : "#c8a96e") : "#555" }}>{pctMeta ? pctMeta + "%" : "—"}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#888" }}>{fmtFull(m.custo_producao)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: cp > 40 ? "#c05a5a" : "#6bb87a" }}>{cp}%</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#888" }}>{fmtFull(m.despesa_fixa)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#888" }}>{fmtFull(m.despesa_variavel)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: m.emprestimo > 0 ? "#c05a5a" : "#333" }}>{m.emprestimo > 0 ? fmtFull(m.emprestimo) : "—"}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 500, color: m.saldo >= 0 ? "#6bb87a" : "#c05a5a" }}>{fmtFull(m.saldo)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#666" }}>{m.pedidos > 0 ? m.pedidos : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="sec">Adicionar mês</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                {[["mes","Mês (ex: Mai/26)"],["faturamento","Faturamento"],["meta","Meta"],["custo_producao","Custo Produção"],["despesa_fixa","Desp. Fixa"],["despesa_variavel","Desp. Variável"],["emprestimo","Empréstimo"],["saldo","Saldo Operacional"],["pedidos","Pedidos"]].map(([k,lbl]) => (
                  <div key={k}>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{lbl}</div>
                    <input className="inp" type={k === "mes" ? "text" : "number"} placeholder={k === "mes" ? "Mai/26" : "0"} value={newMonth[k]} onChange={e => setNewMonth(p => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <button className="btn btnp" onClick={addMonth}>Salvar mês</button>
            </div>
          </div>
        )}

        {/* ESTOQUE */}
        {activeTab === "estoque" && (
          <div>
            <div className="grid3" style={{ marginBottom: 12 }}>
              {[
                { l: "Capital parado", v: fmtFull(estoqueCapitalTotal), s: "custo dos produtos em estoque", c: "neg" },
                { l: "Potencial receita", v: fmtFull(estoqueValorVenda), s: "se vender tudo no preço cheio", c: "pos" },
                { l: "Margem potencial", v: fmtFull(estoqueValorVenda - estoqueCapitalTotal), s: `${Math.round(((estoqueValorVenda - estoqueCapitalTotal) / estoqueValorVenda) * 100)}% de margem bruta`, c: "warn" },
              ].map((k, i) => <div key={i} className="card"><div className="kl">{k.l}</div><div className={`kv ${k.c}`}>{k.v}</div><div className="ks">{k.s}</div></div>)}
            </div>

            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">Estoque por produto — capital imobilizado</div>
              {data.produtos.map((p, i) => {
                const capital = p.qty * p.custo;
                const margem = Math.round(((p.preco - p.custo) / p.preco) * 100);
                const urgencia = p.qty > 80 ? "tag-r" : p.qty > 50 ? "tag-w" : "tag-g";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <div style={{ width: 220, fontSize: 11, color: "#aaa" }}>{p.nome}</div>
                    <span className={`tag ${urgencia}`}>{p.qty} un</span>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <div className="trk">
                        <div style={{ height: 5, borderRadius: 2, background: p.qty > 80 ? "#c05a5a" : p.qty > 50 ? "#c8a96e" : "#6bb87a", width: `${(p.qty / 120) * 100}%` }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "#c05a5a", width: 70, textAlign: "right" }}>{fmtFull(capital)}</div>
                    <div style={{ fontSize: 10, color: "#6bb87a", width: 40, textAlign: "right" }}>{margem}%mg</div>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <div className="sec">Notas de estoque / lançamentos</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input className="inp" value={notaInput} onChange={e => setNotaInput(e.target.value)} placeholder="ex: restock army dad hat 50un chegou · blood denim esgotado" onKeyDown={e => e.key === "Enter" && addNota()} />
                <button className="btn" onClick={addNota}>+ nota</button>
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {data.notas.length === 0 ? <div style={{ fontSize: 11, color: "#333" }}>nenhuma nota ainda.</div> : data.notas.map((n, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#777", padding: "5px 0", borderBottom: "0.5px solid #111" }}><span style={{ color: "#444", marginRight: 8 }}>{n.data}</span>{n.texto}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* META ADS */}
        {activeTab === "midia" && (
          <div>
            <div className="grid4" style={{ marginBottom: 12 }}>
              {[
                { l: "Gasto total", v: fmtFull(data.meta_ads.reduce((s, c) => s + c.gasto, 0)), s: "mês referência", c: "" },
                { l: "Receita gerada", v: fmtFull(data.meta_ads.reduce((s, c) => s + c.receita, 0)), s: "atribuída ao Meta", c: "pos" },
                { l: "ROAS médio", v: `${totalMidiaRoas.toFixed(1)}x`, s: "retorno por R$1 investido", c: totalMidiaRoas >= 4 ? "pos" : totalMidiaRoas >= 2.5 ? "warn" : "neg" },
                { l: "Pedidos via ads", v: data.meta_ads.reduce((s, c) => s + c.pedidos, 0), s: "total de pedidos", c: "" },
              ].map((k, i) => <div key={i} className="card"><div className="kl">{k.l}</div><div className={`kv ${k.c}`}>{k.v}</div><div className="ks">{k.s}</div></div>)}
            </div>

            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">ROAS por campanha</div>
              {data.meta_ads.map((c, i) => {
                const roas = (c.receita / c.gasto);
                const cpa = Math.round(c.gasto / c.pedidos);
                const color = roas >= 5 ? "#6bb87a" : roas >= 3 ? "#c8a96e" : "#c05a5a";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 180, fontSize: 11, color: "#aaa" }}>{c.campanha}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginBottom: 3 }}>
                        <span>{fmtFull(c.gasto)} gasto → {fmtFull(c.receita)}</span>
                        <span>CPA {fmtFull(cpa)} · {c.pedidos} pedidos</span>
                      </div>
                      <div className="trk">
                        <div style={{ height: 5, borderRadius: 2, background: color, width: `${Math.min(100, (roas / 7) * 100)}%` }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, width: 50, textAlign: "right", color }}>{roas.toFixed(1)}x</div>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <div className="sec">Recomendações de verba</div>
              <div className={`alert ag`}><span>●</span><span>Caps Geral com ROAS {(data.meta_ads[0].receita/data.meta_ads[0].gasto).toFixed(1)}x — aumentar verba em R$500–1k/mês</span></div>
              <div className={`alert aw`}><span>◆</span><span>Retargeting com CPA R${Math.round(data.meta_ads[3].gasto/data.meta_ads[3].pedidos)} — escalar até 20% do budget total</span></div>
              <div className={`alert ar`}><span>▲</span><span>Novos lançamentos com ROAS {(data.meta_ads[4].receita/data.meta_ads[4].gasto).toFixed(1)}x — reduzir verba ou trocar criativo</span></div>
              <div className={`alert ai`}><span>◉</span><span>Board Shorts e Guerrilla Denim com 135 unidades paradas — criar campanha específica pra girar estoque</span></div>
            </div>
          </div>
        )}

        {/* CRM */}
        {activeTab === "crm" && (
          <div>
            <div className="grid3" style={{ marginBottom: 12 }}>
              {[
                { l: "Receita total CRM", v: fmtFull(data.crm.receita_edrone), s: "fev–abr/26 · ROI 1.106%", c: "pos" },
                { l: "SMS (canal principal)", v: fmtFull(data.crm.sms_receita), s: "66.8% da receita CRM", c: "pos" },
                { l: "Taxa de recompra", v: `${data.recompra.taxa}%`, s: "ideal 35–45% para streetwear", c: data.recompra.taxa >= 35 ? "pos" : "warn" },
              ].map((k, i) => <div key={i} className="card"><div className="kl">{k.l}</div><div className={`kv ${k.c}`}>{k.v}</div><div className="ks">{k.s}</div></div>)}
            </div>

            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">Receita por canal</div>
              {[
                { nome: "SMS", receita: data.crm.sms_receita, base: data.crm.base_sms, cor: "#6bb87a" },
                { nome: "Email", receita: data.crm.email_receita, base: data.crm.base_email, cor: "#c8a96e" },
                { nome: "WhatsApp", receita: data.crm.whatsapp_receita, base: data.crm.base_whatsapp, cor: "#6b8ac0" },
              ].map((c, i) => {
                const rpm = Math.round((c.receita / c.base) * 1000);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 80, fontSize: 12, color: "#aaa" }}>{c.nome}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginBottom: 3 }}>
                        <span>{fmtFull(c.receita)}</span>
                        <span>{c.base.toLocaleString("pt-BR")} inscritos · R${rpm}/1k msgs</span>
                      </div>
                      <div className="trk">
                        <div style={{ height: 5, borderRadius: 2, background: c.cor, width: `${(c.receita / data.crm.sms_receita) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card" style={{ marginBottom: 8 }}>
              <div className="sec">Automações — performance</div>
              {[
                { nome: "Boas-vindas", receita: data.crm.boas_vindas, pedidos: 29, nota: "tag-g", status: "ótimo" },
                { nome: "Carrinho abandonado", receita: data.crm.carrinho_abandonado, pedidos: 20, nota: "tag-g", status: "ótimo" },
                { nome: "Produtos recomendados", receita: data.crm.produtos_recomendados, pedidos: 21, nota: "tag-w", status: "bom" },
                { nome: "After purchase", receita: data.crm.after_purchase, pedidos: 11, nota: "tag-w", status: "bom" },
                { nome: "Produtos visualizados", receita: data.crm.produtos_visualizados, pedidos: 16, nota: "tag-w", status: "bom" },
                { nome: "Recuperação clientes", receita: data.crm.recuperacao, pedidos: 4, nota: "tag-r", status: "fraco" },
                { nome: "Programa fidelidade", receita: data.crm.fidelidade, pedidos: 1, nota: "tag-r", status: "fraco" },
              ].map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 190, fontSize: 11, color: "#aaa" }}>{a.nome}</div>
                  <span className={`tag ${a.nota}`}>{a.status}</span>
                  <div style={{ flex: 1 }}>
                    <div className="trk">
                      <div style={{ height: 5, borderRadius: 2, background: a.nota === "tag-g" ? "#6bb87a" : a.nota === "tag-w" ? "#c8a96e" : "#c05a5a", width: `${(a.receita / data.crm.carrinho_abandonado) * 100}%` }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", width: 80, textAlign: "right" }}>{fmtFull(a.receita)}</div>
                  <div style={{ fontSize: 10, color: "#555", width: 60, textAlign: "right" }}>{a.pedidos} pedidos</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="sec">Base de contatos — crescimento</div>
              <div className="grid3">
                {[
                  { l: "Email", v: data.crm.base_email.toLocaleString("pt-BR"), trend: "↑ 9.2k → 10.1k (+10%)", c: "pos" },
                  { l: "SMS", v: data.crm.base_sms.toLocaleString("pt-BR"), trend: "↑ 6.0k → 6.3k (+5%)", c: "pos" },
                  { l: "WhatsApp", v: data.crm.base_whatsapp.toLocaleString("pt-BR"), trend: "540 → 592 (+10%)", c: "pos" },
                ].map((b, i) => (
                  <div key={i} style={{ padding: "12px", background: "#0d0d0d", borderRadius: 2, border: "0.5px solid #151515" }}>
                    <div className="kl">{b.l}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, margin: "4px 0" }}>{b.v}</div>
                    <div style={{ fontSize: 10, color: "#6bb87a" }}>{b.trend}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CHAT */}
        {activeTab === "chat" && (
          <div>
            <div className="card" style={{ marginBottom: 8, height: 440, overflowY: "auto" }}>
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "chat-u" : "chat-a"}>
                  <div style={{ fontSize: 8, color: "#444", marginBottom: 5, letterSpacing: "0.1em" }}>{m.role === "user" ? "VOCÊ" : "EGHO ADVISOR"}</div>
                  <div style={{ color: m.role === "user" ? "#e8e0d0" : "#aaa" }}>{m.content}</div>
                </div>
              ))}
              {loading && <div className="chat-a"><div style={{ fontSize: 8, color: "#444", marginBottom: 5 }}>EGHO ADVISOR</div><div style={{ color: "#444" }}>analisando...</div></div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea className="inp" rows={3} placeholder="cole dados, tire dúvidas, peça análise... ex: 'maio fechou em 85k, custo subiu 5%, o que priorizar?'" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
              <button className="btn btnp" onClick={sendMessage} disabled={loading} style={{ alignSelf: "flex-end", padding: "12px 20px" }}>{loading ? "..." : "→"}</button>
            </div>
            <div style={{ fontSize: 9, color: "#2a2a2a", marginTop: 5 }}>enter envia · shift+enter quebra linha</div>
          </div>
        )}

      </div>
    </div>
  );
}
