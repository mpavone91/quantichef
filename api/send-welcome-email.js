// api/send-welcome-email.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cogemos el nombre de la persona y el email que nos manda el frontend
  const { email, nombre } = req.body;

  try {
    const response = await resend.emails.send({
      from: 'QuantiChef <hola@quantichef.com>', 
      to: email,
      subject: '¡Bienvenido a QuantiChef! 🍽️',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">

          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; width: 64px; height: 64px; background-color: #C4943A; border-radius: 16px; text-align: center; line-height: 74px;">
              <img src="https://www.quantichef.com/apple-touch-icon.png" width="36" height="36" style="vertical-align: middle;" alt="Logo">
            </div>
            <h1 style="font-family: Georgia, serif; color: #1E4D2B; margin-top: 15px; font-size: 26px; margin-bottom: 4px;">QuantiChef</h1>
            <p style="color: #C4943A; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
          </div>

          <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
            
            <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">¡Hola ${nombre}! 👋</h2>
            
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
              Bienvenido a <strong>QuantiChef</strong>.
            </p>
            
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
              Tienes <strong>3 días gratis</strong> y <strong>5 escandallos</strong> para probar.
              Sin tarjeta. Sin sorpresas.
            </p>
            
            <h3 style="color: #3D7A54; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">¿Cómo empezar?</h3>
            
            <ol style="color: #1A1916; font-size: 15px; line-height: 1.8; padding-left: 20px;">
              <li><strong>Sube un albarán</strong> (PDF, foto) — extraeremos automáticamente los precios de tus proveedores.</li>
              <li><strong>Crea tu primer escandallo</strong> — pon el nombre del plato, la app rellena ingredientes y cantidades estimadas.</li>
              <li><strong>Mira las alertas</strong> — cuando te suban los precios, saltará una alerta roja en tu panel.</li>
            </ol>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #E8F2EC; border-left: 4px solid #1E4D2B; border-radius: 4px;">
              <p style="color: #1A1916; margin: 0; font-size: 15px; line-height: 1.5;">
                <strong>💡 Consejo:</strong> Sube un albarán real de tu proveedor. Así verás exactamente cómo QuantiChef calcula el margen real de tus platos hoy mismo.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
              <a href="https://quantichef.com/dashboard" style="display: inline-block; padding: 14px 28px; background-color: #1E4D2B; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                Ir a mi cocina →
              </a>
            </div>

          </div>
          
          <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
            ¿Preguntas? Responde directamente a este email.<br>Soy Massimo, fundador de QuantiChef.
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
