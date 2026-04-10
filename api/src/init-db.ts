import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
const dbPath = path.join(dataDir, 'prompts.db')

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    console.log('📁 Created data/ directory')
}

// Remove old DB if it exists (fresh init)
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
    console.log('🗑️  Removed old database')
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// Run schema
const schemaPath = path.join(__dirname, '..', 'schema.sql')
const schema = fs.readFileSync(schemaPath, 'utf-8')
db.exec(schema)
console.log('✅ Schema created (tables, FTS5 index, triggers)')

// Run seed data
const seedPath = path.join(__dirname, '..', 'seed.sql')
const seed = fs.readFileSync(seedPath, 'utf-8')
db.exec(seed)
console.log('✅ Seed data inserted')

// Verify
const count = db.prepare('SELECT COUNT(*) as total FROM conversations').get() as { total: number }
console.log(`\n🎉 Database initialized with ${count.total} conversations`)
console.log(`📍 Database location: ${dbPath}`)

db.close()
