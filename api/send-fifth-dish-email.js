import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, nombre } = req.body;

  // Lógica para usar solo el primer nombre
  const firstName = nombre ? nombre.trim().split(' ')[0] : 'Chef';

  try {
    const response = await resend.emails.send({
      from: 'QuantiChef <hola@quantichef.com>',
      to: email,
      subject: 'Tus 5 escandallos están listos: ¿Qué has descubierto? 🔍',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">

          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.quantichef.com/apple-touch-icon.png" width="68" height="68" style="border-radius: 16px; vertical-align: middle; box-shadow: 0 4px 10px rgba(196,148,58,0.2);" alt="QuantiChef Logo">
            <h1 style="font-family: 'Fraunces', Georgia, serif; color: #1E4D2B; margin-top: 16px; font-size: 28px; margin-bottom: 2px; font-weight: 600; letter-spacing: -0.5px;">QuantiChef</h1>
            <p style="color: #C4943A; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
          </div>

          <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
            
            <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">¡Has completado tus 5 pruebas! 🎯</h2>
            
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
              Hola, ${firstName}:
            </p>
            
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
              Espero que ver la rentabilidad real de tus primeros 5 platos te haya dado una nueva perspectiva. A veces, los platos que creemos que son nuestras "estrellas" son los que más dinero nos quitan silenciosamente.
            </p>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #E8F2EC; border-left: 4px solid #1E4D2B; border-radius: 4px;">
              <p style="color: #1A1916; margin: 0; font-size: 15px; line-height: 1.5;">
                <strong>¿Sabías que un error de 50 céntimos en un escandallo puede costarte miles de euros al final del año?</strong> No dejes el resto de tu carta al azar.
              </p>
            </div>
            
            <h3 style="color: #3D7A54; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">¿Cuál es tu siguiente movimiento?</h3>
            
            <p style="color: #1A1916; font-size: 15px; line-height: 1.8;">
              🚀 <strong>Pasa al Plan PRO:</strong> Escandallos ilimitados, alertas automáticas de subida de precios y escaneo de facturas por IA. <strong>Tienes la primera semana gratis</strong> para auditar toda tu carta sin compromiso.
            </p>
            
            <p style="color: #1A1916; font-size: 15px; line-height: 1.8;">
              💬 <strong>Cuéntame qué te falta:</strong> Si hay algo que te impide dar el paso o tienes alguna idea para mejorar la herramienta, dímelo.
            </p>
            
            <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
              <a href="https://quantichef.com/precios" style="display: inline-block; padding: 16px 32px; background-color: #1E4D2B; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(30,77,43,0.2);">
                Pasar a PRO y auditar toda mi carta →
              </a>
            </div>

          </div>
          
          <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
            Responde directamente a este email si necesitas que te ayude con la configuración de tu cuenta.<br><strong>Massimo, fundador de QuantiChef.</strong>
          </p>
          
        </div>
      `
    });

    return res.status(200).json({ success: true, id: response.data.id });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}