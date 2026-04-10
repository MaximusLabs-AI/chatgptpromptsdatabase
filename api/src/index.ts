import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Database Setup ---
const dbPath = path.join(__dirname, '..', 'data', 'prompts.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// --- In-Memory Cache ---
const cache = new Map<string, { data: any; expiry: number }>()

function getCached(key: string): any | null {
    const entry = cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
        cache.delete(key)
        return null
    }
    return entry.data
}

function setCache(key: string, data: any, ttlSeconds = 900) {
    cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 })
}

// Clean expired cache entries every 10 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache) {
        if (now > entry.expiry) cache.delete(key)
    }
}, 10 * 60 * 1000)

// --- In-Memory Rate Limiter ---
const rateLimits = new Map<string, { count: number; resetAt: number }>()

const rateLimiter = async (c: any, next: any) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous'
    const now = Date.now()
    const entry = rateLimits.get(ip)

    if (entry && now < entry.resetAt) {
        if (entry.count >= 60) {
            return c.json({ error: 'Too many requests. Please try again later.' }, 429)
        }
        entry.count++
    } else {
        rateLimits.set(ip, { count: 1, resetAt: now + 3600 * 1000 })
    }
    await next()
}

// Clean rate limit entries every 30 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimits) {
        if (now > entry.resetAt) rateLimits.delete(key)
    }
}, 30 * 60 * 1000)

// --- Hono App ---
const app = new Hono()

// CORS
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
}))

// Logging
app.use('*', async (c, next) => {
    console.log(`[${c.req.method}] ${c.req.url}`)
    await next()
})

// Error handler
app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

// --- Routes ---

app.get('/', (c) => {
    return c.text('AI Prompts Explorer API - Node.js Edition')
})

// Browse / trending
app.get('/api/prompts', rateLimiter, async (c) => {
    const page = Math.max(1, parseInt(c.req.query('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '25')))
    const platform = c.req.query('platform') || 'all'
    const language = c.req.query('language') || 'all'
    const category = c.req.query('category') || 'all'
    const cacheKey = `prompts:${platform}:${language}:${category}:${page}:${limit}`

    const cached = getCached(cacheKey)
    if (cached) return c.json(cached)

    const offset = (page - 1) * limit
    const whereClauses: string[] = []
    const params: any[] = []

    if (platform !== 'all') { whereClauses.push('platform = ?'); params.push(platform) }
    if (language !== 'all') { whereClauses.push('language = ?'); params.push(language) }
    if (category !== 'all') { whereClauses.push('category = ?'); params.push(category) }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM conversations ${whereStr}`).get(...params) as { total: number }
    const total = countRow?.total || 0

    const sql = `SELECT id, user_prompt, platform, language, category, timestamp FROM conversations ${whereStr} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    const results = db.prepare(sql).all(...params, limit, offset)

    const response = { results, total, page, totalPages: Math.ceil(total / limit) }
    setCache(cacheKey, response)
    return c.json(response)
})

// Full-text search with BM25 ranking
app.get('/api/prompts/search', rateLimiter, async (c) => {
    const query = c.req.query('q')
    if (!query) return c.json({ results: [], total: 0, page: 1, totalPages: 0 })

    const page = Math.max(1, parseInt(c.req.query('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '25')))
    const platform = c.req.query('platform') || 'all'
    const language = c.req.query('language') || 'all'
    const category = c.req.query('category') || 'all'
    const cacheKey = `search:${query}:${platform}:${language}:${category}:${page}:${limit}`

    const cached = getCached(cacheKey)
    if (cached) return c.json(cached)

    const offset = (page - 1) * limit

    let sql = `
        SELECT c.id, c.user_prompt, c.platform, c.language, c.category, c.timestamp, rank
        FROM conversations c
        JOIN prompts_fts f ON c.id = f.rowid
        WHERE f.user_prompt MATCH ?
    `
    const params: any[] = [query]

    if (platform !== 'all') { sql += ' AND c.platform = ?'; params.push(platform) }
    if (language !== 'all') { sql += ' AND c.language = ?'; params.push(language) }
    if (category !== 'all') { sql += ' AND c.category = ?'; params.push(category) }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`
    const countRow = db.prepare(countSql).get(...params) as { total: number }
    const total = countRow?.total || 0

    try {
        const finalSql = sql + ' ORDER BY rank LIMIT ? OFFSET ?'
        const results = db.prepare(finalSql).all(...params, limit, offset)

        const response = { results, total, page, totalPages: Math.ceil(total / limit) }
        setCache(cacheKey, response, 3600)
        return c.json(response)
    } catch (e: any) {
        console.error('Search error:', e)
        return c.json({ error: 'Invalid search query or server error', results: [], total: 0 }, 500)
    }
})

// Advanced Analytics: AEO Insights
app.get('/api/analytics/aeo', rateLimiter, async (c) => {
    const query = c.req.query('q')
    if (!query) return c.json({ error: 'Search query required for AEO analysis' }, 400)

    const sql = `
        SELECT c.user_prompt
        FROM conversations c
        JOIN prompts_fts f ON c.id = f.rowid
        WHERE f.user_prompt MATCH ?
        LIMIT 50
    `
    try {
        const results = db.prepare(sql).all(query) as { user_prompt: string }[]

        if (!results.length) return c.json({ keywords: [], variance: 0 })

        // 1. Keyword Density Analysis
        const wordCounts: Record<string, number> = {}
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'for', 'in', 'of', 'on', 'at', 'with', 'how', 'what', 'can', 'you', 'i', 'my'])

        results.forEach(r => {
            const words = r.user_prompt.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
            words.forEach(word => {
                if (word.length > 3 && !stopWords.has(word)) {
                    wordCounts[word] = (wordCounts[word] || 0) + 1
                }
            })
        })

        const topKeywords = Object.entries(wordCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([word, count]) => ({ word, count, density: (count / results.length).toFixed(2) }))

        // 2. Semantic Variance (Lexical Diversity)
        const allWords = results.flatMap(r => r.user_prompt.toLowerCase().split(/\s+/))
        const uniqueWords = new Set(allWords)
        const variance = results.length > 1 ? uniqueWords.size / allWords.length : 0

        return c.json({
            query,
            sampleSize: results.length,
            keywords: topKeywords,
            semanticVariance: variance.toFixed(4),
            insights: variance > 0.5 ? "High diversity in phrasing. Focus on semantic breadth." : "Low diversity. Specific keywords are dominant."
        })
    } catch (e: any) {
        console.error('AEO Analysis error:', e.message, e.stack)
        return c.json({ error: e.message || 'Failed to analyze prompts', keywords: [], semanticVariance: "0" }, 500)
    }
})

// Get single prompt
app.get('/api/prompts/:id', rateLimiter, async (c) => {
    const id = c.req.param('id')
    const result = db.prepare(
        'SELECT id, user_prompt, model_response, platform, language, category, timestamp FROM conversations WHERE id = ?'
    ).get(id)

    return result ? c.json(result) : c.json({ error: 'Not found' }, 404)
})

// --- Start Server ---
const port = parseInt(process.env.PORT || '3000')
console.log(`🚀 AI Prompts Explorer API running on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
