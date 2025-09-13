-- sql/010_site_settings.sql

-- Cập nhật site_settings với cấu trúc tốt hơn
DROP TABLE IF EXISTS site_settings;

CREATE TABLE site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'text', -- 'text', 'number', 'boolean', 'json', 'image'
  category VARCHAR(50) NOT NULL DEFAULT 'general', -- 'general', 'branding', 'contact', 'seo'
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE, -- Có thể truy cập từ API public không
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO site_settings (key, value, type, category, display_name, description, is_public) VALUES
-- Branding
('site_name', 'Muabantainguyen', 'text', 'branding', 'Tên website', 'Tên hiển thị của website', true),
('site_logo', '', 'image', 'branding', 'Logo website', 'URL logo chính', true),
('site_favicon', '', 'image', 'branding', 'Favicon', 'Icon nhỏ trên browser tab', true),
('site_banner', '', 'image', 'branding', 'Banner trang chủ', 'Ảnh banner chính', true),

-- Contact
('contact_email', 'contact@muabantainguyen.com', 'text', 'contact', 'Email liên hệ', 'Email hỗ trợ khách hàng', true),
('contact_phone', '', 'text', 'contact', 'Số điện thoại', 'Hotline hỗ trợ', true),
('contact_address', '', 'text', 'contact', 'Địa chỉ', 'Địa chỉ công ty', true),

-- SEO
('seo_title', 'Muabantainguyen - Shop Digital', 'text', 'seo', 'SEO Title', 'Tiêu đề SEO trang chủ', true),
('seo_description', 'Website bán sản phẩm digital chất lượng cao', 'text', 'seo', 'SEO Description', 'Mô tả SEO trang chủ', true),
('seo_keywords', 'digital, shop, vietnam', 'text', 'seo', 'SEO Keywords', 'Từ khóa SEO', true),

-- General
('maintenance_mode', 'false', 'boolean', 'general', 'Chế độ bảo trì', 'Bật/tắt chế độ bảo trì website', false),
('allow_registration', 'true', 'boolean', 'general', 'Cho phép đăng ký', 'Người dùng có thể tự đăng ký không', false),
('default_currency', 'VND', 'text', 'general', 'Đơn vị tiền tệ', 'Đơn vị tiền mặc định', true),

-- System
('smtp_host', 'smtp.gmail.com', 'text', 'system', 'SMTP Host', 'Server email', false),
('smtp_port', '465', 'number', 'system', 'SMTP Port', 'Port email', false),
('smtp_user', '', 'text', 'system', 'SMTP User', 'Username email', false),
('system_email', 'system@muabantainguyen.com', 'text', 'system', 'Email hệ thống', 'Email gửi thông báo', false)
ON CONFLICT (key) DO NOTHING;