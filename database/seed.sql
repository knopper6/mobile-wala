INSERT INTO users (email, password_hash, role, status, display_name, company_name, phone)
VALUES
  (
    'admin@mobilewala.com',
    '$2a$12$02gnh4rFsTmPiaEn3UyB/uCl2XUg6XGET9T7q0zbJn6s7oqbag1qu',
    'admin',
    'active',
    'MobileWala Admin',
    'Globein Trading USA LLP',
    '+1-555-0100'
  ),
  (
    'karan@kkmobiles.example',
    '$2a$12$02gnh4rFsTmPiaEn3UyB/uCl2XUg6XGET9T7q0zbJn6s7oqbag1qu',
    'reseller',
    'active',
    'Karan K',
    'KK Mobiles',
    '+1-555-0121'
  ),
  (
    'meera@metrophones.example',
    '$2a$12$02gnh4rFsTmPiaEn3UyB/uCl2XUg6XGET9T7q0zbJn6s7oqbag1qu',
    'reseller',
    'active',
    'Meera Shah',
    'Metro Phones LLC',
    '+1-555-0188'
  );

INSERT INTO reseller_profiles (
  user_id,
  gst_or_tax_id,
  business_address,
  city,
  state,
  country,
  postal_code,
  preferred_brands,
  monthly_volume_estimate,
  approved_at
)
SELECT id, 'US-TAX-10291', '742 Market Street', 'Dallas', 'TX', 'USA', '75201', ARRAY['Apple', 'Samsung'], 350, NOW()
FROM users WHERE email = 'karan@kkmobiles.example';

INSERT INTO reseller_profiles (
  user_id,
  gst_or_tax_id,
  business_address,
  city,
  state,
  country,
  postal_code,
  preferred_brands,
  monthly_volume_estimate,
  approved_at
)
SELECT id, 'US-TAX-83902', '18 River Road', 'Newark', 'NJ', 'USA', '07102', ARRAY['Apple', 'Google'], 220, NOW()
FROM users WHERE email = 'meera@metrophones.example';

WITH admin_user AS (
  SELECT id FROM users WHERE email = 'admin@mobilewala.com'
), created_lot AS (
  INSERT INTO lots (
    title,
    series,
    grade_label,
    status,
    description,
    starting_bid,
    bid_increment,
    currency,
    starts_at,
    ends_at,
    created_by
  )
  SELECT
    'IPHONE 14 PRO SERIES HYLA A+ & DNA',
    'iPhone 14 Pro Series',
    'HYLA A+ & DNA',
    'active',
    'Text-only wholesale lot for refurbished iPhone 14 Pro inventory.',
    125000.00,
    500.00,
    'USD',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '5 days',
    id
  FROM admin_user
  RETURNING id
)
INSERT INTO lot_variants (lot_id, storage_capacity, color_name, color_indicator, quantity, starting_bid, bid_increment, grade_label, sort_order)
SELECT id, '128GB', 'Gold', '🟠', 213, 48000.00, 250.00, 'A+', 1 FROM created_lot
UNION ALL SELECT id, '128GB', 'Silver', '⚪', 94, 47500.00, 250.00, 'A+', 2 FROM created_lot
UNION ALL SELECT id, '256GB', 'Gold', '🟠', 74, 55500.00, 250.00, 'DNA', 3 FROM created_lot
UNION ALL SELECT id, '256GB', 'Silver', '⚪', 98, 55250.00, 250.00, 'DNA', 4 FROM created_lot
UNION ALL SELECT id, '512GB', 'Gold', '🟠', 16, 64000.00, 500.00, 'A+', 5 FROM created_lot;

WITH admin_user AS (
  SELECT id FROM users WHERE email = 'admin@mobilewala.com'
), created_lot AS (
  INSERT INTO lots (
    title,
    series,
    grade_label,
    status,
    description,
    starting_bid,
    bid_increment,
    currency,
    starts_at,
    ends_at,
    created_by
  )
  SELECT
    'SAMSUNG S23 ULTRA A STOCK',
    'Samsung Galaxy S23 Ultra',
    'A Stock',
    'scheduled',
    'Carrier-unlocked Samsung flagship lot, text listing only.',
    78500.00,
    250.00,
    'USD',
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '8 days',
    id
  FROM admin_user
  RETURNING id
)
INSERT INTO lot_variants (lot_id, storage_capacity, color_name, color_indicator, quantity, starting_bid, bid_increment, grade_label, sort_order)
SELECT id, '256GB', 'Green', '🟢', 120, 36500.00, 250.00, 'A Stock', 1 FROM created_lot
UNION ALL SELECT id, '256GB', 'Phantom Black', '🌑', 86, 36250.00, 250.00, 'A Stock', 2 FROM created_lot
UNION ALL SELECT id, '512GB', 'Green', '🟢', 44, 43000.00, 250.00, 'A Stock', 3 FROM created_lot
UNION ALL SELECT id, '512GB', 'Phantom Black', '🌑', 39, 42750.00, 250.00, 'A Stock', 4 FROM created_lot;

INSERT INTO bids (lot_id, variant_id, reseller_id, amount, note)
SELECT l.id, v.id, u.id, 48500.00, 'Opening wholesale bid'
FROM lots l
JOIN lot_variants v ON v.lot_id = l.id AND v.storage_capacity = '128GB' AND v.color_name = 'Gold'
JOIN users u ON u.email = 'karan@kkmobiles.example'
WHERE l.title = 'IPHONE 14 PRO SERIES HYLA A+ & DNA'
  AND u.email = 'karan@kkmobiles.example';

INSERT INTO bids (lot_id, variant_id, reseller_id, amount)
SELECT l.id, v.id, u.id, 48750.00
FROM lots l
JOIN lot_variants v ON v.lot_id = l.id AND v.storage_capacity = '128GB' AND v.color_name = 'Gold'
JOIN users u ON u.email = 'meera@metrophones.example'
WHERE l.title = 'IPHONE 14 PRO SERIES HYLA A+ & DNA'
  AND u.email = 'meera@metrophones.example';

INSERT INTO auction_events (lot_id, actor_id, event_type, metadata)
SELECT l.id, l.created_by, 'created', jsonb_build_object('title', l.title)
FROM lots l;

INSERT INTO auction_events (lot_id, actor_id, event_type, metadata)
SELECT l.id, b.reseller_id, 'bid_placed', jsonb_build_object('amount', b.amount)
FROM bids b
JOIN lots l ON l.id = b.lot_id;
