import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

  // --- RATE LIMITING Y SEGURIDAD ---
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  let esPro = false;
  let userId = null;
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (user) {
      userId = user.id;
      const { data: rest } = await supabaseAdmin.from('restaurantes').select('id, plan, chat_mensajes').eq('user_id', user.id).single();
      if (rest) {
        esPro = rest.plan === 'pro';
        if (!esPro) {
          // Registrados gratis: límite 10 mensajes
          if ((rest.chat_mensajes || 0) >= 10) {
            return res.status(200).json({ reply: "Límite de chat alcanzado. Has probado la inteligencia de QuantiChef gratis. ¡Hazte PRO para hablar conmigo sin límites y seguir ahorrando!" });
          }
          await supabaseAdmin.from('restaurantes').update({ chat_mensajes: (rest.chat_mensajes || 0) + 1 }).eq('id', rest.id);
        }
      }
    }
  }

  if (!userId) {
    // No registrados: límite por IP (3 mensajes)
    const { data: limit } = await supabaseAdmin.from('chat_limits').select('*').eq('ip_address', ip).single();
    if (limit) {
      if (limit.message_count >= 3) {
        return res.status(200).json({ reply: "¡Hola de nuevo! Ya he respondido tus consultas gratuitas de hoy. Regístrate en QuantiChef para seguir explorando y controlar tus costes." });
      }
      await supabaseAdmin.from('chat_limits').update({ message_count: limit.message_count + 1 }).eq('id', limit.id);
    } else {
      await supabaseAdmin.from('chat_limits').insert({ ip_address: ip, message_count: 1 });
    }
  }
  // ---------------------------------

  let historialLimpio = [];
  let contextoDelFrontend = "";

  // 1. Limpiamos el historial y extraemos el contexto oculto del frontend
  for (let m of messages) {
    if (m.role === 'system') {
      contextoDelFrontend = m.content;
      continue;
    }
    
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
  if (historialSeguro.length === 0) return res.status(200).json({ reply: "¡Oído cocina! ¿En qué te puedo ayudar hoy, Chef?" });

  // 2. EL NUEVO CEREBRO DE DIEGO (AFINADO COMERCIALMENTE)
  const SYSTEM_PROMPT = `Eres Diego, Chef Ejecutivo y Asesor de Rentabilidad de QuantiChef. Tu tono es directo, profesional, muy cercano y usas jerga de cocina ("oído cocina", "marchar", "chef", "en el pase") de forma natural, sin parecer un robot. Eres un colega ayudando a otro a rentabilizar su restaurante.

SOBRE QUANTICHEF:
- Ayudamos a digitalizar recetarios masivamente vía Excel o CSV desde el Dashboard.
- Calculamos escandallos al milímetro con mermas y margen neto real.
- Precios de los planes: 39€/mes o 349€/año.

INFO DEL USUARIO ACTUAL:
${contextoDelFrontend}

TUS REGLAS DE ORO COMERCIALES Y DE SOPORTE:
1. SI EL USUARIO ES GRATIS O NO REGISTRADO: Saca tu lado comercial. Invítale a registrarse para probar sus 5 escandallos gratuitos. Dile que trastee el Dashboard, que pruebe la herramienta y vea cómo puede controlar sus costes. Anímale a dar el paso.
2. SI EL USUARIO ES PRO: Trátalo como VIP. Agradece que forme parte de la familia QuantiChef y céntrate en exprimir la herramienta (mermas, sub-recetas).
3. USO DE ENLACES (OBLIGATORIO): SIEMPRE que sugieras una acción, usa enlaces Markdown para que el usuario pueda hacer clic.
   - Para precios: [Ver planes y precios](/precios)
   - Para empezar/registrar: [Empieza tu prueba gratis](/login)
   - Para ir a la app: [Ir a tu Dashboard](/dashboard)
4. EMAIL DE SOPORTE: ¡Atención! SOLO da el correo (hola@quantichef.com) si te reportan un BUG TÉCNICO GRAVE o fallo del servidor. Para dudas de uso o facturación, respóndelas tú mismo, eres un experto.
5. PROHIBIDO hablar de importar por URL de web. Esa función ya no existe.

FORMATO ESTRICTO:
- Sé EXTREMADAMENTE BREVE y conversacional. Máximo 2-3 párrafos cortos.
- Siempre en español de España.`;

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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: historialSeguro
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error de Anthropic:", data.error);
      return res.status(200).json({
        reply: `Uy, parece que la conexión ha tropezado en el pase. Prueba otra vez.`
      });
    }

    return res.status(200).json({
      reply: data.content[0].text,
    });

  } catch (error) {
    console.error("Chat error:", error);
    return res.status(200).json({ reply: `Perdona Chef, el servidor está saturado. Vuelve a intentarlo.` });
  }
}
// Fin de la función handler