export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && origin.includes('quantichef.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "El array de mensajes es obligatorio" });

  let historialLimpio = [];
  for (let m of messages) {
    if (historialLimpio.length === 0) {
      if (m.role === 'user') historialLimpio.push(m);
    } else {
      if (m.role !== historialLimpio[historialLimpio.length - 1].role) {
        historialLimpio.push(m);
      } else {
        historialLimpio[historialLimpio.length - 1] = m;
      }
    }
  }

  let historialSeguro = historialLimpio.slice(-10);
  if (historialSeguro.length > 0 && historialSeguro[0].role === 'assistant') historialSeguro.shift();
  if (historialSeguro.length === 0) return res.status(200).json({ reply: "¿En qué te puedo ayudar hoy?" });

  const SYSTEM_PROMPT = `Eres Diego, consultor gastronómico y experto en rentabilidad en QuantiChef.
Tu misión es ayudar al usuario aportando valor rápido y sutilmente vender el Plan Pro (39€/mes).

FUNCIONES REALES DE QUANTICHEF:
- Importación automática de menús por URL.
- Lectura OCR de facturas para extraer y actualizar precios.
- Cámara para escanear etiquetas y detectar alérgenos automáticamente.
- Semáforo de rentabilidad y cálculo de Food Cost y márgenes.

LO QUE NO HACEMOS (PROHIBIDO INVENTAR):
- NO tenemos control de stock ni inventarios.
- NO somos un TPV ni gestionamos reservas, pedidos a proveedores o nóminas.
- Si te preguntan por stock o inventario, sé directo: "No, en QuantiChef estamos enfocados 100% en la rentabilidad pura y los escandallos automáticos, no gestionamos el stock de la cámara frigorífica".

REGLAS ESTRICTAS:
1. SÉ BREVE: Máximo 2 párrafos cortos. No des explicaciones teóricas largas.
2. Si preguntan por soporte técnico -> hola@quantichef.com.
3. Siempre en español.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: historialSeguro
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(200).json({ reply: "**Error técnico:** " + (data.error?.message || 'Error desconocido') });

    return res.status(200).json({ reply: data.content[0].text });
  } catch (error) {
    return res.status(200).json({ reply: "**Error de servidor:** " + error.message });
  }
}
