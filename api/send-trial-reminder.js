import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 2);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    const { data: restaurantes, error } = await supabase
      .from('restaurantes')
      .select('id, nombre, user_id')
      .eq('plan', 'trial')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    if (error) throw error;
    if (!restaurantes || restaurantes.length === 0) return res.status(200).json({ sent: 0 });

    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();

    for (const rest of restaurantes) {
      const authUser = authUsers.find(u => u.id === rest.user_id);
      if (!authUser?.email) continue;

      // EXTRAER EL NOMBRE REAL (Priorizamos el nombre del usuario sobre el del restaurante)
      // Si tienes el nombre en user_metadata úsalo, si no, intentamos limpiar el del restaurante
      const rawName = authUser.user_metadata?.full_name || rest.nombre;
      const firstName = rawName ? rawName.trim().split(' ')[0] : 'Chef';

      const { count } = await supabase
        .from('escandallos')
        .select('*', { count: 'exact', head: true })
        .eq('restaurante_id', rest.id);
        
      const trialsLeft = Math.max(0, 5 - (count || 0));

      await resend.emails.send({
        from: 'QuantiChef <hola@quantichef.com>',
        to: authUser.email,
        subject: 'Últimas 24 horas: No pierdas el control de tus márgenes ⏳',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">
            
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://www.quantichef.com/apple-touch-icon.png" width="68" height="68" style="border-radius: 16px; vertical-align: middle; box-shadow: 0 4px 10px rgba(196,148,58,0.2);" alt="Logo">
              <h1 style="font-family: 'Fraunces', Georgia, serif; color: #1E4D2B; margin-top: 16px; font-size: 28px; margin-bottom: 2px; font-weight: 600; letter-spacing: -0.5px;">QuantiChef</h1>
              <p style="color: #C4943A; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
            </div>

            <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
              <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">El tiempo vuela en la cocina...</h2>
              <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">Hola, ${firstName}:</p>
              <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">Mañana termina tu acceso gratuito a QuantiChef. Me gustaría preguntarte: <strong>¿ya sabes cuánto dinero estás ganando realmente con tus platos estrella?</strong></p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #FFF4E0; border-radius: 10px; border: 1px solid #F0EDE4;">
                <p style="color: #1A1916; margin: 0; font-size: 15px; text-align: center;">
                  ⏳ <strong>Aún te quedan ${trialsLeft} escandallos</strong> para auditar tu carta antes de que expire la prueba.
                </p>
              </div>

              <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">No permitas que las subidas de los proveedores se coman tu margen sin que te des cuenta. Activa un plan PRO y deja que QuantiChef vigile tu rentabilidad 24/7.</p>
              
              <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
                <a href="https://quantichef.com/precios" style="display: inline-block; padding: 16px 32px; background-color: #1E4D2B; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(30,77,43,0.2);">Ver planes y activar QuantiChef →</a>
              </div>
            </div>

            <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
              Soy Massimo. Si necesitas un poco más de tiempo para probar la herramienta o quieres que te ayude con algo específico, <strong>responde a este email.</strong>
            </p>
          </div>`
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error reminder:', error.message);
    return res.status(500).json({ error: error.message });
  }
}