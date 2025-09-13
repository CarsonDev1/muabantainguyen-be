-- sql/009_admin_roles_permissions.sql

-- Bảng vai trò chi tiết
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng quyền hạn
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  module VARCHAR(50) NOT NULL, -- 'products', 'orders', 'users', 'settings'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng liên kết vai trò - quyền
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Thêm role_id vào bảng users
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role_id UUID REFERENCES admin_roles(id) ON DELETE SET NULL;

-- Insert default roles
INSERT INTO admin_roles (name, display_name, description) VALUES
('super_admin', 'Super Admin', 'Toàn quyền quản lý hệ thống'),
('admin', 'Admin', 'Quản lý toàn bộ shop'),
('product_manager', 'Product Manager', 'Chỉ quản lý sản phẩm và danh mục'),
('order_manager', 'Order Manager', 'Chỉ quản lý đơn hàng và khách hàng'),
('content_manager', 'Content Manager', 'Quản lý nội dung và cấu hình')
ON CONFLICT (name) DO NOTHING;

-- Insert permissions
INSERT INTO permissions (name, display_name, module, description) VALUES
-- Products
('products.view', 'Xem sản phẩm', 'products', 'Xem danh sách và chi tiết sản phẩm'),
('products.create', 'Tạo sản phẩm', 'products', 'Tạo sản phẩm mới'),
('products.edit', 'Sửa sản phẩm', 'products', 'Chỉnh sửa thông tin sản phẩm'),
('products.delete', 'Xóa sản phẩm', 'products', 'Xóa sản phẩm'),
('categories.manage', 'Quản lý danh mục', 'products', 'CRUD danh mục sản phẩm'),

-- Orders
('orders.view', 'Xem đơn hàng', 'orders', 'Xem danh sách và chi tiết đơn hàng'),
('orders.edit', 'Sửa đơn hàng', 'orders', 'Chỉnh sửa trạng thái đơn hàng'),
('orders.delete', 'Xóa đơn hàng', 'orders', 'Xóa đơn hàng'),

-- Users
('users.view', 'Xem người dùng', 'users', 'Xem danh sách người dùng'),
('users.edit', 'Sửa người dùng', 'users', 'Chỉnh sửa thông tin người dùng'),
('users.block', 'Khóa người dùng', 'users', 'Khóa/mở khóa tài khoản'),

-- Admins
('admins.view', 'Xem admin', 'admins', 'Xem danh sách admin'),
('admins.create', 'Tạo admin', 'admins', 'Tạo tài khoản admin mới'),
('admins.edit', 'Sửa admin', 'admins', 'Chỉnh sửa thông tin admin'),
('admins.delete', 'Xóa admin', 'admins', 'Xóa tài khoản admin'),

-- Settings
('settings.view', 'Xem cấu hình', 'settings', 'Xem cấu hình website'),
('settings.edit', 'Sửa cấu hình', 'settings', 'Chỉnh sửa cấu hình website'),

-- Analytics
('analytics.view', 'Xem báo cáo', 'analytics', 'Xem thống kê và báo cáo')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- Super Admin: Tất cả quyền
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin: Hầu hết quyền (trừ quản lý admin)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, permissions p 
WHERE r.name = 'admin' AND p.name NOT LIKE 'admins.%'
ON CONFLICT DO NOTHING;

-- Product Manager: Chỉ products và categories
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, permissions p 
WHERE r.name = 'product_manager' AND p.module IN ('products')
ON CONFLICT DO NOTHING;

-- Order Manager: orders và users
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, permissions p 
WHERE r.name = 'order_manager' AND p.module IN ('orders', 'users')
ON CONFLICT DO NOTHING;

-- Content Manager: settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, permissions p 
WHERE r.name = 'content_manager' AND p.module IN ('settings')
ON CONFLICT DO NOTHING;