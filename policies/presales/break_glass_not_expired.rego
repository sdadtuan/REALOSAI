# WIN-4-C / R3-D — Break-glass cap union denied when grant expired (>24h TTL).

package rbac

default allow = true

allow = false {
  input.action == "break_glass_union"
  input.break_glass_active == true
  input.break_glass_expired == true
}

deny_reason = "rbac.break_glass_not_expired" {
  not allow
  input.action == "break_glass_union"
}
