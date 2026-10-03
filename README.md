# LST Dashboard v0.3

Mobile-first Liberty State Troopers dashboard connected to the separate LST Supabase project.

Included now:
- Supabase email/password sign-in
- Trooper account registration with display name
- Personnel profile
- Clock in/out
- Arrest Report, Citation, Scene Log submission
- Training and Leave requests
- Command-only pending report view
- Secure Approve / Return / Reject RPC calls
- Automatic case number returned on approval
- Dark navy / blue / gold visual direction

Important:
- The Supabase publishable key is intentionally client-side. Never add a secret/service-role key to this site.
- Duty status buttons now call the secured set_my_duty_status RPC and persist to Supabase.
- Do not deploy this to the Money Clicker Netlify project.

Files:
- index.html
- styles.css
- app.js
