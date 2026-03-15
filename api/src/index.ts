import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
  CACHE_KV: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

// Rate Limiting Middleware (Safe for local dev)
const rateLimiter = async (c: any, next: any) => {
  if (!c.env.CACHE_KV) {
    return await next()
  }
  const ip = c.req.header('CF-Connecting-IP') || 'anonymous'
  const key = `rate_limit:${ip}`
  try {
    const count = await c.env.CACHE_KV.get(key)
    const current = count ? parseInt(count) : 0
    if (current >= 30) {
      return c.json({ error: 'Too many requests. Please try again in an hour.' }, 429)
    }
    await c.env.CACHE_KV.put(key, (current + 1).toString(), { expirationTtl: 3600 })
  } catch (e) {
    console.warn('Rate Limiter failed:', e)
  }
  await next()
}

// Enable CORS with more standard configuration
app.use('*', cors({
  origin: (origin) => {
    if (!origin || origin === 'http://localhost:5173' || origin === 'http://localhost:8787') {
      return origin
    }
    return '*'
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}))

// Logging middleware
app.use('*', async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`)
  await next()
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

// Helper for caching
async function getCachedResponse(c: any, key: string) {
  const cached = await c.env.CACHE_KV.get(key)
  if (cached) {
    return JSON.parse(cached)
  }
  return null
}

async function setCachedResponse(c: any, key: string, data: any, ttlSeconds = 900) {
  await c.env.CACHE_KV.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds })
}

app.get('/', (c) => {
  return c.text('AI Prompts Explorer API - High Performance Edition')
})

// Browse / trending
app.get('/api/prompts', rateLimiter, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '25')))
  const platform = c.req.query('platform') || 'all'
  const language = c.req.query('language') || 'all'
  const category = c.req.query('category') || 'all'
  const cacheKey = `prompts:${platform}:${language}:${category}:${page}:${limit}`

  const cached = await getCachedResponse(c, cacheKey)
  if (cached) return c.json(cached)

  const offset = (page - 1) * limit
  let whereClauses: string[] = []
  const params: any[] = []

  if (platform !== 'all') { whereClauses.push('platform = ?'); params.push(platform); }
  if (language !== 'all') { whereClauses.push('language = ?'); params.push(language); }
  if (category !== 'all') { whereClauses.push('category = ?'); params.push(category); }

  const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''
  const countRes = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM conversations ${whereStr}`).bind(...params).first<{ total: number }>()
  const total = countRes?.total || 0

  const sql = `SELECT id, user_prompt, platform, language, category, timestamp FROM conversations ${whereStr} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  const { results } = await c.env.DB.prepare(sql).bind(...params, limit, offset).all()

  const response = { results, total, page, totalPages: Math.ceil(total / limit) }
  await setCachedResponse(c, cacheKey, response)
  return c.json(response)
})

// Full-text search with BM25 ranking and caching
app.get('/api/prompts/search', rateLimiter, async (c) => {
  const query = c.req.query('q')
  if (!query) return c.json({ results: [], total: 0, page: 1, totalPages: 0 })

  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '25')))
  const platform = c.req.query('platform') || 'all'
  const language = c.req.query('language') || 'all'
  const category = c.req.query('category') || 'all'
  const cacheKey = `search:${query}:${platform}:${language}:${category}:${page}:${limit}`

  const cached = await getCachedResponse(c, cacheKey)
  if (cached) return c.json(cached)

  const offset = (page - 1) * limit

  // High performance FTS5 query
  let sql = `
    SELECT c.id, c.user_prompt, c.platform, c.language, c.category, c.timestamp, rank
    FROM conversations c
    JOIN prompts_fts f ON c.id = f.rowid
    WHERE f.user_prompt MATCH ?
  `
  const params: any[] = [query]

  if (platform !== 'all') { sql += ' AND c.platform = ?'; params.push(platform); }
  if (language !== 'all') { sql += ' AND c.language = ?'; params.push(language); }
  if (category !== 'all') { sql += ' AND c.category = ?'; params.push(category); }

  // Count total
  const countSql = `SELECT COUNT(*) as total FROM (${sql})`
  const countRes = await c.env.DB.prepare(countSql).bind(...params).first<{ total: number }>()
  const total = countRes?.total || 0

  // Final results
  try {
    sql += ' ORDER BY rank LIMIT ? OFFSET ?'
    const { results } = await c.env.DB.prepare(sql).bind(...params, limit, offset).all()

    const response = { results, total, page, totalPages: Math.ceil(total / limit) }
    await setCachedResponse(c, cacheKey, response, 3600) // Cache searches for 1 hour
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

  // Fetch top 50 prompts for analysis (reduced from 100 for better performance)
  const sql = `
    SELECT user_prompt 
    FROM conversations c
    JOIN prompts_fts f ON c.id = f.rowid
    WHERE f.user_prompt MATCH ?
    LIMIT 50
  `
  try {
    const { results } = await c.env.DB.prepare(sql).bind(query).all<{ user_prompt: string }>()

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
      .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count, density: (count / results.length).toFixed(2) }))

    // 2. Semantic Variance (Simplified: Lexical Diversity)
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
    console.error('AEO Analysis error:', e)
    return c.json({ error: 'Failed to analyze prompts', keywords: [], semanticVariance: "0" }, 500)
  }
})

app.get('/api/prompts/:id', rateLimiter, async (c) => {
  const id = c.req.param('id')
  const result = await c.env.DB.prepare(
    'SELECT id, user_prompt, model_response, platform, language, category, timestamp FROM conversations WHERE id = ?'
  ).bind(id).first()

  return result ? c.json(result) : c.json({ error: 'Not found' }, 404)
})

export default app
