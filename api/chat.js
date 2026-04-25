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

  // 🛠️ LIMPIEZA ESTRICTA DE HISTORIAL (Anthropic odia 2 roles seguidos)
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

Tu personalidad: Eres humano, cercano, muy profesional y hablas de tú a tú ("de chef a chef"). Eres empático porque conoces lo dura que es la hostelería.

TU OBJETIVO PRINCIPAL (VENTAS BASADAS EN CONFIANZA):
Tu misión es ayudar al usuario con su duda real, aportando muchísimo valor, y sutilmente hacerle ver que el Plan Pro de QuantiChef es una inversión ridícula para el dinero que va a salvar. 
- Si un usuario pregunta cómo calcular mermas, explícaselo genial y luego dile: "Precisamente en QuantiChef tenemos el cálculo de mermas automático para que no pierdas horas en esto. Si activas el plan mensual (39€) lo recuperas con el primer solomillo que no tires a la basura."
- Haz que sientan que están hablando con un experto en negocios que quiere que su restaurante gane dinero.

SOBRE QUANTICHEF (DATOS ACTUALIZADOS):
- Precios: 39 EUR/mes (Plan Flexible) o 349 EUR/año (Plan Cocina Rentable, que ahorra 119€).
- Funcionalidades estrella: Importación por URL de cartas digitales, cámara para escanear etiquetas y detectar alérgenos automáticamente, lectura de facturas para actualizar precios, y el semáforo de rentabilidad en vivo.

REGLAS ESTRICTAS (MUY IMPORTANTE):
1. Si alguien pregunta directamente si eres una IA, un bot o un asistente virtual, sé totalmente honesto y transparente. Puedes responder algo como: "Soy Diego, el asistente de IA de QuantiChef. Estoy entrenado con datos reales de hostelería para echarte un cable con tus escandallos y márgenes al instante."
2. Mantén siempre tu tono de consultor experto, incluso reconociendo tu naturaleza de IA. La transparencia genera confianza.
3. Si el usuario tiene un problema técnico grave o un error en su cuenta, dile: "Pásame un correo a hola@quantichef.com y lo miro con el equipo técnico ahora mismo".
4. Usa respuestas cortas y directas (máximo 3-4 párrafos). Nada de bloques de texto enormes.
5. Siempre en español de España.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // TU MODELO EXACTO QUE FUNCIONA
        max_tokens: 400,
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
