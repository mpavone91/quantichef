<!DOCTYPE html>
<html lang="es">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-BBXNWHTD8Y"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-BBXNWHTD8Y');
</script>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E4D2B">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QuantiChef — Escandallo inteligente</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#F9F7F2;--surface:#FFFFFF;--surface2:#F2EFE9;--border:#E0DDD6;--text:#1A1916;--text2:#4A4845;--text3:#8A8784;--accent:#1E4D2B;--accent-mid:#2D5A3D;--accent-light:#E8F2EC;--accent-mint:#C8E6D0;--gold:#C4943A;--gold-light:#FFF4E0;--warn:#8B4A00;--warn-light:#FFF3E0;--danger:#8B1A1A;--danger-light:#FDEAEA}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding-bottom:4rem}
  
  header{background:var(--accent);padding:1.1rem 1.2rem;display:flex;align-items:center;justify-content:space-between;gap:8px}
  .header-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
  .trial-badge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:12px;padding:5px 12px;border-radius:20px;display:flex;align-items:center;gap:6px}
  .btn-upgrade{background:var(--gold);color:#fff;font-size:12px;font-weight:700;padding:6px 14px;border-radius:7px;text-decoration:none}

  /* Modales */
  .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)}
  .modal-overlay.visible{display:flex}
  .modal{background:var(--surface);border-radius:16px;padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center;animation:fadeIn .2s ease}
  .modal-icon{width:56px;height:56px;background:var(--gold-light);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 1.2rem}
  .modal h3{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:300;margin-bottom:.5rem}

  /* Banner Digitalizar */
  .import-upsell-banner { background: linear-gradient(135deg, var(--gold) 0%, #E6B755 100%); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.1); color: var(--text); }
  .upsell-title { font-size: 15px; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
  .btn-upsell-url { background: white; color: var(--accent); border: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.1); font-family: inherit;}
  .btn-upsell-url:hover { transform: translateY(-2px); }

  /* Layout Cards */
  .container{max-width:860px;margin:0 auto;padding:2rem 1.5rem}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.4rem;margin-bottom:.875rem}
  .card-title{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:1rem;display:flex;align-items:center;gap:8px}
  .card-title::after{content:'';flex:1;height:1px;background:var(--border)}
  
  .grid-4{display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:12px}
  .toggle-row{display:flex;align-items:center;gap:10px;margin-bottom:1rem;padding:10px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);position:relative; overflow:hidden;}
  .toggle-label{font-size:13px;font-weight:600;color:var(--text2);flex:1}
  .toggle-label small{display:block;font-size:11px;font-weight:400;color:var(--text3);margin-top:1px}
  
  /* Inputs y Botones */
  input, select{width:100%;padding:10px 12px;font-size:14px;border:1px solid var(--border);border-radius:8px;outline:none;background:white;}
  .btn-fill { background: var(--accent); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: background 0.2s; display: inline-flex; align-items: center; justify-content: center; }
  
  /* Ingredientes Tabla */
  .ing-header{display:grid;gap:6px;margin-bottom:6px}
  .ing-header.sin-merma{grid-template-columns:2.5fr .7fr .7fr 80px 28px}
  .ing-header.con-merma{grid-template-columns:2.2fr .6fr .6fr 70px 60px 28px}
  .ing-header span{font-size:10px;font-weight:700;color:var(--text3)}
  .ing-row{display:grid;gap:6px;align-items:center;margin-bottom:6px}
  .ing-row.sin-merma{grid-template-columns:2.5fr .7fr .7fr 80px 28px}
  .ing-row.con-merma{grid-template-columns:2.2fr .6fr .6fr 70px 60px 28px}
  .btn-del{width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:none;color:var(--text3);cursor:pointer;display:flex;align-items:center;justify-content:center}
  
  /* Métricas */
  .metrics{display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:8px;margin-bottom:.875rem}
  .metric{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 10px;text-align:center}
  .metric-label{font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:5px}
  .metric-value{font-family:'Fraunces',serif;font-size:20px;color:var(--text);font-weight:300}
  .metric-value.good{color:var(--accent)}
  
  .alergenos{display:flex;flex-wrap:wrap;gap:7px}
  .alg{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;cursor:pointer;padding:5px 11px;border-radius:20px;border:1px solid var(--border);background:var(--surface2)}
  .alg.active{background:var(--warn-light);border-color:var(--gold);color:var(--warn)}
  .alg input{display:none}

  @keyframes fadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
  @media(max-width:640px){
    .ing-header{display:none!important}
    .ing-row{grid-template-columns:1fr 1fr!important}
    .ing-row>input:first-child{grid-column:1/-1}
  }
