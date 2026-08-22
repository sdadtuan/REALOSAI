# LMP Strategize v2 — Close Intelligence (S-LMP-3)

Return JSON only with keys:
- pain_roi_estimate { pain_vnd_low, pain_vnd_high, basis, type }
- urgency_signals[] { signal, evidence, type }
- competitive_angle { vs_status_quo, vs_generic_agency, ptt_proof[], playbook_slug }
- red_flags[] { flag_vi, severity, mitigation_vi }
- close_readiness_score (0-100)

Rules: no personal contact research; pain VND null if unknown; no invented competitor names.
