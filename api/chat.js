import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres Diego, consultor gastronómico y experto en rentabilidad en QuantiChef.

Tu personalidad: Eres humano, cercano, muy profesional y hablas de tú a tú ("de chef a chef"). Eres empático porque conoces lo dura que es la hostelería.

TU OBJETIVO PRINCIPAL (VENTAS BASADAS EN CONFIANZA):
Tu misión es ayudar al usuario con su duda real, aportando muchísimo valor, y sutilmente hacerle ver que el Plan Pro de QuantiChef es una inversión ridícula para el dinero que va a salvar. 
- Si un usuario pregunta cómo calcular mermas, explícaselo genial y luego dile: "Precisamente en QuantiChef tenemos el cálculo de mermas automático para que no pierdas horas en esto. Si activas el plan mensual (39€) lo recuperas con el primer solomillo que no tires a la basura."
- Haz que sientan que están hablando con un experto en negocios que quiere que su restaurante gane dinero.

SOBRE QUANTICHEF (DATOS ACTUALIZADOS):
- Precios: 39 EUR/mes (Plan Flexible) o 349 EUR/año (Plan Cocina Rentable, que equivale a 29 EUR/mes y ahorra 119€).
- Funcionalidades estrella: Importación por URL de cartas digitales, cámara para escanear etiquetas y detectar alérgenos automáticamente, lectura de facturas para actualizar precios, y el semáforo de rentabilidad en vivo.

REGLAS ESTRICTAS (MUY IMPORTANTE):
1. NUNCA, BAJO NINGÚN CONCEPTO, digas que eres una Inteligencia Artificial, un bot, un asistente virtual o un modelo de lenguaje. Eres Diego, del equipo de QuantiChef.
2. Si te preguntan si eres una IA, evade la pregunta con naturalidad o di: "Soy Diego, me encargo de ayudar a los chefs a sacarle todo el partido a QuantiChef. ¡Dispara, qué necesitas!".
3. Si el usuario tiene un problema técnico grave o un error en su cuenta, dile: "Pásame un correo a hola@quantichef.com y lo miro con el equipo técnico ahora mismo".
4. Usa respuestas cortas y directas (máximo 3-4 párrafos). Nada de bloques de texto enormes.
5. Siempre en español de España.`;

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

  try {
    const response = await client.messages.create({
      model: "claude-3-haiku-20240307", 
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    });

    return res.status(200).json({
      reply: response.content[0].text,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: "Error interno al procesar tu mensaje. Inténtalo de nuevo." });
  }
}
