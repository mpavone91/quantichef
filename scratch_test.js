const axios = require('axios');
async function test() {
    const city = "Valencia";
    const overpassQuery = `
        [out:json][timeout:25];
        area["name"="${city}"]["admin_level"="8"]->.searchArea;
        node["amenity"="restaurant"](area.searchArea);
        out 500;
    `;
    try {
        console.log("Testing specific area query for", city);
        const response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(overpassQuery)}`, {
            headers: { 'User-Agent': 'QuantiChef-Bot/1.0' }
        });
        const elements = response.data.elements;
        console.log('Result count:', elements.length);
        const withWebsite = elements.filter(el => el.tags && (el.tags.website || el.tags['contact:website']));
        console.log('With website:', withWebsite.length);
    } catch(e) { console.error('Error:', e.message); }
}
test();
