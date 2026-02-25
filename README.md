# 🍕 Jeckyllopes Run Club — Pizza Sign-Up

## Deploy in ~10 minutes

---

### STEP 1 — Set up Supabase (free database)

1. Go to **https://supabase.com** → click **Start your project** → sign in with GitHub
2. Click **New project**, give it a name like `jeckyllopes`, set a password, hit **Create**
3. Wait ~1 minute for it to spin up
4. Go to **SQL Editor** (left sidebar) → **New Query**
5. Copy everything from `supabase-setup.sql` and paste it → click **Run**
6. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string under "Project API keys")

---

### STEP 2 — Put the code on GitHub

1. Go to **https://github.com/new** and create a new **public** repo called `jeckyllopes-pizza`
2. On your computer, open a terminal in this folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/jeckyllopes-pizza.git
   git push -u origin main
   ```

---

### STEP 3 — Deploy to Vercel (free hosting)

1. Go to **https://vercel.com** → sign in with GitHub
2. Click **Add New → Project** → import your `jeckyllopes-pizza` repo
3. Before clicking Deploy, click **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Project URL from Step 1
   - `VITE_SUPABASE_ANON_KEY` → your anon key from Step 1
4. Click **Deploy** — done! 🎉

Vercel gives you a free URL like `jeckyllopes-pizza.vercel.app` you can share with the club.

---

### Local development

```bash
cp .env.example .env
# Fill in your Supabase values in .env

npm install
npm run dev
```
