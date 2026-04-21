export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, nombre } = req.body;

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
        subject: '¡Bienvenido a QuantiChef! 🍽️',
        html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">

          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.quantichef.com/apple-touch-icon.png" width="68" height="68" style="border-radius: 16px; vertical-align: middle; box-shadow: 0 4px 10px rgba(196,148,58,0.2);" alt="QuantiChef Logo">
            <h1 style="font-family: 'Fraunces', Georgia, serif; color: #1E4D2B; margin-top: 16px; font-size: 28px; margin-bottom: 2px; font-weight: 600; letter-spacing: -0.5px;">QuantiChef</h1>
            <p style="color: #C4943A; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
          </div>

          <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
            <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">¡Hola ${nombre}! 👋</h2>
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">Bienvenido a <strong>QuantiChef</strong>.</p>
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">Tienes <strong>3 días gratis</strong> y <strong>5 escandallos</strong> para probar. Sin tarjeta. Sin sorpresas.</p>
            
            <h3 style="color: #3D7A54; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">¿Cómo empezar?</h3>
            <ol style="color: #1A1916; font-size: 15px; line-height: 1.8; padding-left: 20px;">
              <li><strong>Crea tu primer escandallo</strong> — pon el nombre del plato, la IA rellena ingredientes y cantidades.</li>
              <li><strong>Sube un albarán</strong> (PDF, foto) — extraeremos automáticamente los precios de tus proveedores.</li>
              <li><strong>Mira las alertas</strong> — cuando te suban los precios, saltará una alerta roja en tu panel.</li>
            </ol>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #E8F2EC; border-left: 4px solid #1E4D2B; border-radius: 4px;">
              <p style="color: #1A1916; margin: 0; font-size: 15px; line-height: 1.5;">
                <strong>💡 Consejo:</strong> Sube un albarán real de tu proveedor. Así verás exactamente cómo QuantiChef calcula el margen real de tus platos hoy mismo.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
              <a href="https://quantichef.com/dashboard" style="display: inline-block; padding: 14px 28px; background-color: #1E4D2B; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">Ir a mi cocina →</a>
            </div>
          </div>
          
          <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
            ¿Preguntas? Responde directamente a este email.<br>Soy Massimo, fundador de QuantiChef.
          </p>
        </div>
        `
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error en Resend');
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error('Resend error:', error.message);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
