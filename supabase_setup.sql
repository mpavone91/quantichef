-- Crear tabla de contactos
CREATE TABLE contacts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre TEXT NOT NULL,
  apellidos TEXT,
  email TEXT UNIQUE NOT NULL,
  cargo TEXT,
  empresa TEXT,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  opened BOOLEAN DEFAULT FALSE,
  clicked BOOLEAN DEFAULT FALSE,
  resend_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para mejor performance
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_sent ON contacts(sent);
CREATE INDEX idx_contacts_empresa ON contacts(empresa);

-- Crear tabla de logs de envíos (opcional)
CREATE TABLE email_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  contact_id BIGINT REFERENCES contacts(id),
  status TEXT,
  event_type TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  details JSONB
);

-- Habilitar Row Level Security (opcional pero recomendado)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
