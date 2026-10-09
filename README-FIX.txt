UNION TMS — Build Fix Package
=============================

1. Copy lib/supabase/server.ts  →  your-project/lib/supabase/server.ts  (overwrite)

2. Copy app/auth/confirm/route.ts → your-project/app/auth/confirm/route.ts  (overwrite)

3. Add to package.json dependencies:
     "@supabase/ssr": "^0.6.1"
   Then run:
     npm install

4. DELETE these unused starter folders (they cause missing-component errors):
     rm -rf app/protected
     rm -rf app/auth/login
     rm -rf app/auth/sign-up
     rm -rf app/auth/sign-up-success
     rm -rf app/auth/forgot-password
     rm -rf app/auth/update-password
     rm -rf app/auth/error

5. Set Vercel env vars:
     NEXT_PUBLIC_SUPABASE_URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY
     SUPABASE_SERVICE_ROLE_KEY

6. Commit & push:
     git add -A
     git commit -m "Fix createClient + remove starter pages"
     git push origin main
