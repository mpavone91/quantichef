import csv
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL or SUPABASE_KEY not set in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def load_contacts_from_csv(csv_file='contacts.csv'):
    """Carga contactos desde CSV a Supabase"""

    if not os.path.exists(csv_file):
        print(f"❌ Archivo {csv_file} no encontrado")
        return

    contacts = []
    skipped = 0

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = row.get('Email', '').strip()
            nombre = row.get('Nombre', '').strip()
            apellidos = row.get('Apellidos', '').strip()
            cargo = row.get('Cargo', '').strip()
            empresa = row.get('Empresa', '').strip()

            # Validar email
            if not email or '@' not in email:
                skipped += 1
                continue

            contacts.append({
                'nombre': nombre,
                'apellidos': apellidos,
                'email': email,
                'cargo': cargo,
                'empresa': empresa,
                'sent': False,
                'opened': False,
                'clicked': False,
                'created_at': 'now()'
            })

    if not contacts:
        print("❌ No hay contactos válidos para cargar")
        return

    print(f"📝 Cargando {len(contacts)} contactos a Supabase...")

    try:
        # Insertar en lotes de 100
        for i in range(0, len(contacts), 100):
            batch = contacts[i:i+100]
            response = supabase.table('contacts').insert(batch).execute()
            print(f"✅ Lote {i//100 + 1}: {len(batch)} contactos insertados")

        print(f"\n✨ ¡Éxito! {len(contacts)} contactos cargados")
        if skipped > 0:
            print(f"⚠️  {skipped} contactos ignorados (email inválido)")

    except Exception as e:
        print(f"❌ Error al insertar: {e}")

if __name__ == '__main__':
    load_contacts_from_csv()
