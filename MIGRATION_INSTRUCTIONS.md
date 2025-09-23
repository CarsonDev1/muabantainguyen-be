# Migration Instructions

## Thêm Image và Updated_at cho Announcements

Để thêm field `image` và `updated_at` vào bảng `announcements`, chạy migration sau:

```bash
cd server
node scripts/migrate.js
```

### Migration sẽ thực hiện:

1. **Thêm column `image`**: Cho phép lưu URL ảnh thông báo
2. **Thêm column `updated_at`**: Tự động cập nhật khi record được modify
3. **Tạo trigger**: Tự động update `updated_at` khi có thay đổi
4. **Tạo index**: Tối ưu performance cho column `image`

### Sau khi chạy migration:

-   Backend sẽ có thể SELECT `updated_at` trong admin routes
-   Frontend có thể hiển thị thời gian cập nhật cuối cùng
-   Swagger documentation sẽ phản ánh đúng schema

### Lưu ý:

-   Migration đã được tạo sẵn trong `server/sql/012_add_announcement_image.sql`
-   Migration sử dụng `IF NOT EXISTS` nên có thể chạy nhiều lần an toàn
-   Trigger sẽ tự động cập nhật `updated_at` mỗi khi có UPDATE query
