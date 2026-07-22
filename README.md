# Limgrow Task Hub

Ứng dụng nội bộ quản lý dự án, task và thời gian cho công ty, xây bằng Next.js 16, Supabase và các component theo phong cách shadcn/ui. Các role gồm Project Manager, Tester/QA, Business Analyst, UI/UX Designer, Graphic Designer và Developer.

## Chức năng workspace

- List view theo trạng thái với filter dự án, nhân sự và ưu tiên.
- Kanban board hỗ trợ kéo thả task giữa các trạng thái.
- Calendar view theo deadline.
- Product Backlog và Sprint Planning.
- Task detail drawer: mô tả, assignee, priority, deadline, estimate và nhãn.
- Checklist, bình luận, file đính kèm và activity history.
- Time tracker theo từng task và báo cáo giờ theo dự án.
- Web time tracker theo task: bấm bắt đầu/dừng, cập nhật thời gian đang chạy mỗi giây và so sánh actual/estimate.
- Project Manager quản lý role và xem workload của toàn bộ nhân sự.
- Toast success/error accessible, confirm dialog cho thao tác nguy hiểm và skeleton loading.
- Focus state cho bàn phím, menu mobile có backdrop và popup tự co theo viewport.
- Global navigation và sidebar phân nhóm theo phong cách Jira, dùng màu navy từ logo Limgrow.
- Hướng dẫn sử dụng 4 bước ngay trong ứng dụng, mở bằng biểu tượng `?` trên thanh trên cùng hoặc mục **Hướng dẫn sử dụng** ở sidebar.
- Dashboard thống kê riêng cho PM: KPI, biểu đồ giờ/ngày, trạng thái task, hiệu suất dự án, budget, workload nhân sự, cảnh báo vận hành và xuất worklog CSV.

## Hướng dẫn sử dụng nhanh

1. **PM → Thành viên:** chọn **Tạo tài khoản**, nhập email công ty, mật khẩu tạm và role. Nhân sự phải đổi mật khẩu khi đăng nhập lần đầu.
2. **PM → Dự án:** tạo dự án, chọn màu, khách hàng và ngân sách giờ.
3. **PM → Công việc:** tạo task, chọn dự án, người thực hiện, sprint, ưu tiên, deadline và thời gian ước tính.
4. **Cả đội → Công việc:** dùng List để lọc, Board để kéo trạng thái, Calendar để xem deadline và Backlog để lập sprint.
5. **Nhân sự → Chi tiết task:** bấm giờ khi bắt đầu, cập nhật checklist, bình luận, tệp đính kèm và dừng giờ khi kết thúc.
6. **PM → Báo cáo:** xem thời gian đã ghi theo dự án và kiểm tra workload của đội ngũ.

## Theo dõi thời gian trực tiếp trên web

Hệ thống không cần cài ứng dụng trên macOS/Windows và không theo dõi phần mềm hay website đang mở. Mỗi nhân sự chủ động ghi nhận thời gian thực hiện task trên Task Hub:

1. Mở **Theo dõi** và chọn task được giao.
2. Bấm **Bắt đầu bấm giờ**. Hệ thống tạo một `time_entry` trên Supabase và hiển thị thời gian tăng theo từng giây.
3. Có thể tải lại hoặc đóng tab; thời điểm bắt đầu vẫn được lưu trên server. Khi hoàn tất, quay lại và bấm **Dừng & lưu actual**.
4. Khi chuyển task, dialog xác nhận sẽ dừng timer cũ, lưu worklog rồi bắt đầu timer mới. Mỗi tài khoản chỉ có tối đa một timer đang chạy.
5. Màn hình **Actual so với Estimate** cảnh báo task gần hết giờ hoặc vượt estimate. PM có thể chọn toàn bộ công ty hoặc từng nhân sự; nhân viên chỉ đọc được time entry của chính mình theo RLS.

Màn Tracking cập nhật timer trên giao diện mỗi giây và đồng bộ thay đổi `time_entries` qua Supabase Realtime. Vì không có phần mềm desktop, hệ thống không tự phát hiện idle hoặc ứng dụng đang sử dụng; nhân sự cần dừng timer khi ngừng làm task để actual phản ánh chính xác.

Trong **Báo cáo**, PM mặc định xem toàn công ty và có thể chuyển sang từng nhân sự hoặc chính mình bằng các badge phạm vi. Mỗi nhân sự thường được xem thống kê cá nhân của chính họ. Tất cả có thể lọc theo dự án và khoảng 7/30/90 ngày hoặc toàn bộ dữ liệu; RLS đảm bảo nhân sự không đọc được time log của người khác. Các cảnh báo tự động gồm task quá hạn, task chưa giao, dự án dùng từ 80% ngân sách và timer chạy quá 8 giờ.

Nút **Tạo** trên thanh navy là lối tắt tạo task; khi đang ở màn hình Dự án, nút này tạo dự án. Ô tìm kiếm trên cùng lọc công việc theo tên.

## Thiết lập

1. Các biến Supabase đã nằm trong `.env.local`.
2. Thay `REPLACE_WITH_PERCENT_ENCODED_DB_PASSWORD` trong `DATABASE_URL` và `DIRECT_URL` bằng database password đã percent-encode.
3. Đồng bộ Prisma models và sinh client:

```bash
npm run db:validate
npm run db:generate
```

4. Database production được quản lý bằng các file trong `supabase/migrations/` và Supabase MCP; không cần copy SQL vào SQL Editor. Với Prisma migration, dùng `npm run db:migrate -- --name ten_thay_doi` ở môi trường phát triển và `npm run db:deploy` khi triển khai.
5. Trong Authentication → URL Configuration, thêm `http://localhost:3000/auth/callback` vào Redirect URLs.
6. Chạy ứng dụng:

```bash
npm run dev
```

Đăng ký công khai đã được tắt; Project Manager tạo tài khoản nhân sự trong màn hình **Thành viên**. PM có thể tạo dự án/task, giao việc và xem toàn bộ dữ liệu log task; các role khác chỉ thấy dự án được tham gia, task được giao và time entry của chính họ. Secret key chỉ được đọc ở server và tài khoản mới phải đổi mật khẩu trong lần đăng nhập đầu tiên.

## Kiểm tra

```bash
npm run db:validate
npm run db:generate
npm run lint
npm run build
```
