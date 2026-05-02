// Script de importación de leads a Supabase
// Ejecutar con: node scripts/import-leads.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://ilzntryzijdfnntwuthp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_PATH = 'C:/Users/Massimo/Downloads/Leads - Sheet1.csv';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Palabras clave para segmentar
const SEGMENTO_A = ['propietario','owner','co-owner','co owner','business owner','ceo','chef y propietario','chef and co-owner','creador y propietario','fundador','founder','gerente y propietario'];
const SEGMENTO_B = ['f&b','food and beverage','food & beverage','jefe de operaciones','jefe de cocina','operations manager','gerente de operaciones','responsable de operaciones','operaciones','culinary'];
// Empresas a prioridad baja (demasiado grandes o irrelevantes)
const BAJA_PRIORIDAD = ['tui','intercruises','marriott','mcdonald','mcdonalds','kfc','subway','hard rock international','royal caribbean','sodexo','newrest','alsea'];

function segmentar(cargo, empresa) {
  const c = cargo.toLowerCase();
  const e = empresa.toLowerCase();
  if (BAJA_PRIORIDAD.some(bp => e.includes(bp))) return 'C';
  if (SEGMENTO_A.some(k => c.includes(k))) return 'A';
  if (SEGMENTO_B.some(k => c.includes(k))) return 'B';
  return 'C';
}

function parsearCSV(texto) {
  const lineas = texto.split('\n').slice(1); // saltar header
  const contactos = [];
  const emailsVistos = new Set();

  for (const linea of lineas) {
    if (!linea.trim()) continue;
    
    // Parsear CSV respetando comillas
    const cols = [];
    let campo = '', enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') { enComillas = !enComillas; }
      else if (c === ',' && !enComillas) { cols.push(campo.trim()); campo = ''; }
      else { campo += c; }
    }
    cols.push(campo.trim());

    const [nombre, apellidos, cargo, empresa, email] = cols;
    
    // Filtrar inválidos
    if (!email || email === 'nan' || !email.includes('@')) continue;
    if (emailsVistos.has(email.toLowerCase())) continue;
    emailsVistos.add(email.toLowerCase());

    const segmento = segmentar(cargo || '', empresa || '');
    
    contactos.push({
      nombre: nombre?.trim() || '',
      apellidos: apellidos?.trim() || '',
      cargo: cargo?.trim() || '',
      empresa: empresa?.trim() || '',
      email: email.toLowerCase().trim(),
      segmento,
      estado: 'pendiente' // pendiente | enviado | abierto | cliqueado | respondio | baja
    });
  }
  return contactos;
}

async function main() {
  console.log('📂 Leyendo CSV...');
  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
  const contactos = parsearCSV(csv);
  
  const porSegmento = { A: 0, B: 0, C: 0 };
  contactos.forEach(c => porSegmento[c.segmento]++);
  
  console.log(`✅ ${contactos.length} contactos válidos (sin duplicados)`);
  console.log(`   Segmento A (Propietarios/CEOs): ${porSegmento.A}`);
  console.log(`   Segmento B (F&B/Operaciones):   ${porSegmento.B}`);
  console.log(`   Segmento C (Otros/Hotels):       ${porSegmento.C}`);
  
  // Insertar en lotes de 50
  const lote = 50;
  let insertados = 0;
  for (let i = 0; i < contactos.length; i += lote) {
    const batch = contactos.slice(i, i + lote);
    const { error } = await sb
      .from('campana_contactos')
      .upsert(batch, { onConflict: 'email' });
    if (error) console.error(`❌ Error lote ${i}:`, error.message);
    else { insertados += batch.length; process.stdout.write(`\r   Insertando... ${insertados}/${contactos.length}`); }
  }
  console.log(`\n🎉 Importación completa: ${insertados} contactos en Supabase`);
}

main().catch(console.error);
