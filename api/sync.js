// api/sync.js
// Sync manual: puxa dados da Shopify e Notion, salva no Supabase

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // egho-studios.myshopify.com
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = '306bcdf8-6a84-81dd-8140-000b176c2c30';

async function supabaseUpsert(table, data) {
  if (!data.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });
}

async function syncShopifyPedidos() {
  // Pega pedidos dos últimos 90 dias
  const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&created_at_min=${desde}&limit=250`;
  
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const { orders } = await res.json();

  const pedidos = (orders || []).map(o => ({
    id: String(o.id),
    nome: o.customer ? `${o.customer.first_name} ${o.customer.last_name}`.trim() : 'Cliente',
    email: o.customer?.email || '',
    valor: parseFloat(o.subtotal_price || 0),
    frete: parseFloat(o.total_shipping_price_set?.shop_money?.amount || 0),
    status: o.financial_status || 'pending',
    data: o.created_at,
    produtos: (o.line_items || []).map(i => ({ nome: i.title, sku: i.sku, qty: i.quantity, valor: parseFloat(i.price) })),
    cidade: o.shipping_address?.city || '',
    estado: o.shipping_address?.province_code || ''
  }));

  // Divide em chunks de 50 pra não estourar
  for (let i = 0; i < pedidos.length; i += 50) {
    await supabaseUpsert('pedidos', pedidos.slice(i, i + 50));
  }

  // Recalcula métricas por dia
  const porDia = {};
  pedidos.filter(p => p.status !== 'refunded' && p.status !== 'cancelled').forEach(p => {
    const dia = p.data?.split('T')[0];
    if (!dia) return;
    if (!porDia[dia]) porDia[dia] = { data: dia, faturamento: 0, pedidos: 0 };
    porDia[dia].faturamento += p.valor;
    porDia[dia].pedidos += 1;
  });

  const metricas = Object.values(porDia).map(d => ({
    ...d,
    faturamento: Math.round(d.faturamento * 100) / 100,
    ticket_medio: d.pedidos > 0 ? Math.round((d.faturamento / d.pedidos) * 100) / 100 : 0,
    updated_at: new Date().toISOString()
  }));

  for (let i = 0; i < metricas.length; i += 50) {
    await supabaseUpsert('metricas_diarias', metricas.slice(i, i + 50));
  }

  return pedidos.length;
}

async function syncShopifyEstoque() {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/variants.json?limit=250`;
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const { variants } = await res.json();

  const estoque = (variants || [])
    .filter(v => v.sku)
    .map(v => ({
      sku: v.sku,
      nome: v.title,
      quantidade: v.inventory_quantity || 0,
      preco: parseFloat(v.price || 0),
      updated_at: new Date().toISOString()
    }));

  for (let i = 0; i < estoque.length; i += 50) {
    await supabaseUpsert('estoque', estoque.slice(i, i + 50));
  }
  return estoque.length;
}

async function syncNotion() {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ page_size: 100 })
  });
  const data = await res.json();

  const produtos = (data.results || []).map(p => {
    const props = p.properties;
    return {
      id: p.id,
      nome: props['Nome']?.title?.[0]?.plain_text || '',
      colecao: props['Coleção']?.select?.name || '',
      status: props['Status']?.status?.name || '',
      preco_custo: props['Preço de Custo']?.number || 0,
      preco_venda: props['Preço de Venda']?.number || 0,
      previsao: p.last_edited_time?.split('T')[0] || '',
      situacao: props['Situação']?.select?.name || '',
      updated_at: new Date().toISOString()
    };
  }).filter(p => p.nome);

  for (let i = 0; i < produtos.length; i += 50) {
    await supabaseUpsert('pipeline', produtos.slice(i, i + 50));
  }
  return produtos.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resultados = {};
  const erros = {};

  try { resultados.pedidos = await syncShopifyPedidos(); } catch (e) { erros.pedidos = e.message; }
  try { resultados.estoque = await syncShopifyEstoque(); } catch (e) { erros.estoque = e.message; }
  try { resultados.notion = await syncNotion(); } catch (e) { erros.notion = e.message; }

  return res.status(200).json({ ok: true, resultados, erros, timestamp: new Date().toISOString() });
}
