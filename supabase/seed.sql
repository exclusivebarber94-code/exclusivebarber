-- =====================================================================
--  DATOS DE EJEMPLO SOLO PARA EL SUPABASE LOCAL (pruebas)
--  Este archivo solo se ejecuta en local con `supabase start` / `supabase db reset`.
--  Nunca se aplica al Supabase real con `db push`.
-- =====================================================================

-- Administrador de prueba:  admin@exclusivebarber.co  /  Admin12345
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'admin@exclusivebarber.co',
  extensions.crypt('Admin12345', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@exclusivebarber.co","email_verified":true}',
  'email', now(), now(), now()
);

INSERT INTO admin_users (email) VALUES ('admin@exclusivebarber.co');

-- Barberos reales del equipo. Los PIN son solo de prueba local (Guinyer 1111, Orlando 2222);
-- en producción cada barbero conserva el suyo.
INSERT INTO barbers (name, short_name, phone, bio, specialties, rating, review_count, available, pin, commission, avatar) VALUES
  ('Guinyer Linares', 'Guinyer', '3144110530',
   'Especialista en cortes clásicos, modernos, rasurado tradicional, barba, depilación y tratamientos capilares.',
   '["Cortes Clásicos","Cortes Modernos","Barba","Depilación","Tratamientos Capilares"]', 5, 1, true, '1111', 60, 'GL'),
  ('Orlando Ramos', 'Orlando', '300 000 0000',
   'Hola. Mi nombre es Orlando Ramos, tengo 22 años y soy barbero desde los 14 años contando con 7 años de experiencia.',
   '["Cortes Clásicos","Fade","Barba","Cortes Modernos"]', 5, 0, true, '2222', 50, 'OR');

INSERT INTO services (name, category, duration, price, description, popular) VALUES
  ('Cerquillos', 'cortes', 10, 10000, 'Servicio especializado en la perfilación de contornos.', true),
  ('Corte + mascarilla', 'cortes', 40, 40000, 'Corte de cabello y limpieza facial con mascarilla black.', true),
  ('Corte de cabello', 'cortes', 40, 30000, 'Degradado de alta precisión: técnica detallada.', true),
  ('Corte y Barba', 'cortes', 60, 40000, 'Transforma tu imagen con un corte personalizado y un perfilado de barba.', true),
  ('Corte+barba+mascarilla', 'cortes', 60, 50000, 'Comenzamos con un corte de cabello diseñado a tu medida.', true),
  ('Limpieza Facial', 'masajes', 30, 20000, 'Exfoliación y vapor con toalla caliente. Aplicación de mascarilla.', false),
  ('Solo Barba', 'barba', 30, 20000, 'Definición y forma perfecta para tu barba con acabado impecable.', false),
  ('Solo peinado', 'cortes', 30, 20000, 'Laca, plancha y secador.', false),
  ('Tratamiento Aminoácidos', 'tratamientos', 120, 120000, 'Nutrición profunda capilar para cabello suave, brillante y sano.', true),
  ('Ultra-Smooth Shave', 'cortes', 45, 25000, 'Corte al ras total utilizando cuchilla tradicional.', false);

-- Citas de ejemplo para hoy (hora de Colombia), para que el dashboard no salga vacío
INSERT INTO bookings (client_name, client_phone, service_id, service_name, barber_id, barber_name, date, time, price, status)
SELECT 'Cliente de Prueba 1', '3000000001', s.id, s.name, b.id, b.short_name,
       (now() AT TIME ZONE 'America/Bogota')::date, '10:00', s.price, 'pending'
FROM services s, barbers b WHERE s.name = 'Corte de cabello' AND b.short_name = 'Guinyer';

INSERT INTO bookings (client_name, client_phone, service_id, service_name, barber_id, barber_name, date, time, price, status)
SELECT 'Cliente de Prueba 2', '3000000002', s.id, s.name, b.id, b.short_name,
       (now() AT TIME ZONE 'America/Bogota')::date, '15:30', s.price, 'confirmed'
FROM services s, barbers b WHERE s.name = 'Corte y Barba' AND b.short_name = 'Guinyer';

-- Productos de ejemplo de la Shop (se administran en Panel -> Productos)
INSERT INTO products (id, name, brand, price, description, image, category) VALUES
  ('p-1', 'Pomada Mate Premium', 'American Crew', 45000, 'Control fuerte, acabado mate. Para estilos modernos y clásicos.',
   'https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg?auto=compress&cs=tinysrgb&w=800', 'Styling'),
  ('p-2', 'Aceite de Barba Gold', 'Exclusive Barber', 38000, 'Hidratación profunda con aceite de argán y vitamina E.',
   'https://images.pexels.com/photos/6621472/pexels-photo-6621472.jpeg?auto=compress&cs=tinysrgb&w=800', 'Barba'),
  ('p-3', 'Shampoo Anticaída', 'Paul Mitchell', 55000, 'Fórmula reforzante con biotina y keratina para cabello fuerte.',
   'https://images.pexels.com/photos/4202325/pexels-photo-4202325.jpeg?auto=compress&cs=tinysrgb&w=800', 'Cuidado');
