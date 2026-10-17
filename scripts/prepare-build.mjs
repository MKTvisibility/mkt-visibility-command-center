import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
mkdirSync('public/setup', { recursive: true })
const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()
writeFileSync('public/setup/database.sql', migrations.map(name => readFileSync(`supabase/migrations/${name}`, 'utf8')).join('\n'))
copyFileSync('supabase/members.example.sql', 'public/setup/members.sql')
copyFileSync('docs/SETUP.md', 'public/setup/README.md')

mkdirSync('public/live', {recursive:true})
copyFileSync('src/lib/live-profile-view.mjs','public/live/profile-view.mjs')
copyFileSync('src/live-profile.css','public/live/business-profile.css')

copyFileSync('src/lib/business-events.mjs','public/live/business-events.mjs')
copyFileSync('src/lib/business-events-loader.mjs','public/live/business-events-loader.mjs')
copyFileSync('src/business-events.css','public/live/business-events.css')


copyFileSync('src/lib/home-stories.mjs','public/live/home-stories.mjs')
copyFileSync('src/home-stories.css','public/live/home-stories.css')
