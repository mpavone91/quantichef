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
const SENT_LOG_FILE = 'sent_emails.txt';
const BATCH_LIMIT = 8; // Enviará 8 correos cada vez que se ejecute (Aprox 48 al día si corre cada 4 horas)

// Pausa aleatoria para simular comportamiento humano y evitar filtros de spam
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => {
    const ms = Math.floor(Math.random() * (10000 - 3000 + 1)) + 3000; // Entre 3 y 10 segundos
    console.log(`  ⏳ Esperando ${(ms / 1000).toFixed(1)}s antes del siguiente envío...`);
    return delay(ms);
};

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

    // Cargar historial de enviados
    let sentHistory = [];
    if (fs.existsSync(SENT_LOG_FILE)) {
        sentHistory = fs.readFileSync(SENT_LOG_FILE, 'utf8').split('\n').map(e => e.trim());
    }

    fs.createReadStream(INPUT_FILE)
        .pipe(csv())
        .on('data', (row) => {
            if (row.EMAIL && row.EMAIL !== 'No encontrado') {
                const firstEmail = row.EMAIL.split(',')[0].trim();
                
                // Solo añadir a la cola si NO se le ha enviado antes
                if (!sentHistory.includes(firstEmail)) {
                    leads.push({
                        name: row.NOMBRE,
                        email: firstEmail,
                        website: row.WEB
                    });
                }
            }
        })
        .on('end', async () => {
            console.log(`✅ Quedan ${leads.length} restaurantes nuevos por contactar en la lista.`);
            
            if (leads.length === 0) {
                console.log(`Todos los restaurantes actuales ya han sido contactados. Ejecuta el lead_generator para buscar más.`);
                return;
            }

            // Limitamos para no ser marcados como SPAM
            const batch = leads.slice(0, BATCH_LIMIT);
            console.log(`📧 Preparando el envío de ${batch.length} correos para este lote...`);

            let sentCount = 0;

            for (const lead of batch) {
                try {
                    console.log(`  -> Enviando email a: ${lead.name} (${lead.email})`);
                    
                    // Envío real
                    const data = await resend.emails.send({
                        from: 'Massimo de QuantiChef <hola@quantichef.com>',
                        to: lead.email,
                        subject: `Control de costes para ${lead.name}`,
                        html: generateEmailTemplate(lead.name)
                    });
                    
                    // Registrar como enviado para no repetir
                    fs.appendFileSync(SENT_LOG_FILE, lead.email + '\n');
                    
                    sentCount++;

                    // Esperar un tiempo aleatorio antes del siguiente para no activar filtros de spam
                    if (sentCount < batch.length) {
                        await randomDelay();
                    }
                } catch (error) {
                    console.error(`  [x] Error al enviar a ${lead.email}:`, error.message);
                }
            }
            
            console.log(`\n🎉 ¡Lote finalizado! Se enviaron ${sentCount} correos exitosamente.`);
        });
}

main();
