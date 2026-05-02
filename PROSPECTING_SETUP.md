# 🍽️ Sistema de Prospección Automática - QuantiChef

Guía completa para contactar tus 674 contactos por email automáticamente.

---

## ⚡ Setup en 5 minutos

### 1. Crear cuenta Resend (2 min)
- Ve a [resend.com](https://resend.com)
- Crea cuenta gratuita
- Copia tu **API Key** (comienza con `re_...`)
- Si tienes dominio propio, agrégalo; sino usaremos el test

### 2. Crear proyecto Supabase (2 min)
- Ve a [supabase.com](https://supabase.com)
- Crea proyecto gratis
- Ve a **Settings > API** y copia:
  - `SUPABASE_URL` (ej: `https://xxxxx.supabase.co`)
  - `SUPABASE_KEY` (anon key)

### 3. Configurar base de datos
1. En Supabase, abre el **SQL Editor**
2. Copia el contenido de `supabase_setup.sql`
3. Pégalo y ejecuta

### 4. Configurar variables de entorno
```bash
# Renombra el archivo
cp .env.example .env

# Edita .env con tus credenciales:
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=tu-email@tudominio.com
FROM_NAME=QuantiChef
```

### 5. Instalar dependencias
```bash
pip install -r requirements.txt
```

---

## 📋 Cargar Contactos

### Opción A: Desde CSV (tu archivo actual)
```bash
python load_contacts.py
```

Esto:
- Lee `contacts.csv`
- Valida emails
- Carga 674 contactos a Supabase
- Omite emails inválidos

### Opción B: Copiar/pegar datos
Si prefieres, abre `contacts.csv` en Excel y agrega tus contactos.

---

## 📧 Enviar Emails

### Enviar a los primeros 10 contactos
```bash
python send_emails.py send 10
```

### Enviar a los primeros 50
```bash
python send_emails.py send 50
```

### Enviar a todos (⚠️ cuidado!)
```bash
python send_emails.py send 674
```

### Ver progreso
```bash
python send_emails.py stats
```

Salida:
```
📊 Estadísticas de Contactos:
   Total: 674
   Enviados: 45
   Pendientes: 629
   Porcentaje: 6.7%
```

---

## ⏰ Automatizar Envíos Diarios

### Linux/Mac - Usando cron
```bash
# Abre crontab
crontab -e

# Agrega esta línea para enviar 20 emails cada día a las 9 AM:
0 9 * * * cd /home/user/quantichef && python send_emails.py send 20

# O cada 3 horas:
0 */3 * * * cd /home/user/quantichef && python send_emails.py send 10
```

### Windows - Usar Task Scheduler
1. Abre **Task Scheduler**
2. Crear tarea
3. Trigger: Diario a las 9 AM
4. Acción: `python C:\ruta\send_emails.py send 20`

---

## 📊 Personalizar Email

Edita el template en `send_emails.py`:

```python
TEMPLATE = """
<html>
  <body>
    <h2>Hola {nombre},</h2>
    <p>En <strong>{empresa}</strong>...</p>
    <!-- Tu contenido aquí -->
  </body>
</html>
"""
```

Variables disponibles:
- `{nombre}` - Nombre del contacto
- `{empresa}` - Nombre de la empresa
- Agregar más: edita la función `send_email_batch()`

---

## 🎯 Mejores Prácticas

### Volumen de envíos
- **Día 1**: 10-20 emails (probar)
- **Después**: 20-30 diarios (evita spam)
- **Máximo**: 50 diarios (límite recomendado)

### Timing
- Envía entre 9-10 AM o 4-5 PM (horarios laborales)
- Evita viernes por la tarde y fines de semana

### Monitoreo
```bash
# Ver en tiempo real
watch -n 5 'python send_emails.py stats'
```

---

## 🔧 Troubleshooting

### "Error: SUPABASE_URL or SUPABASE_KEY not set"
- Verifica que `.env` tenga valores correctos
- No uses comillas en `.env`

### "Invalid email format"
- Algunos contactos tienen emails vacíos o inválidos
- El script los omite automáticamente

### "Rate limit exceeded"
- Espera 1 hora
- O reduce a `send 5` por lote

### "Email no entregado"
- Verifica que `FROM_EMAIL` sea válido
- En Resend, confirma el dominio si no es el de prueba

---

## 📈 Próximos Pasos

1. **Tracking de aperturas**: Resend rastrea automáticamente
2. **Respuestas**: Crea un email de reply donde les consultes
3. **Follow-up**: Después de 3 días, envía un segundo email
4. **Scoring**: Trackea quién abrió, quién hizo clic

---

## 📞 Soporte

Cualquier error, revisa:
1. `.env` tiene valores correctos
2. Tabla `contacts` existe en Supabase
3. Dominio está verificado en Resend

¡Éxito con tu prospección! 🚀
