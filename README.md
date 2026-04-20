# ZenCut Barber Management System

Hệ thống quản lý chuỗi Barber hiện đại, tập trung vào trải nghiệm khách hàng và hiệu suất nhân viên.

## Chức năng chính:
- **Bản đồ ghế (Live Map):** Theo dõi trạng thái thợ (Rảnh, Đang cắt, Sắp xong, Quá giờ, Nghỉ) theo thời gian thực.
- **Phân bô nhân sự:** Mỗi thợ được gán một ghế và khu vực cụ thể.
- **Hệ thống phiếu cắt:** Thợ nhập số phiếu để bắt đầu, hệ thống tự động kiểm tra trùng lặp.
- **Hàng chờ (Waiting Queue):** Thu ngân có thể thêm/bớt khách chờ ngay trên bản đồ. Hệ thống tự động trừ khách chờ khi thợ bắt đầu phục vụ.
- **Đo lường KPI:** Đánh giá thợ dựa trên tỷ lệ hoàn thành phiếu và thời gian cắt trung bình.
- **Phát hiện gian lận:** Tự động gắn cờ các phiếu cắt có thời gian bất thường.
- **Nhật ký hệ thống:** Lưu lại toàn bộ lịch sử thao tác của nhân viên.

## Quy trình sử dụng:
1. **Khởi tạo:** Admin tạo Khu vực và các Ghế tương ứng.
2. **Cấp tài khoản:** Admin tạo tài khoản cho Thu ngân và Thợ, gán vị trí cho Thợ.
3. **Phục vụ:** 
   - Thợ đăng nhập, nhập số phiếu và bấm **"Đang Cắt"**.
   - Sau thời gian trung bình (mặc định 20p), ghế chuyển sang màu Vàng (Sắp xong).
   - Nếu quá thời gian tối đa (mặc định 40p), ghế nháy Đỏ và cảnh báo Thu ngân.
   - Thợ bấm **"Đã Xong"** để giải phóng ghế.
4. **Theo dõi:** 
   - Thu ngân điều phối khách dựa trên số lượng khách chờ ở mỗi ghế.
   - Admin xem báo cáo KPI cuối ngày/tuần/tháng.

## Hướng dẫn chạy:
1. App đã được cấu hình với Firebase (Auth & Firestore).
2. Tài khoản Admin đầu tiên: Bạn có thể tự đăng ký qua code hoặc dùng trang Admin để tạo.
3. Để chạy local: `npm run dev` (Cổng 3000).

## Công nghệ sử dụng:
- **Frontend:** React 19, Vite, Tailwind CSS v4, Framer Motion.
- **Backend:** Express (Vite Middleware).
- **Database:** Firebase Firestore (Realtime).
- **Icons:** Lucide React.
- **Charts:** Recharts.
