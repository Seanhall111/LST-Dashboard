# LST Dashboard v0.4 — Command Center Update

Adds a mobile Command Center with:
- Pending report review
- Personnel directory
- Callsign editing via secure RPC
- Rank/division editing via secure RPC
- Recent shift history
- Request queue
- Audit log

Existing v0.3 patrol, clock, authentication, report and case-number workflows remain intact.

Before publishing v0.4, grant Command read access to audit_log and ensure the existing Command RLS policies and RPCs are installed. Never put a secret/service-role key in this frontend.

- v0.4.1 adds Command Approve / Reject controls for pending Training and Leave requests.

- v0.4.2 moves Clock Out to the secured `clock_out()` Supabase RPC.
- The frontend no longer directly updates shift rows when clocking out.

- v0.4.3 adds Command personnel controls for permission level and account status.
- Uses secured `set_permission` and `set_account_status` RPCs.
- Adds warnings before changing the signed-in administrator's own access.

- v0.4.4 fixes Personnel permission/account-status controls not rendering.
- Personnel controls are now constructed without nested template literals for better mobile/browser compatibility.
