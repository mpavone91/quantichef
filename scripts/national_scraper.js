const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const CITIES = ['Barcelona', 'Valencia', 'Sevilla', 'Malaga', 'Bilbao', 'Zaragoza'];
const LIMIT_PER_CITY = 500;

// Utilidad para pausar y no saturar servidores
const delay = ms => new Promise(res => setTimeout(res, ms));

async function runNationalScraper() {
    console.log("🇪🇸 INICIANDO RASTREO NACIONAL DE RESTAURANTES 🇪🇸");
    console.log("El robot va a recorrer España ciudad por ciudad mientras duermes.\n");

    for (const city of CITIES) {
        console.log(`📍 Viajando a ${city}...`);
        
        const outputPath = path.join(__dirname, `../leads_${city}.csv`);
        const csvWriter = createCsvWriter({
            path: outputPath,
            header: [
                {id: 'name', title: 'NOMBRE'},
                {id: 'website', title: 'WEB'},
                {id: 'email', title: 'EMAIL'}
            ]
        });

        // 1. Obtener restaurantes de OpenStreetMap
        const overpassQuery = `
            [out:json][timeout:25];
            area[name="${city}"]->.searchArea;
            node["amenity"="restaurant"](area.searchArea);
            out ${LIMIT_PER_CITY};
        `;

        try {
            console.log(`   Buscando coordenadas de restaurantes en ${city}...`);
            const response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(overpassQuery)}`, {
                headers: { 'User-Agent': 'QuantiChef-Bot/1.0 (contacto@quantichef.com)' }
            });

            const elements = response.data.elements;
            let leads = [];

            console.log(`   Se encontraron ${elements.length} locales. Escaneando sus webs...`);

            for (const el of elements) {
                if (el.tags && el.tags.name) {
                    const name = el.tags.name;
                    // Intentar usar la web del mapa, o adivinarla
                    let website = el.tags.website || el.tags['contact:website'] || `https://www.google.com/search?q=restaurante+${name.replace(/ /g, '+')}+${city}`;
                    
                    let email = 'No encontrado';

                    // Si hay web real, intentamos extraer el email
                    if (website.startsWith('http') && !website.includes('google.com')) {
                        try {
                            const webRes = await axios.get(website, { timeout: 4000 });
                            const $ = cheerio.load(webRes.data);
                            const html = $.html();
                            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
                            const emailsEncontrados = html.match(emailRegex);

                            if (emailsEncontrados) {
                                // Limpiar correos repetidos o falsos (png, jpg)
                                const uniqueEmails = [...new Set(emailsEncontrados)].filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.webp'));
                                if (uniqueEmails.length > 0) email = uniqueEmails.join(', ');
                            }
                        } catch (e) {
                            // Si la web falla, simplemente pasamos
                        }
                    }

                    leads.push({ name, website, email });
                    await delay(200); // Pausa para no ser bloqueado
                }
            }

            // Filtrar solo los que tienen email y guardar
            const leadsConEmail = leads.filter(l => l.email !== 'No encontrado');
            if(leadsConEmail.length > 0) {
                await csvWriter.writeRecords(leadsConEmail);
                console.log(`   ✅ Guardados ${leadsConEmail.length} nuevos leads con email en leads_${city}.csv`);
            } else {
                console.log(`   ⚠️ No se encontraron emails directos en esta pasada.`);
            }

        } catch (error) {
            console.error(`   ❌ Error en ${city}:`, error.message);
        }

        console.log(`   Finalizado el trabajo en ${city}. Descansando 5 segundos antes de viajar...\n`);
        await delay(5000);
    }

    console.log("🎉 RASTREO NACIONAL FINALIZADO. Puedes despertar tranquilo, tienes miles de leads nuevos.");
}

runNationalScraper();
