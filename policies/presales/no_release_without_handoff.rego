# WIN-4-C / R3-D — Solution release requires completed handoff path.
# Evaluated in Nest PolicyService (TypeScript mirror); rego is source-of-truth doc.

package presales

default allow = false

allow {
  input.action == "release"
  input.handoff_status == "with_solution"
  input.has_handoff_activity == true
  input.consult_complete == true
  input.preliminary_plan_ok == true
}

deny_reason = "presales.no_release_without_handoff" {
  not allow
  input.action == "release"
}
