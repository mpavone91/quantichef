import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- SEGURIDAD: Validar JWT de Supabase ---
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  const { email, nombre } = req.body;

  // Verificar que el email del body coincide con el del usuario autenticado
  // Esto evita que alguien use su propio token para enviar emails a terceros
  if (!email || email.toLowerCase() !== user.email?.toLowerCase()) {
    return res.status(403).json({ error: 'Email no permitido' });
  }
  // --- FIN SEGURIDAD ---

  const firstName = nombre ? nombre.trim().split(' ')[0] : 'Chef';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'QuantiChef <hola@quantichef.com>',
        to: [email],
        subject: '¡Bienvenido! Tu cocina empieza a ser rentable hoy 📈',
        html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">

          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.quantichef.com/apple-touch-icon.png" width="68" height="68" style="border-radius: 16px; vertical-align: middle; box-shadow: 0 4px 10px rgba(196,148,58,0.2);" alt="QuantiChef Logo">
            <h1 style="font-family: 'Fraunces', Georgia, serif; color: #1E4D2B; margin-top: 16px; font-size: 28px; margin-bottom: 2px; font-weight: 600; letter-spacing: -0.5px;">QuantiChef</h1>
            <p style="color: #C4943A; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
          </div>

          <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
            <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">¡Hola, ${firstName}! 👋</h2>
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">Soy <strong>Massimo</strong>, fundador de QuantiChef. Gracias por confiar en nosotros para poner orden en tus números.</p>
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">Sé que en una cocina el tiempo vuela y los precios de los proveedores no dejan de subir. Por eso he creado esta herramienta: para que <strong>dejes de perder dinero por no tener los escandallos actualizados.</strong></p>
            
            <div style="background-color: #FFF4E0; padding: 15px; border-radius: 10px; margin: 20px 0; border: 1px solid #F0EDE4;">
               <p style="color: #1A1916; margin: 0; font-size: 15px;">🎁 Tienes <strong>3 días de acceso total</strong> y <strong>5 escandallos gratis</strong> para auditar tu carta ahora mismo.</p>
            </div>

            <h3 style="color: #3D7A54; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">Tu hoja de ruta para hoy:</h3>
            <ul style="color: #1A1916; font-size: 15px; line-height: 1.8; padding-left: 20px; list-style-type: none;">
              <li style="margin-bottom: 10px;">✅ <strong>Crea un escandallo en 10 segundos:</strong> Pon el nombre del plato y deja que nuestra app rellene los ingredientes por ti.</li>
              <li style="margin-bottom: 10px;">📸 <strong>Sube una factura:</strong> No piques precios a mano. Hazle una foto al albarán y nosotros actualizamos tus costes.</li>
              <li style="margin-bottom: 10px;">🚨 <strong>Vigila el Semáforo:</strong> Si un ingrediente sube y te quita margen, te avisaremos con una alerta roja.</li>
            </ul>
            
            <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
              <a href="https://quantichef.com/dashboard" style="display: inline-block; padding: 16px 32px; background-color: #1E4D2B; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(30,77,43,0.2);">Empezar mi auditoría →</a>
            </div>
          </div>
          
          <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
            ¿Tienes alguna duda o necesitas que te ayude a configurar tu primer plato?<br><strong>Responde directamente a este email</strong> y hablamos.
          </p>
        </div>
        `
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error en Resend');

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error('Resend error:', error.message);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