</style>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>

<div id="auth-loading" style="display:flex;align-items:center;justify-content:center;min-height:100vh;color:#8A8784;font-size:14px;gap:10px">Cargando tu cocina...</div>

<div id="app-content" style="display:none">
<header>
  <a href="/dashboard" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
    <div style="width:34px;height:34px;background:linear-gradient(135deg, var(--gold) 0%, #E6B755 100%);border-radius:9px;display:flex;align-items:center;justify-content:center;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E4D2B" stroke-width="2.5"><path d="M22 17H2a1 1 0 0 0 0 2h20a1 1 0 0 0 0-2Z"></path><path d="M4 17a8 8 0 0 1 16 0H4Z"></path><circle cx="12" cy="5" r="1.5"></circle></svg>
    </div>
    <div style="font-family:'Fraunces',serif;font-size:18px;color:#fff;font-weight:600;">QuantiChef</div>
  </a>
  <div class="header-right">
    <div class="trial-badge" id="trial-badge"><span>Prueba · <strong id="trial-count">5 de 5</strong></span></div>
    <a href="/precios" class="btn-upgrade" id="btn-upgrade-header">Activar plan</a>
    <button onclick="cerrarSesion()" style="background:none;border:none;color:white;cursor:pointer;font-size:12px;opacity:0.6">Salir</button>
  </div>
</header>

<div class="container">

  <div class="import-upsell-banner" id="import-upsell-banner">
    <div class="upsell-content">
      <div class="upsell-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        Digitaliza tu Recetario Completo
      </div>
      <p style="font-size: 13px; margin: 0; opacity:0.9">Sube tu archivo <strong>Excel o CSV</strong> desde el Dashboard y crearemos todos tus escandallos automáticamente.</p>
    </div>
    <button class="btn-upsell-url" onclick="window.location.href='/dashboard'">Ir al Panel</button>
  </div>

  <div class="card">
    <div class="card-title">Datos del plato</div>
    <div class="grid-4">
      <div class="field"><label style="font-size:12px;font-weight:600">Nombre del plato</label><input type="text" id="nombre" placeholder="Ej: Merluza a la bilbaína" oninput="calcular()"></div>
      <div class="field"><label style="font-size:12px;font-weight:600">Categoría</label><select id="categoria" onchange="calcular()"><option value="">Seleccionar...</option><option>Entrante</option><option>Principal</option><option>Postre</option></select></div>
      <div class="field"><label style="font-size:12px;font-weight:600">Raciones</label><input type="number" id="raciones" value="1" min="1" oninput="calcular()"></div>
      <div class="field"><label style="font-size:12px;font-weight:600">Precio en carta</label><input type="number" id="precio-carta" placeholder="Ej: 14,00" oninput="calcular()"></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Ingredientes</div>
    <div class="toggle-row">
      <div class="toggle-label">Activar cálculo de mermas<small>Considera la pérdida al limpiar o cocinar</small></div>
      <label class="toggle" style="position:relative; display:inline-block; width:34px; height:20px;">
        <input type="checkbox" id="toggle-merma" onchange="handleMermaToggle()">
      </label>
    </div>
    <div class="ing-header sin-merma" id="ing-header">
      <span>Ingrediente</span><span>Cantidad</span><span>Unidad</span><span>€/Kg ó Ud</span><span></span>
    </div>
    <div id="ingredientes"></div>
    <button class="btn-fill" style="width:100%; margin-top:10px; background:none; border:1px dashed var(--border); color:var(--text2)" onclick="addIng()">+ Añadir ingrediente</button>
  </div>

  <div class="metrics">
    <div class="metric"><div class="metric-label">Coste total</div><div class="metric-value" id="m-coste">0,00 €</div></div>
    <div class="metric"><div class="metric-label">Coste ración</div><div class="metric-value" id="m-racion">0,00 €</div></div>
    <div class="metric"><div class="metric-label">Food Cost %</div><div class="metric-value" id="m-fc">—</div></div>
  </div>

  <div class="card">
    <div class="card-title">Alérgenos</div>
    <div class="alergenos" id="alergenos"></div>
  </div>

  <button class="btn-fill" id="btn-save" style="width:100%; padding:15px; font-size:16px" onclick="guardarEscandallo()">Guardar escandallo</button>

