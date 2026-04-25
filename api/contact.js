export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nombre, email, telefono, mensaje } = req.body;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'QuantiChef Web <onboarding@resend.dev>',
        to: ['hola@quantichef.com'],
        subject: `📩 Nuevo contacto: ${nombre}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1A1916;">
            <h2 style="color: #1E4D2B;">Mensaje desde la web</h2>
            <p><strong>Nombre:</strong> ${nombre}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Teléfono:</strong> ${telefono || 'No indicado'}</p>
            <hr style="border: 0; border-top: 1px solid #E0DDD6; margin: 20px 0;">
            <p><strong>Mensaje:</strong></p>
            <p style="background: #F9F7F2; padding: 15px; border-radius: 8px; line-height: 1.6;">${mensaje}</p>
          </div>
        `
      })
    });

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      const errData = await response.json();
      console.error(errData);
      return res.status(500).json({ error: 'Fallo al enviar el email' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
