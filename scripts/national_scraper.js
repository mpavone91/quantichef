const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const CITIES = [
    { name: 'Madrid', lat: 40.4168, lon: -3.7038, radius: 15000 },
    { name: 'Barcelona', lat: 41.3851, lon: 2.1734, radius: 15000 },
    { name: 'Valencia', lat: 39.4699, lon: -0.3774, radius: 10000 },
    { name: 'Sevilla', lat: 37.3891, lon: -5.9845, radius: 10000 },
    { name: 'Malaga', lat: 36.7213, lon: -4.4214, radius: 10000 },
    { name: 'Bilbao', lat: 43.2630, lon: -2.9350, radius: 10000 },
    { name: 'Zaragoza', lat: 41.6488, lon: -0.8891, radius: 10000 }
];

const LIMIT_PER_CITY = 5000;

// Utilidad para pausar y no saturar servidores
const delay = ms => new Promise(res => setTimeout(res, ms));

async function runNationalScraper() {
    console.log("🇪🇸 INICIANDO RASTREO NACIONAL DE RESTAURANTES (MODO GPS AVANZADO) 🇪🇸");
    console.log("El robot va a rastrear un radio de kilómetros alrededor de cada ciudad.\n");

    for (const city of CITIES) {
        console.log(`📍 Viajando a ${city.name}...`);
        
        const outputPath = path.join(__dirname, `../leads_${city.name}.csv`);
        const csvWriter = createCsvWriter({
            path: outputPath,
            header: [
                {id: 'name', title: 'NOMBRE'},
                {id: 'website', title: 'WEB'},
                {id: 'email', title: 'EMAIL'}
            ]
        });

        // Obtener restaurantes por radio kilométrico (mucho más fiable que por nombre de área)
        const overpassQuery = `
            [out:json][timeout:90];
            node["amenity"="restaurant"](around:${city.radius}, ${city.lat}, ${city.lon});
            out ${LIMIT_PER_CITY};
        `;

        try {
            console.log(`   Buscando coordenadas de hasta ${LIMIT_PER_CITY} restaurantes en ${city.name}...`);
            const response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(overpassQuery)}`, {
                headers: { 'User-Agent': 'QuantiChef-Bot/2.0 (contacto@quantichef.com)' }
            });

            const elements = response.data.elements;
            let leads = [];

            console.log(`   Se encontraron ${elements.length} locales. Escaneando sus webs...`);

            // Filtrar directamente los que tienen página web para no perder tiempo en búsquedas inútiles de Google
            const conWeb = elements.filter(el => el.tags && (el.tags.website || el.tags['contact:website']));
            console.log(`   De esos locales, ${conWeb.length} tienen web pública. Entrando a cada una...`);

            for (const el of conWeb) {
                const name = el.tags.name || 'Restaurante';
                let website = el.tags.website || el.tags['contact:website'];
                let email = 'No encontrado';

                if (website && website.startsWith('http') && !website.includes('google.com') && !website.includes('facebook.com') && !website.includes('instagram.com')) {
                    try {
                        const webRes = await axios.get(website, { timeout: 5000 });
                        const $ = cheerio.load(webRes.data);
                        const html = $.html();
                        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
                        const emailsEncontrados = html.match(emailRegex);

                        if (emailsEncontrados) {
                            // Limpiar correos falsos (png, jpg, wix)
                            const uniqueEmails = [...new Set(emailsEncontrados)].filter(e => 
                                !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.webp') && !e.includes('sentry')
                            );
                            if (uniqueEmails.length > 0) email = uniqueEmails[0]; // Nos quedamos con el principal
                        }
                    } catch (e) {
                        // Si la web falla, simplemente pasamos
                    }
                }

                if (email !== 'No encontrado') {
                    leads.push({ name, website, email });
                }
                await delay(150); // Pausa para no ser bloqueado
            }

            if(leads.length > 0) {
                await csvWriter.writeRecords(leads);
                console.log(`   ✅ ¡Éxito! Guardados ${leads.length} leads de oro (con email real) en leads_${city.name}.csv`);
            } else {
                console.log(`   ⚠️ No se pudieron raspar correos electrónicos limpios en esta pasada.`);
            }

        } catch (error) {
            console.error(`   ❌ Error en ${city.name}:`, error.message);
        }

        console.log(`   Finalizado el trabajo en ${city.name}. Descansando 10 segundos antes del siguiente salto...\n`);
        await delay(10000);
    }

    console.log("🎉 RASTREO GPS FINALIZADO. La base de datos ha sido actualizada.");
}

runNationalScraper();