</div>

<script>
const SUPABASE_URL='https://ilzntryzijdfnntwuthp.supabase.co';
const SUPABASE_KEY='sb_publishable_qXyYLpM1403nu66tczLNCA_0s5EE3Re';
const {createClient}=supabase;
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);

let restauranteId=null, esPremium=false, ings=[], mermasOn=false;
const UNITS=["g","kg","ml","l","ud"];
const ALGS=["Gluten","Crustáceos","Huevos","Pescado","Cacahuetes","Soja","Lácteos","Frutos secos","Apio","Mostaza","Sésamo","Sulfitos","Altramuces","Moluscos"];

// ARMADURA ANTI-LOOP REFORZADA
async function initAuth(){
  const { data: { session }, error } = await sb.auth.getSession();
  
  if (error || !session) {
    window.location.href = '/login';
    return;
  }
  
  await cargarApp(session);

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = '/login';
  });
}

async function cargarApp(session){
  let rest = null;
  let intentos = 0;
  const maxIntentos = 5;
  
  while (!rest && intentos < maxIntentos) {
    const { data } = await sb.from('restaurantes').select('*').eq('user_id', session.user.id).maybeSingle();
    if (data) { rest = data; break; }
    intentos++;
    if (intentos < maxIntentos) await new Promise(r => setTimeout(r, 800));
  }

  if(!rest){
    document.getElementById('auth-loading').innerHTML = 
      `<div style="text-align:center;"><p style="color:var(--danger); font-weight:600;">No se pudo cargar tu perfil.</p><button onclick="window.location.reload()" style="background:var(--accent); color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; margin-top:10px;">Reintentar</button></div>`;
    return;
  }

  restauranteId = rest.id;
  esPremium = rest.plan === 'pro';
  
  document.getElementById('auth-loading').style.display = 'none';
  document.getElementById('app-content').style.display = 'block';
  
  const editData = sessionStorage.getItem('qc_escandallo_editar');
  if(editData) {
    cargarEscandallo(JSON.parse(editData));
  } else { 
    ings = [];
    addIng(); addIng(); addIng(); 
  }
}

function handleMermaToggle(){
  mermasOn=document.getElementById('toggle-merma').checked;
  const hdr=document.getElementById('ing-header');
  hdr.className='ing-header '+(mermasOn?'con-merma':'sin-merma');
  hdr.innerHTML=mermasOn?'<span>Ingrediente</span><span>Útil</span><span>Unidad</span><span>€/Kg</span><span>Merma%</span><span></span>' : '<span>Ingrediente</span><span>Cantidad</span><span>Unidad</span><span>€/Kg</span><span></span>';
  renderIngs();
}

function addIng(n='',q='',u='g',p='',m=0){
  ings.push({id:Date.now()+Math.random(), n, q, u, p, m});
  renderIngs();
}

function renderIngs(){
  const c=document.getElementById('ingredientes');
  ings.forEach(i=>{
    const row=document.getElementById('row'+i.id);
    if(row){
      i.n=row.querySelector('.in-n').value;
      i.q=row.querySelector('.in-q').value;
      i.u=row.querySelector('.in-u').value;
      i.p=row.querySelector('.in-p').value;
      if(mermasOn) i.m=row.querySelector('.in-m').value;
    }
  });
  
  c.innerHTML='';
  ings.forEach(i=>{
    const d=document.createElement('div');
    d.id='row'+i.id;
    d.className='ing-row '+(mermasOn?'con-merma':'sin-merma');
    d.innerHTML=`
      <input type="text" class="in-n" value="${i.n}" placeholder="Ingrediente" oninput="calcular()">
      <input type="number" class="in-q" value="${i.q}" placeholder="0" oninput="calcular()">
      <select class="in-u" onchange="calcular()">${UNITS.map(u=>`<option ${u===i.u?'selected':''}>${u}</option>`).join('')}</select>
      <input type="number" class="in-p" value="${i.p}" placeholder="0.00" oninput="calcular()">
      ${mermasOn?`<input type="number" class="in-m" value="${i.m}" placeholder="0" oninput="calcular()">`:''}
      <button class="btn-del" onclick="ings=ings.filter(x=>x.id!==${i.id});renderIngs()">×</button>
    `;
    c.appendChild(d);
  });
  calcular();
}

