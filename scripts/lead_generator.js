const axios = require('axios');
const cheerio = require('cheerio');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

// Configuración inicial
const CITY = 'Madrid';
const LIMIT = 10; // Para la primera prueba extraeremos solo 10. Luego puedes subirlo a 100 o 500.

// Configurar el archivo CSV de salida
const outputPath = path.join(__dirname, `../leads_${CITY}.csv`);
const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
        { id: 'name', title: 'NOMBRE' },
        { id: 'phone', title: 'TELEFONO' },
        { id: 'website', title: 'WEB' },
        { id: 'email', title: 'EMAIL' }
    ]
});

// Función para obtener restaurantes usando OpenStreetMap (Gratis)
async function getRestaurants() {
    console.log(`📍 Buscando restaurantes en ${CITY} a través de OpenStreetMap...`);
    // Esta consulta busca solo los restaurantes que tengan una etiqueta de "website"
    const query = `
        [out:json][timeout:25];
        area["name"="Madrid"]->.searchArea;
        (
          node["amenity"="restaurant"]["website"](area.searchArea);
          way["amenity"="restaurant"]["website"](area.searchArea);
        );
        out body ${LIMIT};
    `;
    
    try {
        const response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`, {
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'QuantiChef-LeadGen/1.0 (contacto@quantichef.com)'
            }
        });
        return response.data.elements.map(e => e.tags).filter(t => t);
    } catch (error) {
        console.error("❌ Error al consultar Overpass API:", error.message);
        return [];
    }
}

// Función para entrar a la web y escanear el correo electrónico
async function extractEmailFromWebsite(url) {
    if (!url.startsWith('http')) {
        url = 'http://' + url;
    }
    console.log(`  🌐 Escaneando: ${url}`);
    try {
        // Configuramos un timeout de 10s para no quedarnos colgados en webs lentas
        const response = await axios.get(url, { timeout: 10000 });
        const html = response.data;
        const $ = cheerio.load(html);
        
        // Buscar cualquier texto que parezca un correo electrónico
        const text = $('body').text();
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        let emails = text.match(emailRegex);
        
        if (emails) {
            // Filtrar duplicados y falsos positivos (ej. imágenes .png, o correos de librerías como sentry)
            emails = [...new Set(emails)].filter(e => {
                const lower = e.toLowerCase();
                return !lower.endsWith('.png') 
                    && !lower.endsWith('.jpg') 
                    && !lower.endsWith('.gif') 
                    && !lower.includes('sentry')
                    && !lower.includes('example');
            });
            return emails.join(', ');
        }
    } catch (error) {
        console.log(`  [x] No se pudo escanear ${url}: ${error.message}`);
    }
    return '';
}

async function main() {
    const records = [];
    const restaurants = await getRestaurants();
    console.log(`✅ Se encontraron ${restaurants.length} restaurantes con web.`);
    
    for (const rest of restaurants) {
        const name = rest.name || 'Desconocido';
        const phone = rest.phone || rest['contact:phone'] || 'No disponible';
        const website = rest.website || rest['contact:website'];
        
        let email = '';
        if (website) {
            email = await extractEmailFromWebsite(website);
        }
        
        records.push({ name, phone, website, email: email || 'No encontrado' });
    }
    
    await csvWriter.writeRecords(records);
    console.log(`\n🎉 ¡Búsqueda completada!`);
    console.log(`📂 Se ha generado tu base de datos de leads en: ${outputPath}`);
}

main();
