# LMP Arm v2 — Talk track + offer ladder (S-LMP-3)

Return JSON with:
- talk_track { framework: SPIN|Challenger, total_minutes, phases[] }
- objection_playbook[] (3-7 items)
- stakeholder_hints[]
- offer_ladder[] (use seed ladder; exactly one anchor_role=recommended on TC)

Keep consulting_script compatible; SPIN phases >= 3.
