-- ============================================================
-- ERP System Database Seed Data
-- Default passwords:
-- Admin: Admin@123
-- Sales: Sales@123
-- ============================================================

-- 1. Insert Users
INSERT INTO users (name, email, password_hash, role) VALUES
('System Admin', 'admin@erp.com', '$2b$10$pmVk7ZwSdmW.A.BdG8W1H.tXLAkG9mVsyFEcT2Wk7HzH1CC8ndjkm', 'ADMIN'),
('Sales Executive', 'sales@erp.com', '$2b$10$UKDWsPXeI32TnA7X5l0fRuSHnOm5QqMePkxDrimqfJnd4sj7BwQLa', 'SALES_USER')
ON CONFLICT (email) DO NOTHING;

-- 2. Insert Products (At least 6 industrial products)
INSERT INTO products (id, product_code, product_name, category, unit, base_price) VALUES
(1, 'IP001', 'Industrial Hydraulic Pump', 'Hydraulics', 'PCS', 45000.00),
(2, 'IP002', 'Heavy Duty Conveyor Belt', 'Material Handling', 'MTRS', 2500.00),
(3, 'IP003', 'Electric Motor 5HP', 'Electrical', 'PCS', 32000.00),
(4, 'IP004', 'Industrial Gearbox', 'Transmission', 'PCS', 58000.00),
(5, 'IP005', 'Stainless Steel Valve', 'Piping', 'PCS', 8500.00),
(6, 'IP006', 'Pneumatic Cylinder', 'Pneumatics', 'PCS', 12000.00)
ON CONFLICT (product_code) DO NOTHING;

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- 3. Insert Inventory
INSERT INTO inventory (product_id, physical_quantity, reserved_quantity) VALUES
(1, 190, 0),
(2, 500, 0),
(3, 95, 0),
(4, 75, 0),
(5, 280, 0),
(6, 150, 0)
ON CONFLICT (product_id) DO NOTHING;

-- 4. Insert Sample Customer
INSERT INTO customers (id, company_name, contact_person, mobile, email, city) VALUES
(1, 'ABC Engineering Pvt. Ltd.', 'Rajesh Kumar', '9876543210', 'rajesh@abcengineering.com', 'Mumbai')
ON CONFLICT (id) DO NOTHING;

SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));
