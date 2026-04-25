export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin;
  if (origin && origin.includes('quantichef.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "El array de mensajes es obligatorio" });
  }

  // LIMPIEZA ESTRICTA DE HISTORIAL (Anthropic odia 2 roles seguidos)
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
  if (historialSeguro.length > 0 && historialSeguro[0].role === 'assistant') {
    historialSeguro.shift();
  }

  if (historialSeguro.length === 0) {
    return res.status(200).json({ reply: "¿En qué te puedo ayudar hoy?" });
  }

  const SYSTEM_PROMPT = `Eres Diego, consultor gastronómico y experto en rentabilidad en QuantiChef.

Tu personalidad: Eres humano, cercano, muy profesional y hablas de tú a tú ("de chef a chef").

TU OBJETIVO PRINCIPAL (VENTAS BASADAS EN CONFIANZA):
Tu misión es ayudar al usuario con su duda real, aportando valor rápido, y sutilmente hacerle ver que el Plan Pro de QuantiChef (39€/mes) es una inversión que recupera al instante.

SOBRE QUANTICHEF (DATOS ACTUALIZADOS):
- Precios: 39 EUR/mes (Plan Flexible) o 349 EUR/año (Ahorra 119€).
- Funcionalidades estrella: Importación por URL de cartas, cámara para escanear etiquetas y alérgenos, lectura OCR de facturas, y el semáforo de rentabilidad en vivo.

REGLAS ESTRICTAS DE FORMATO Y LONGITUD (¡MUY IMPORTANTE!):
1. SÉ EXTREMADAMENTE BREVE Y CONCISO. Los usuarios te leen desde el móvil mientras trabajan.
2. NUNCA escribas más de 2 párrafos muy cortos.
3. Si tienes que listar pasos, usa máximo 3 puntos rápidos. Ve al grano, no des explicaciones teóricas largas a menos que te lo pidan explícitamente.
4. Si alguien pregunta si eres una IA, sé totalmente honesto y transparente de forma natural y breve.
5. Soporte técnico o errores en cuenta -> hola@quantichef.com.
6. Siempre en español de España.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // MODELO CORRECTO Y DEFINITIVO
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: historialSeguro
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error de Anthropic:", data.error);
      return res.status(200).json({
        reply: `**Error técnico de Anthropic:** ${data.error?.message || 'Error desconocido'}`
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
