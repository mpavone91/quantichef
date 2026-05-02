import os
import time
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from resend import Resend

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
RESEND_API_KEY = os.getenv('RESEND_API_KEY')
FROM_EMAIL = os.getenv('FROM_EMAIL')
FROM_NAME = os.getenv('FROM_NAME', 'QuantiChef')

if not all([SUPABASE_URL, SUPABASE_KEY, RESEND_API_KEY, FROM_EMAIL]):
    print("❌ Error: Faltan variables en .env")
    print("   Requiere: SUPABASE_URL, SUPABASE_KEY, RESEND_API_KEY, FROM_EMAIL")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = Resend(api_key=RESEND_API_KEY)

TEMPLATE = """
<html>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <h2>Hola {nombre},</h2>

    <p>Somos <strong>QuantiChef</strong>, una solución de automatización de operaciones para restaurantes y hoteles.</p>

    <p>En <strong>{empresa}</strong>, creemos que tu equipo podría beneficiarse de:</p>
    <ul>
      <li>📊 Automatización de procesos operacionales</li>
      <li>💰 Reducción de costos operacionales</li>
      <li>⚡ Mejor eficiencia en el servicio</li>
    </ul>

    <p>¿Te gustaría agendar una breve llamada de 15 minutos para explorar cómo podemos ayudarte?</p>

    <p><strong>Saludos,</strong><br/>
    El equipo de QuantiChef</p>
  </body>
</html>
"""

def send_email_batch(limit=10, delay=2):
    """Envía emails a contactos no enviados"""

    print(f"📧 Buscando contactos no enviados...")

    try:
        response = supabase.table('contacts').select('*').eq('sent', False).limit(limit).execute()
        contacts = response.data

        if not contacts:
            print("✅ Todos los contactos ya han sido contactados")
            return

        print(f"📧 Encontrados {len(contacts)} contactos por contactar")
        print(f"⏱️  Enviando con {delay}s de espera entre emails...\n")

        for i, contact in enumerate(contacts, 1):
            nombre = contact['nombre']
            email = contact['email']
            empresa = contact['empresa']

            # Personalizar template
            html = TEMPLATE.format(nombre=nombre, empresa=empresa)

            try:
                # Enviar con Resend
                message = {
                    "from": f"{FROM_NAME} <{FROM_EMAIL}>",
                    "to": email,
                    "subject": f"Optimiza operaciones en {empresa} - QuantiChef",
                    "html": html,
                }

                result = client.emails.send(message)

                # Actualizar estado en Supabase
                supabase.table('contacts').update({
                    'sent': True,
                    'sent_at': datetime.now().isoformat(),
                    'resend_id': result.get('id')
                }).eq('id', contact['id']).execute()

                print(f"✅ [{i}/{len(contacts)}] Enviado a {nombre} ({email})")

                # Esperar entre emails (evitar rate limit)
                if i < len(contacts):
                    time.sleep(delay)

            except Exception as e:
                print(f"❌ [{i}/{len(contacts)}] Error enviando a {email}: {e}")

        print(f"\n✨ ¡Lote completado! {len(contacts)} emails enviados")

    except Exception as e:
        print(f"❌ Error: {e}")

def get_stats():
    """Muestra estadísticas de envíos"""
    try:
        total = supabase.table('contacts').select('id').execute()
        sent = supabase.table('contacts').select('id').eq('sent', True).execute()

        total_count = len(total.data)
        sent_count = len(sent.data)
        remaining = total_count - sent_count

        print("\n📊 Estadísticas de Contactos:")
        print(f"   Total: {total_count}")
        print(f"   Enviados: {sent_count}")
        print(f"   Pendientes: {remaining}")
        print(f"   Porcentaje: {(sent_count/total_count*100):.1f}%")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == 'stats':
            get_stats()
        elif sys.argv[1] == 'send':
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            send_email_batch(limit=limit)
    else:
        print("Uso:")
        print("  python send_emails.py send [cantidad]  - Enviar emails")
        print("  python send_emails.py stats            - Ver estadísticas")
        print("\nEjemplo: python send_emails.py send 20")
