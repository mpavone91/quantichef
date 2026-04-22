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

      const { count } = await supabase
        .from('escandallos')
        .select('*', { count: 'exact', head: true })
        .eq('restaurante_id', rest.id);
        
      const trialsLeft = Math.max(0, 5 - (count || 0));

      await resend.emails.send({
        from: 'QuantiChef <hola@quantichef.com>',
        to: authUser.email,
        subject: 'Tu prueba gratuita termina mañana ⏳',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://www.quantichef.com/apple-touch-icon.png" width="68" height="68" style="border-radius: 16px; vertical-align: middle; box-shadow: 0 4px 10px rgba(196,148,58,0.2);" alt="Logo">
              <h1 style="font-family: Georgia, serif; color: #1E4D2B; margin-top: 16px; font-size: 28px; margin-bottom: 2px; font-weight: 600;">QuantiChef</h1>
              <p style="color: #C4943A; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
            </div>

            <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
              <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">El tiempo vuela en la cocina...</h2>
              <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">Hola <strong>${rest.nombre}</strong>,</p>
              <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">Tu acceso gratuito termina mañana. ¿Has podido ver ya el margen real de tus platos estrella?</p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #E8F2EC; border-left: 4px solid #1E4D2B; border-radius: 4px;">
                <p style="color: #1A1916; margin: 0; font-size: 15px;"><strong>📊 Te quedan ${trialsLeft} escandallos</strong> para aprovechar hoy.</p>
              </div>

              <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">No dejes que los precios de los proveedores decidan tu rentabilidad por ti.</p>
              
              <div style="text-align: center; margin-top: 35px;">
                <a href="https://quantichef.com/precios" style="display: inline-block; padding: 14px 28px; background-color: #1E4D2B; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver planes PRO →</a>
              </div>
            </div>
            <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px;">Soy Massimo. Si tienes dudas, responde a este email.</p>
          </div>`
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
