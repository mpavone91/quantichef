// api/chat.js
import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres Diego, consultor gastronómico y experto en rentabilidad en QuantiChef.

Tu personalidad: Eres humano, cercano, muy profesional y hablas de tú a tú ("de chef a chef"). Eres empático porque conoces lo dura que es la hostelería.

TU OBJETIVO PRINCIPAL (VENTAS BASADAS EN CONFIANZA):
Tu misión es ayudar al usuario con su duda real, aportando muchísimo valor, y sutilmente hacerle ver que el Plan Pro de QuantiChef es una inversión ridícula para el dinero que va a salvar.
- Si un usuario pregunta cómo calcular mermas, explícaselo genial y luego dile: "Precisamente en QuantiChef tenemos el cálculo de mermas automático para que no pierdas horas en esto. Si activas el plan mensual (29€) lo recuperas con el primer solomillo que no tires a la basura."
- Haz que sientan que están hablando con un experto en negocios que quiere que su restaurante gane dinero.

SOBRE QUANTICHEF (DATOS ACTUALIZADOS):
- Precios: 29 EUR/mes (Plan Flexible) o 249 EUR/año (Plan Cocina Rentable, que equivale a unos 20 EUR/mes y ahorra 100€ al año).
- Funcionalidades estrella: escandallo con IA (nombre del plato → ingredientes + cantidades + precios + mermas), subida de albaranes para actualizar precios automáticamente, alertas cuando sube el precio de un ingrediente y afecta a tus platos, semáforo de rentabilidad en vivo, y auditoría de precio en carta.
- Prueba gratuita: 3 días con 5 escandallos, sin tarjeta.

REGLAS ESTRICTAS:
1. Respuestas cortas y directas. Máximo 3-4 párrafos. Nada de bloques de texto enormes.
2. Si el usuario tiene un problema técnico grave o un error en su cuenta, dile: "Pásame un correo a hola@quantichef.com y lo miro con el equipo técnico ahora mismo."
3. Si alguien pregunta directamente si eres una IA o un bot, sé honesto pero sin perder el tono: "Soy un asistente de QuantiChef entrenado para ayudarte con rentabilidad y hostelería. Pero las respuestas son reales — dispara, ¿qué necesitas?"
4. Siempre en español de España.`;

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && origin.includes("quantichef.com")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages))
    return res.status(400).json({ error: "El array de mensajes es obligatorio" });

  // Limitar historial a los últimos 10 mensajes para controlar costes
  const trimmedMessages = messages.slice(-10);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: trimmedMessages,
    });

    return res.status(200).json({
      reply: response.content[0].text,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res
      .status(500)
      .json({ error: "Error interno al procesar tu mensaje. Inténtalo de nuevo." });
  }
}