// api/shopify-webhook.js
// Recebe pedidos novos da Shopify em tempo real

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseUpsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });
  return res;
}

async function recalcularMetricaDiaria(data) {
  // Busca todos os pedidos do dia
  const hoje = data.split('T')[0];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pedidos?data=gte.${hoje}T00:00:00&data=lte.${hoje}T23:59:59&status=neq.cancelled`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );
  const pedidos = await res.json();
  
  const faturamento = pedidos.reduce((s, p) => s + (p.valor || 0), 0);
  const qtd = pedidos.length;
  const ticket = qtd > 0 ? faturamento / qtd : 0;

  await supabaseUpsert('metricas_diarias', [{
    data: hoje,
    faturamento: Math.round(faturamento * 100) / 100,
    pedidos: qtd,
    ticket_medio: Math.round(ticket * 100) / 100,
    updated_at: new Date().toISOString()
  }]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const order = req.body;
    
    // Monta o objeto do pedido
    const pedido = {
      id: String(order.id),
      nome: order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : 'Cliente',
      email: order.customer?.email || '',
      valor: parseFloat(order.subtotal_price || 0),
      frete: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0),
      status: order.financial_status || 'pending',
      data: order.created_at,
      produtos: (order.line_items || []).map(i => ({
        nome: i.title,
        sku: i.sku,
        qty: i.quantity,
        valor: parseFloat(i.price)
      })),
      cidade: order.shipping_address?.city || '',
      estado: order.shipping_address?.province_code || ''
    };

    await supabaseUpsert('pedidos', [pedido]);
    await recalcularMetricaDiaria(pedido.data);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
