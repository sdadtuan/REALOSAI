import type { Metadata } from 'next';
import Link from 'next/link';
import { PortalPublicShell } from '@/components/layout';

export const metadata: Metadata = {
  title: 'Chính sách quyền riêng tư — PTT Portal',
  description:
    'Chính sách quyền riêng tư cho ứng dụng và portal PTT dành cho khách hàng doanh nghiệp (RNOS-M3 draft).',
  robots: { index: true, follow: true },
};

const LEGAL_ENTITY = process.env.NEXT_PUBLIC_PTT_LEGAL_ENTITY_NAME ?? '[Tên pháp nhân PTT — Legal cập nhật]';
const COMPANY_ADDRESS = process.env.NEXT_PUBLIC_PTT_COMPANY_ADDRESS ?? '[Địa chỉ công ty — Legal cập nhật]';
const DATA_REGION = process.env.NEXT_PUBLIC_PTT_DATA_REGION ?? '[Region VPS — Legal xác nhận]';
const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PTT_PRIVACY_EMAIL ?? 'privacy@pttads.vn';
const EFFECTIVE_DATE = '2026-08-01';
const DRAFT_VERSION = 'v0.1';

export default function PrivacyPage() {
  return (
    <PortalPublicShell
      badge={`Bản nháp ${DRAFT_VERSION} · Legal review pending`}
      title="Chính sách quyền riêng tư"
      subtitle={`PTT Portal · vn.pttads.portal · Hiệu lực dự kiến: ${EFFECTIVE_DATE}`}
      footer={
        <>
          <p style={{ margin: 0 }}>
            <Link href="/login">← Quay lại đăng nhập</Link>
          </p>
          <p style={{ margin: '0.5rem 0 0' }}>
            Support: <a href="https://pttads.vn/support">pttads.vn/support</a> · Marketing:{' '}
            <a href="https://pttads.vn">pttads.vn</a>
          </p>
        </>
      }
    >
      <div className="privacy-document">
        <section>
          <h2>1. Giới thiệu</h2>
          <p>
            Công ty <strong>{LEGAL_ENTITY}</strong> (&ldquo;PTT&rdquo;, &ldquo;chúng tôi&rdquo;) vận hành ứng dụng và
            portal <strong>PTT Portal</strong> dành cho khách hàng doanh nghiệp (client approver/viewer) xem hiệu suất
            chiến dịch, duyệt creative và email marketing.
          </p>
          <p>
            Chính sách này mô tả dữ liệu chúng tôi thu thập, mục đích sử dụng và quyền của bạn khi dùng portal web và
            ứng dụng mobile (Capacitor WebView).
          </p>
          <p className="muted">
            Liên hệ: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> · {COMPANY_ADDRESS}
          </p>
        </section>

        <section>
          <h2>2. Dữ liệu thu thập</h2>
          <div className="privacy-table-wrap portal-table-stack">
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Loại dữ liệu</th>
                  <th>Ví dụ</th>
                  <th>Nguồn</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Loại">Tài khoản</td>
                  <td data-label="Ví dụ">Email đăng nhập, vai trò (approver/viewer)</td>
                  <td data-label="Nguồn">Bạn / AM PTT cấp</td>
                </tr>
                <tr>
                  <td data-label="Loại">Thiết bị</td>
                  <td data-label="Ví dụ">Push token (FCM/APNs), platform iOS/Android</td>
                  <td data-label="Nguồn">App khi bạn bật thông báo</td>
                </tr>
                <tr>
                  <td data-label="Loại">Kỹ thuật</td>
                  <td data-label="Ví dụ">IP, user-agent, app version, crash logs</td>
                  <td data-label="Nguồn">Tự động khi dùng app</td>
                </tr>
                <tr>
                  <td data-label="Loại">Nghiệp vụ</td>
                  <td data-label="Ví dụ">Quyết định duyệt creative/email, timestamp</td>
                  <td data-label="Nguồn">Hành động trong app</td>
                </tr>
                <tr>
                  <td data-label="Loại">
                    <strong>Không</strong> thu
                  </td>
                  <td data-label="Ví dụ">Danh bạ, GPS liên tục, tin nhắn cá nhân</td>
                  <td data-label="Nguồn">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted">
            Ứng dụng mobile load nội dung từ <code>https://portal.pttads.vn</code> trong WebView bảo mật HTTPS.
          </p>
        </section>

        <section>
          <h2>3. Mục đích sử dụng</h2>
          <ul>
            <li>Xác thực và duy trì phiên đăng nhập</li>
            <li>Gửi thông báo &ldquo;cần duyệt&rdquo; creative / email campaign</li>
            <li>Hiển thị dashboard hiệu suất theo hợp đồng agency</li>
            <li>Cải thiện độ ổn định (crash analytics) và hỗ trợ kỹ thuật</li>
            <li>Tuân thủ nghĩa vụ pháp lý và audit nội bộ</li>
          </ul>
          <p>
            Chúng tôi <strong>không</strong> bán dữ liệu cá nhân cho bên thứ ba.
          </p>
        </section>

        <section>
          <h2>4. Chia sẻ dữ liệu</h2>
          <div className="privacy-table-wrap portal-table-stack">
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Bên nhận</th>
                  <th>Mục đích</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Bên nhận">Firebase Cloud Messaging / Apple Push Notification service</td>
                  <td data-label="Mục đích">Gửi push notification</td>
                </tr>
                <tr>
                  <td data-label="Bên nhận">Nhà cung cấp monitoring (nếu bật)</td>
                  <td data-label="Mục đích">Crash reporting</td>
                </tr>
                <tr>
                  <td data-label="Bên nhận">Nhà cung cấp hạ tầng (VPS, cloud)</td>
                  <td data-label="Mục đích">Hosting theo hợp đồng DPA</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted">Dữ liệu campaign thuộc tenant client — phân tách theo client trên hệ thống PTT.</p>
        </section>

        <section>
          <h2>5. Lưu trữ &amp; bảo mật</h2>
          <ul>
            <li>Dữ liệu lưu tại {DATA_REGION}</li>
            <li>Mã hóa truyền tải TLS 1.2+</li>
            <li>JWT phiên đăng nhập có thời hạn; mất thiết bị — liên hệ AM để hỗ trợ</li>
            <li>Push payload không chứa PII đầy đủ (theo chính sách nội bộ PTT)</li>
          </ul>
        </section>

        <section>
          <h2>6. Thời gian lưu</h2>
          <div className="privacy-table-wrap portal-table-stack">
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Dữ liệu</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Dữ liệu">Log audit duyệt</td>
                  <td data-label="Thời gian">Theo hợp đồng client (thường 12–24 tháng)</td>
                </tr>
                <tr>
                  <td data-label="Dữ liệu">Push device token</td>
                  <td data-label="Thời gian">Đến khi bạn tắt push hoặc gỡ app</td>
                </tr>
                <tr>
                  <td data-label="Dữ liệu">Crash logs</td>
                  <td data-label="Thời gian">90 ngày (điều chỉnh theo công cụ)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>7. Quyền của bạn</h2>
          <p>Theo quy định hiện hành, bạn có thể:</p>
          <ul>
            <li>Yêu cầu truy cập / chỉnh sửa thông tin tài khoản qua AM PTT</li>
            <li>Tắt push notification trong Settings app hoặc hệ điều hành</li>
            <li>Yêu cầu xóa device token (Settings → Tắt native push)</li>
            <li>
              Khiếu nại qua <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
            </li>
          </ul>
        </section>

        <section>
          <h2>8. Trẻ em</h2>
          <p>
            PTT Portal dành cho người dùng doanh nghiệp <strong>≥18 tuổi</strong> được cấp tài khoản bởi tổ chức khách
            hàng. Không hướng tới trẻ em.
          </p>
        </section>

        <section>
          <h2>9. Thay đổi chính sách</h2>
          <p>
            Chúng tôi có thể cập nhật chính sách; phiên bản mới đăng tại URL này với ngày hiệu lực. Bản nháp hiện tại
            chờ rà soát Legal (NĐ 13/2023/NĐ-CP) trước listing App Store / Play Store.
          </p>
        </section>
      </div>
    </PortalPublicShell>
  );
}
