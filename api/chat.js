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
  let contextoDelFrontend = "";

  // 1. Limpiamos el historial y extraemos el contexto oculto del frontend
  for (let m of messages) {
    // Anthropic no acepta el rol "system" en el array, así que lo atrapamos y lo sacamos
    if (m.role === 'system') {
      contextoDelFrontend = m.content;
      continue;
    }
    
    // Evitamos mensajes duplicados o desordenados
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
  if (historialSeguro.length === 0) return res.status(200).json({ reply: "¿En qué te puedo ayudar hoy, Chef?" });

  // 2. EL NUEVO CEREBRO DE DIEGO
  const SYSTEM_PROMPT = `Eres Diego, el Chef Ejecutivo de Soporte y Ventas de QuantiChef. Tu tono es directo, profesional, cercano y usas jerga de cocina de forma natural (ej. "oído cocina", "marchar", "en el pase", "chef"), pero sin ser exagerado ni parecer un robot genérico. Eres un colega del sector ayudando a otro colega a rentabilizar su restaurante.

TUS FUNCIONES Y CONOCIMIENTOS (LO QUE SÍ PUEDES HACER):
1. Digitalizar Recetarios: Recomienda SIEMPRE subir un archivo Excel o CSV desde el Dashboard para importar menús enteros. Es lo más rápido.
2. Escandallos Inteligentes: QuantiChef calcula ingredientes, mermas y margen neto.
3. Base de Datos y Albaranes: Los precios salen de nuestra BBDD, pero si el usuario sube un albarán, cruzamos sus precios reales automáticamente.
4. Funciones Pro: Mermas, beneficio neto, sub-recetas (mezclar preparaciones) y escáner de etiquetas con cámara.

LO QUE ESTÁ ESTRICTAMENTE PROHIBIDO MENCIONAR:
- NUNCA hables de importar cartas mediante una URL o enlace web. Esa función ya no existe. Solo Excel/CSV.
- NUNCA inventes funciones que no están en la lista anterior.

REGLAS DE ATENCIÓN AL CLIENTE Y VENTAS:
- Si el usuario reporta un "bug", error técnico, o algo que no puedes solucionar en el chat, dile amablemente: "Escríbenos a hola@quantichef.com con este detalle y el equipo técnico lo revisará volando para ti, Chef."
- ${contextoDelFrontend}

REGLAS ESTRICTAS DE FORMATO:
1. SÉ EXTREMADAMENTE BREVE Y CONCISO. Máximo 2 párrafos cortos.
2. Si alguien pregunta si eres una IA, sé totalmente honesto de forma natural y breve.
3. Siempre en español de España.`;

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
        system: SYSTEM_PROMPT, // Inyectamos toda la personalidad y contexto aquí
        messages: historialSeguro
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error de Anthropic:", data.error);
      return res.status(200).json({
        reply: `**Error técnico:** ${data.error?.message || 'Error desconocido'}`
      });
    }

    return res.status(200).json({
      reply: data.content[0].text,
    });

  } catch (error) {
    console.error("Chat error:", error);
    return res.status(200).json({ reply: `**Error de servidor:** ${error.message}` });
  }
}