function calcular(){
  let total=0;
  ings.forEach(i=>{
    const row=document.getElementById('row'+i.id);
    if(row){
      const q=parseFloat(row.querySelector('.in-q').value)||0;
      const p=parseFloat(row.querySelector('.in-p').value)||0;
      const u=row.querySelector('.in-u').value;
      const m=mermasOn?(parseFloat(row.querySelector('.in-m').value)||0)/100:0;
      const qBase = (u==='g'||u==='ml') ? q/1000 : q;
      total += (m>0 ? qBase/(1-m) : qBase) * p;
    }
  });

  const rac=parseFloat(document.getElementById('raciones').value)||1;
  const pCarta=parseFloat(document.getElementById('precio-carta').value)||0;
  const racCost=total/rac;

  document.getElementById('m-coste').textContent=total.toFixed(2)+' €';
  document.getElementById('m-racion').textContent=racCost.toFixed(2)+' €';
  if(pCarta>0) document.getElementById('m-fc').textContent=((racCost/pCarta)*100).toFixed(1)+'%';
  else document.getElementById('m-fc').textContent='—';
}

function cargarEscandallo(e){
  document.getElementById('nombre').value=e.nombre_plato;
  document.getElementById('categoria').value=e.categoria||'';
  document.getElementById('raciones').value=e.raciones||1;
  document.getElementById('precio-carta').value=e.precio_carta||0;
  
  ings=e.ingredientes.map(i=>({id:Date.now()+Math.random(), n:i.nombre, q:i.cantidad, u:i.unidad, p:i.precio, m:i.merma||0}));
  
  if(ings.some(i=>i.m > 0)) {
    document.getElementById('toggle-merma').checked=true;
    mermasOn=true;
    document.getElementById('ing-header').className='ing-header con-merma';
    document.getElementById('ing-header').innerHTML='<span>Ingrediente</span><span>Útil</span><span>Unidad</span><span>€/Kg</span><span>Merma%</span><span></span>';
  }

  if(e.alergenos){
    document.querySelectorAll('.alg').forEach(l=>{
      if(e.alergenos.includes(l.textContent.trim())){
        l.querySelector('input').checked=true;
        l.classList.add('active');
      }
    });
  }
  renderIngs();
}

async function guardarEscandallo(){
  const btn=document.getElementById('btn-save');
  btn.disabled=true; btn.textContent='Guardando...';

  const payload={
    restaurante_id: restauranteId,
    nombre_plato: document.getElementById('nombre').value,
    categoria: document.getElementById('categoria').value,
    raciones: parseInt(document.getElementById('raciones').value),
    precio_carta: parseFloat(document.getElementById('precio-carta').value),
    ingredientes: ings.map(i=>{
      const row=document.getElementById('row'+i.id);
      return {
        nombre: row.querySelector('.in-n').value,
        cantidad: parseFloat(row.querySelector('.in-q').value),
        unidad: row.querySelector('.in-u').value,
        precio: parseFloat(row.querySelector('.in-p').value),
        merma: mermasOn ? parseFloat(row.querySelector('.in-m').value) : 0
      };
    }),
    alergenos: Array.from(document.querySelectorAll('.alg input:checked')).map(i=>i.parentElement.textContent.trim()),
    coste_racion: parseFloat(document.getElementById('m-racion').textContent),
    updated_at: new Date().toISOString()
  };

  const editData=sessionStorage.getItem('qc_escandallo_editar');
  const id=editData?JSON.parse(editData).id:null;
  const {error}=id ? await sb.from('escandallos').update(payload).eq('id',id) : await sb.from('escandallos').insert(payload);
  
  if(!error){
    sessionStorage.removeItem('qc_escandallo_editar');
    window.location.href='/dashboard';
  } else {
    alert('Error al guardar');
    btn.disabled=false; btn.textContent='Guardar escandallo';
  }
}

const algContainer=document.getElementById('alergenos');
ALGS.forEach(a=>{
  const l=document.createElement('label');
  l.className='alg';
  l.innerHTML=`<input type="checkbox" onchange="this.parentElement.classList.toggle('active',this.checked);calcular()"> ${a}`;
  algContainer.appendChild(l);
});

async function cerrarSesion(){ await sb.auth.signOut(); window.location.href='/login'; }
initAuth();
</script>

<script src="/chat-widget.js"></script>

</body>
</html>