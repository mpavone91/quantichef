require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { Resend } = require('resend');

// Asegurarse de que exista el API Key en el archivo .env
if (!process.env.RESEND_API_KEY) {
    console.error('❌ ERROR: Falta RESEND_API_KEY en el archivo .env');
    console.log('Por favor, crea un archivo .env en la raíz del proyecto y añade: RESEND_API_KEY=tu_clave_aqui');
    process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Configuración
const CITY = 'Madrid';
const INPUT_FILE = `leads_${CITY}.csv`;
const DAILY_LIMIT = 50; // Para evitar caer en spam

// Plantilla de Email en Frío
function generateEmailTemplate(restaurantName) {
    // Si no hay nombre o es "Desconocido", usamos "equipo"
    const name = (restaurantName && restaurantName !== 'Desconocido') ? restaurantName : 'equipo';
    
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1A1916; line-height: 1.6;">
        <p>Hola, ¿cómo lleváis el control de costes con los precios subiendo cada semana?</p>
        
        <p>He lanzado <a href="https://quantichef.com" style="color: #1E4D2B; font-weight: bold; text-decoration: underline;">QuantiChef</a>: una app que lee tus facturas y actualiza tus escandallos al momento para que no pierdas ni un euro de margen.</p>
        
        <p>¿Cuándo te viene bien que te enseñe una demo rápida por videollamada? <a href="https://quantichef.com/contacto" style="color: #1E4D2B; font-weight: bold; text-decoration: underline;">5 minutos y lo tienes.</a></p>
        
        <p>Un saludo,<br>
        <strong>Massimo</strong><br>
        <span style="color: #8A8784; font-size: 12px;">Fundador de QuantiChef</span></p>
    </div>
    `;
}

async function main() {
    console.log(`🚀 Iniciando el sistema de Outbound Marketing para ${CITY}...`);
    
    const leads = [];
    
    // 1. Leer el archivo CSV
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ ERROR: No se encuentra el archivo ${INPUT_FILE}. Ejecuta primero el lead_generator.js`);
        return;
    }

    fs.createReadStream(INPUT_FILE)
        .pipe(csv())
        .on('data', (row) => {
            // Filtrar los que no tienen correo
            if (row.EMAIL && row.EMAIL !== 'No encontrado') {
                // Algunos pueden tener varios correos separados por coma, cogemos el primero
                const firstEmail = row.EMAIL.split(',')[0].trim();
                leads.push({
                    name: row.NOMBRE,
                    email: firstEmail,
                    website: row.WEB
                });
            }
        })
        .on('end', async () => {
            console.log(`✅ Se encontraron ${leads.length} restaurantes con correo válido.`);
            
            // Limitamos para no ser marcados como SPAM
            const batch = leads.slice(0, DAILY_LIMIT);
            console.log(`📧 Preparando el envío de ${batch.length} correos (Límite diario de seguridad)...`);

            let sentCount = 0;

            for (const lead of batch) {
                try {
                    console.log(`  -> Enviando email a: ${lead.name} (${lead.email})`);
                    
                    // Envío real
                    const data = await resend.emails.send({
                        from: 'Massimo de QuantiChef <hola@quantichef.com>', // Asegúrate de que este dominio esté verificado en Resend
                        to: lead.email,
                        subject: `Control de costes para ${lead.name}`,
                        html: generateEmailTemplate(lead.name)
                    });
                    
                    sentCount++;
                } catch (error) {
                    console.error(`  [x] Error al enviar a ${lead.email}:`, error.message);
                }
            }
            
            console.log(`\n🎉 ¡Campaña finalizada! Se enviaron ${sentCount} correos exitosamente.`);
        });
}

main();
