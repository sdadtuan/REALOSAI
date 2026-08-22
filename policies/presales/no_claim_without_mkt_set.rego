# WIN-4-C / R3-D — Solution claim requires MKT job function or permission set.

package presales

mkt_functions[f] {
  f := input.job_functions[_]
  f == "content"
}

mkt_functions[f] {
  f := input.job_functions[_]
  f == "design"
}

mkt_functions[f] {
  f := input.job_functions[_]
  f == "technical"
}

mkt_set {
  re_match("(?i)(mkt|solution|content|marketing)", input.permission_sets[_])
}

default allow = false

allow {
  input.action == "claim"
  input.gdkd_assign == true
}

allow {
  input.action == "claim"
  count(mkt_functions) > 0
}

allow {
  input.action == "claim"
  mkt_set
}

deny_reason = "presales.no_claim_without_mkt_set" {
  not allow
  input.action == "claim"
}
