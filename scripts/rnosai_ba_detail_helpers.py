"""Helper builders for RNOSAI BA use-case detail blocks."""
from __future__ import annotations


def uc_detail(
    uc_id: str,
    name: str,
    *,
    screens: str,
    actor: str,
    actor_secondary: str = "",
    goal: str = "",
    trigger: str = "",
    pre: str = "",
    post: str = "",
    priority: str = "P0",
    wave: str = "Wave R1",
    trace: str = "—",
    api: str = "",
    main: list[list],
    alt: list[list] | None = None,
    io_in: str = "",
    io_out: str = "",
    rules: list[str],
) -> dict:
    meta: list[tuple[str, str]] = [
        ("Mã use case", uc_id),
        ("Tên use case", name),
        ("Màn hình", screens),
        ("Actor chính", actor),
    ]
    if actor_secondary:
        meta.append(("Actor phụ", actor_secondary))
    meta.extend([
        ("Mục tiêu", goal or name),
        ("Trigger", trigger or f"Khởi phát luồng «{name}»"),
        ("Pre-condition", pre or "Quyền và dữ liệu đầu vào hợp lệ"),
        ("Post-condition", post or "Trạng thái nghiệp vụ cập nhật và audit"),
        ("Ưu tiên", priority),
        ("Sprint/Wave", wave),
        ("Trace ref", trace),
    ])
    if api:
        meta.append(("API / Integration", api))
    return {
        "meta": meta,
        "main_flow": main,
        "alt_flow": alt
        or [
            ["E1", "Thiếu quyền → HTTP 403"],
            ["E2", "Validate fail → message + không persist"],
        ],
        "io": [
            ["Input", io_in or f"Payload {uc_id}"],
            ["Output", io_out or f"Kết quả {uc_id}"],
        ],
        "rules": rules,
        "_manual": True,
    }


def scr_detail(
    scr_id: str,
    name: str,
    *,
    route: str,
    module: str,
    purpose: str,
    roles: str,
    linked_ucs: str,
    ui: list[list],
    rules: list[str],
    pre: str = "",
    post: str = "",
    api: str = "",
    app: str = "ops-web (rs.pttads.vn)",
    trace: str = "—",
    status_note: str = "Done",
    notes: str = "",
) -> dict:
    meta: list[tuple[str, str]] = [
        ("Mã màn hình", scr_id),
        ("Tên màn hình", name),
        ("Route", route),
        ("Module", module),
        ("Ứng dụng", app),
        ("Mục đích", purpose),
        ("Vai trò", roles),
        ("Điều kiện trước", pre or f"Đăng nhập {app} + RBAC cap"),
        ("Điều kiện sau", post or "API phản ánh đúng trạng thái nghiệp vụ"),
        ("Use case liên quan", linked_ucs),
    ]
    if api:
        meta.append(("API liên quan", api))
    meta.extend([
        ("Parity / RNOS", trace),
        ("Trạng thái triển khai", status_note),
        ("Ghi chú", notes or "—"),
    ])
    return {
        "meta": meta,
        "ui": ui,
        "rules": rules,
        "_manual": True,
        "_deep": True,
    }
