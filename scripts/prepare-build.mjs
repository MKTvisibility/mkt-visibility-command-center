import { copyFileSync, mkdirSync } from 'node:fs'
mkdirSync('public/setup', { recursive: true })
copyFileSync('supabase/migrations/202610110001_command_center.sql', 'public/setup/database.sql')
copyFileSync('supabase/members.example.sql', 'public/setup/members.sql')
copyFileSync('docs/SETUP.md', 'public/setup/README.md')
