# EmulatorJS + Supabase

A personal, self-hosted EmulatorJS library with Supabase-backed ROMs, battery saves, and save states.

## Features

- Email/password authentication with Supabase Auth
- Upload your own ROMs from the browser
- ROMs stored in a private Supabase Storage bucket
- EmulatorJS 4.2.3
- Battery/native saves automatically synced to Supabase
- Save states automatically synced to Supabase
- Multiple save-state slots
- Cloud restore when launching a game
- Per-user Row Level Security
- No Supabase service-role key in the frontend

## 1. Configure Supabase

Open the Supabase SQL Editor and run:

```sql
-- Paste the contents of supabase/schema.sql
```

The SQL creates the `games` table, storage buckets, and RLS policies.

## 2. Run locally

This is a static site, so any static web server works. For example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Do not use `file://`; EmulatorJS needs to run from a web server.

## 3. Create an account

Use the Sign Up form. If your Supabase project requires email confirmation, confirm the email before signing in.

## 4. Upload a ROM

Select the system, choose your ROM, and upload it. The app stores the ROM under your authenticated user's folder in the private `roms` bucket.

Supported systems in the UI currently include NES, SNES, Game Boy, Game Boy Color, Game Boy Advance, Genesis/Mega Drive, Master System, Game Gear, Atari 2600, and PlayStation.

## 5. Saves

EmulatorJS exposes save hooks that this project uses:

- `EJS_onSaveSave` / `EJS_onLoadSave` for native battery saves
- `EJS_onSaveState` / `EJS_onLoadState` for save states

The project uploads those binary buffers to private Supabase Storage. EmulatorJS also exposes the game manager's state/save buffers, which lets the app restore cloud data after the emulator starts.

## Security

The browser only uses the Supabase publishable key. That key is intended for frontend use. The database and storage policies are what protect users' files. **Never put a Supabase secret/service-role key in this repository.**

## Legal

Only upload ROMs and BIOS files that you are legally allowed to possess/use.
