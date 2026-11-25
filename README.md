# Xếp thời khóa biểu từ Word

Ứng dụng đọc danh sách nhóm lớp từ tệp Word, chọn một nhóm cho mỗi môn và tìm các tổ hợp không trùng thứ/tiết. Các phương án tìm được được xếp theo số ngày đến trường tăng dần.

## Mở ứng dụng

Nhấp đúp vào start_app.bat hoặc index.html. Không cần cài đặt hay khởi động máy chủ. Cần Internet để tải Vue, Tailwind và phông chữ; bộ đọc Word JSZip được lưu trong thư mục vendor.

## Định dạng Word

Dùng tệp .docx (tối đa 10 MB). Mỗi môn bắt đầu bằng một đoạn văn:

    32221036: Thực hành dạy học toán phát triển phẩm chất, năng lực học sinh tiểu học

Ngay sau tiêu đề là bảng đúng 4 cột, theo thứ tự:

| Mã lớp | Giảng viên | Thứ | Tiết |
| --- | --- | --- | --- |
| 24 - 0102 | Vũ Đình Chinh | 5 | 78 |
| 24 - 0101 | Vũ Đình Chinh | 5 | 910 |

Có thể có hoặc không có hàng tiêu đề cột. Thứ từ 2 đến 7; Chủ nhật ghi CN hoặc 8.

- Tiết viết liền: 123, 456, 56, 78, 910, 8910, 1011, 1112.
- Có thể ghi rõ 1-3, 7-8, hoặc 7, 8.
- Riêng 12 có thể hiểu là tiết 1 và 2 hoặc tiết 12. Hãy ghi 1-2 hoặc Tiết 12 để tránh nhầm.
- Một lớp có nhiều buổi: lặp mã lớp và cùng giảng viên trên nhiều dòng. Khi xếp lịch, tất cả các buổi của lớp đều được kiểm tra. Ô gộp dọc trong Word được hỗ trợ.
- Ô trống không được tự điền bằng lịch hoặc giảng viên giả định.

## Nhập và xem lịch

1. Chọn tệp Word.
2. Web tự nhập phần dữ liệu hợp lệ và xếp lịch ngay, không cần xác nhận.
3. Môn thiếu lịch hoặc nhóm có dòng lỗi được bỏ qua và báo trên trang. Bổ sung trong Word rồi chọn lại tệp để xếp đủ môn.
4. Phần **Bộ lọc** trên lịch hiển thị sẵn ngày muốn nghỉ, tránh tiết 1/12, giảng viên và tất cả nhóm lớp của từng môn. Chọn trực tiếp, không cần mở hay thu gọn. Các điều kiện kết hợp với nhau và cập nhật ngay. Bấm dấu × trên từng nhãn để bỏ nhanh, hoặc **Bỏ hết bộ lọc** để khôi phục.
   Chọn **Ưu tiên** ít ngày học hoặc ít tiết trống giữa buổi. Tiết trống được tính riêng cho sáng và chiều, không tính giờ nghỉ trưa. Chuyển phương án bằng nút mũi tên hoặc danh sách.
5. Bấm **Xuất Word** ở thanh trên để tải `TKB-phuong-an-N.docx` của phương án đang xem. Đầu tệp là bảng danh sách nhóm lớp theo từng môn (mã lớp, giảng viên, thứ, tiết), sau đó là bảng thời khóa biểu. Mã môn và mã lớp được tô đỏ. Word tự phân trang theo nội dung.

Tệp được đọc trong trình duyệt, không gửi nội dung đến máy chủ. Dữ liệu chỉ có trong phiên đang mở; tải lại trang cần chọn lại tệp. Chọn tệp mới có dữ liệu hợp lệ sẽ thay lịch hiện tại ngay; tệp hỏng hoặc không có nhóm hợp lệ không thay lịch đang xem.

Nhóm lớp có bất kỳ dòng lỗi nào sẽ không được nhập, để tránh mất một buổi của lớp. Nếu bỏ chọn hết các nhóm của một môn trong bộ lọc thì không có phương án; thao tác này không bỏ môn khỏi lịch.

Giới hạn tìm kiếm: tối đa 5.000 kết quả hoặc 250.000 bước duyệt. Nếu chạm giới hạn, web báo rõ kết quả có thể chưa đầy đủ. Khi đó ưu tiên ít ngày chỉ áp dụng trong các kết quả đã tìm được.

## Khung giờ

Đã đối chiếu PDF Thông báo số 1243/TB-ĐHSP ngày 04/08/2025, áp dụng từ học kỳ Thu năm học 2025–2026.

| Tiết | Bắt đầu | Kết thúc |
| --- | --- | --- |
| 1 | 07:00 | 07:50 |
| 2 | 07:50 | 08:40 |
| 3 | 08:45 | 09:35 |
| 4 | 09:40 | 10:30 |
| 5 | 10:35 | 11:25 |
| 6 | 11:25 | 12:15 |
| 7 | 13:00 | 13:50 |
| 8 | 13:50 | 14:40 |
| 9 | 14:45 | 15:35 |
| 10 | 15:40 | 16:30 |
| 11 | 16:35 | 17:25 |
| 12 | 17:25 | 18:15 |

Nghỉ trưa 12:15–13:00. Khung giờ là cấu hình cố định trong timetable.js, không cần tải PDF mỗi lần.

Có CSS in ngang A4; dùng chức năng In của trình duyệt để in hoặc lưu PDF. Chưa có nút xuất PNG, lưu yêu thích hoặc đăng ký học phần.

## Kiểm tra

Chạy các kiểm tra xử lý tiết, giờ, xung đột nhiều buổi và tìm phương án:

    node --test tests/timetable.test.cjs

Mở tests/docx.test.html trong trình duyệt để chạy 8 kiểm tra đọc Word, gồm bảng trống, ô gộp, nhiều buổi, dòng lỗi và tệp hỏng.

Bộ đọc .docx sử dụng JSZip; giấy phép tại vendor/JSZip-LICENSE.md.

