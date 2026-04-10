import { useState, useEffect, useCallback } from 'react'

interface Prompt {
    id: number
    user_prompt: string
    model_response?: string
    platform: string
    language: string
    category: string
    timestamp: string
}

interface SearchResponse {
    results: Prompt[]
    total: number
    page: number
    totalPages: number
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

const Header = () => (
    <header className="header">
        <div className="container">
            <div className="ml-badge">FREE TOOL</div>
            <h1>AI Prompts Explorer</h1>
            <p className="subtitle">Search real user prompts from ChatGPT, Gemini & other AI chatbots to reverse-engineer intent.</p>

            <div className="stats-bar">
                <div className="stat-item">
                    <span className="stat-value">1M+</span>
                    <span className="stat-label">Conversations</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                    <span className="stat-value">100%</span>
                    <span className="stat-label">Real Users</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                    <span className="stat-value">AEO</span>
                    <span className="stat-label">Optimized</span>
                </div>
            </div>
        </div>
    </header>
)

const SearchSection = ({ onSearch }: { onSearch: (q: string) => void }) => {
    const [input, setInput] = useState('')

    const handleSubmit = () => {
        onSearch(input)
    }

    return (
        <section className="search-section">
            <div className="container">
                <div className="search-box">
                    <label className="input-label">SEARCH PROMPTS</label>
                    <div className="input-wrapper">
                        <input
                            id="search-input"
                            type="text"
                            placeholder="eg. marketing email"
                            value={input}
                            maxLength={200}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                        <button id="search-button" className="btn-primary" onClick={handleSubmit}>
                            Search Prompts <span className="arrow">→</span>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}

const Filters = ({ filters, setFilters }: { filters: any, setFilters: (f: any) => void }) => (
    <div className="filters-collapsible">
        <div className="filter-group">
            <label>Platform</label>
            <select id="filter-platform" value={filters.platform} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, platform: e.target.value })}>
                <option value="all">All Platforms</option>
                <option value="ChatGPT">ChatGPT</option>
                <option value="Gemini">Gemini</option>
                <option value="Claude">Claude</option>
            </select>
        </div>
        <div className="filter-group">
            <label>Language</label>
            <select id="filter-language" value={filters.language} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, language: e.target.value })}>
                <option value="all">All Languages</option>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
            </select>
        </div>
        <div className="filter-group">
            <label>Category</label>
            <select id="filter-category" value={filters.category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, category: e.target.value })}>
                <option value="all">All Categories</option>
                <option value="Writing">Writing</option>
                <option value="Coding">Coding</option>
                <option value="Research">Research</option>
                <option value="Business">Business</option>
                <option value="Education">Education</option>
                <option value="Creative">Creative</option>
                <option value="Personal">Personal</option>
                <option value="Technical">Technical</option>
                <option value="Other">Other</option>
            </select>
        </div>
    </div>
)

const LoadingSkeleton = () => (
    <div className="results-grid">
        {[1, 2, 3].map((i) => (
            <div key={i} className="prompt-card skeleton-card">
                <div className="card-header">
                    <span className="skeleton-tag"></span>
                    <span className="skeleton-tag"></span>
                </div>
                <div className="skeleton-line wide"></div>
                <div className="skeleton-line medium"></div>
                <div className="skeleton-line short"></div>
            </div>
        ))}
    </div>
)

const EmptyState = ({ isSearch }: { isSearch: boolean }) => (
    <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>{isSearch ? 'No results found' : 'Explore AI prompts'}</h3>
        <p>{isSearch ? 'Try a different search term or adjust your filters.' : 'Search for prompts or browse the trending conversations below.'}</p>
    </div>
)

const ErrorState = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
    <div className="error-state">
        <div className="error-icon">⚠️</div>
        <h3>Something went wrong</h3>
        <p>{message}</p>
        <button className="btn-secondary" onClick={onRetry}>Try Again</button>
    </div>
)

const PromptCard = ({ item, isExpanded, onToggle }: { item: Prompt, isExpanded: boolean, onToggle: () => void }) => {
    const [detail, setDetail] = useState<Prompt | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    const handleExpand = async () => {
        if (isExpanded) {
            onToggle()
            return
        }
        if (!detail) {
            setLoadingDetail(true)
            try {
                const res = await fetch(`${API_BASE}/api/prompts/${item.id}`)
                const data = await res.json()
                setDetail(data)
            } catch {
                // silently fail — card still shows prompt
            } finally {
                setLoadingDetail(false)
            }
        }
        onToggle()
    }

    const formatDate = (ts: string) => {
        try {
            return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        } catch {
            return ts
        }
    }

    return (
        <div className={`prompt-card ${isExpanded ? 'expanded' : ''}`}>
            <div className="card-header">
                <span className={`platform-tag platform-${item.platform?.toLowerCase()}`}>{item.platform}</span>
                <span className="category-tag">{item.category || 'General'}</span>
                <span className="date-tag">{formatDate(item.timestamp)}</span>
            </div>
            <p className={`prompt-text ${isExpanded ? 'prompt-text-full' : ''}`}>{item.user_prompt}</p>

            {isExpanded && (detail?.model_response) && (
                <div className="response-section">
                    <div className="response-label">AI Response</div>
                    <p className="response-text">{detail.model_response}</p>
                </div>
            )}

            {loadingDetail && (
                <div className="response-section">
                    <div className="skeleton-line wide"></div>
                    <div className="skeleton-line medium"></div>
                </div>
            )}

            <button className="btn-expand" onClick={handleExpand}>
                {isExpanded ? 'Collapse ↑' : 'Expand →'}
            </button>
        </div>
    )
}

const AEOInsights = ({ data, loading }: { data: any, loading: boolean }) => {
    if (loading) return <div className="loading-aeo">Analyzing Semantic Authority...</div>
    if (!data) return null

    return (
        <div className="aeo-insights">
            <div className="aeo-header">
                <span className="aeo-badge">GEO ANALYSIS</span>
                <h3>Target Semantic Authority</h3>
            </div>
            <div className="aeo-stats">
                <div className="aeo-stat">
                    <label>Semantic Variance</label>
                    <div className="aeo-value">{data.semanticVariance}</div>
                    <p className="aeo-hint">{data.insights.replace(/--/g, ',')}</p>
                </div>
                <div className="aeo-keywords">
                    <label>High-Density Entities</label>
                    <div className="aeo-keyword-list">
                        {data.keywords.map((k: any, i: number) => (
                            <span key={i} className="aeo-keyword-tag">
                                {k.word} <small>{Math.round(k.density * 100)}%</small>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function App() {
    const [query, setQuery] = useState('')
    const [activeQuery, setActiveQuery] = useState('')
    const [filters, setFilters] = useState({ platform: 'all', language: 'all', category: 'all' })
    const [results, setResults] = useState<Prompt[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [mode, setMode] = useState<'browse' | 'search'>('browse')
    const [aeoData, setAeoData] = useState<any>(null)
    const [aeoLoading, setAeoLoading] = useState(false)

    const buildFilterParams = useCallback(() => {
        const params = new URLSearchParams()
        if (filters.platform !== 'all') params.set('platform', filters.platform)
        if (filters.language !== 'all') params.set('language', filters.language)
        if (filters.category !== 'all') params.set('category', filters.category)
        return params
    }, [filters])

    // Browse / trending
    const fetchBrowse = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        setLoading(true)
        setError(null)
        setMode('browse')
        setAeoData(null)
        try {
            const params = buildFilterParams()
            params.set('page', pageNum.toString())
            params.set('limit', '25')
            const res = await fetch(`${API_BASE}/api/prompts?${params}`)
            if (!res.ok) throw new Error(`API error: ${res.status}`)
            const data: SearchResponse = await res.json()
            setResults(prev => append ? [...prev, ...data.results] : data.results)
            setTotal(data.total)
            setPage(pageNum)
        } catch (e: any) {
            setError(e.message || 'Failed to fetch prompts')
        } finally {
            setLoading(false)
        }
    }, [buildFilterParams])

    // Full-text search
    const fetchSearch = useCallback(async (searchQuery: string, pageNum: number = 1, append: boolean = false) => {
        if (!searchQuery.trim()) {
            setMode('browse')
            setActiveQuery('')
            fetchBrowse(1)
            return
        }
        setLoading(true)
        setError(null)
        setMode('search')
        setActiveQuery(searchQuery)

        // Fetch results
        try {
            const params = buildFilterParams()
            params.set('q', searchQuery)
            params.set('page', pageNum.toString())
            params.set('limit', '25')
            const res = await fetch(`${API_BASE}/api/prompts/search?${params}`)
            if (!res.ok) throw new Error(`API error: ${res.status}`)
            const data: SearchResponse = await res.json()
            setResults(prev => append ? [...prev, ...data.results] : data.results)
            setTotal(data.total)
            setPage(pageNum)

            // Fetch AEO insights on first page of search
            if (pageNum === 1) {
                setAeoLoading(true)
                const aeoRes = await fetch(`${API_BASE}/api/analytics/aeo?q=${encodeURIComponent(searchQuery)}`)
                if (aeoRes.ok) {
                    const aeoJson = await aeoRes.json()
                    setAeoData(aeoJson)
                }
                setAeoLoading(false)
            }
        } catch (e: any) {
            setError(e.message || 'Search failed')
        } finally {
            setLoading(false)
        }
    }, [buildFilterParams, fetchBrowse])

    // On mount: load trending
    useEffect(() => {
        fetchBrowse(1)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // When filters change: re-fetch
    useEffect(() => {
        if (mode === 'search' && activeQuery) {
            fetchSearch(activeQuery, 1)
        } else {
            fetchBrowse(1)
        }
    }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearch = (q: string) => {
        setQuery(q)
        fetchSearch(q, 1)
    }

    const handleLoadMore = () => {
        if (mode === 'search' && activeQuery) {
            fetchSearch(activeQuery, page + 1, true)
        } else {
            fetchBrowse(page + 1, true)
        }
    }

    const handleRetry = () => {
        if (mode === 'search' && activeQuery) {
            fetchSearch(activeQuery, 1)
        } else {
            fetchBrowse(1)
        }
    }

    return (
        <div className="app">
            <Header />
            <SearchSection onSearch={handleSearch} />

            <main className="container">
                <Filters filters={filters} setFilters={setFilters} />

                {mode === 'search' && activeQuery && (
                    <AEOInsights data={aeoData} loading={aeoLoading} />
                )}

                {mode === 'browse' && !loading && !error && results.length > 0 && (
                    <div className="section-label">
                        <span className="section-label-icon">🔥</span> Trending Prompts
                    </div>
                )}

                {total > 0 && (
                    <div className="results-header">
                        Showing {results.length} of {total.toLocaleString()} results
                        {mode === 'search' && activeQuery && <span className="search-query-label"> for "{activeQuery}"</span>}
                    </div>
                )}

                {error && <ErrorState message={error} onRetry={handleRetry} />}

                {loading && results.length === 0 && <LoadingSkeleton />}

                {!loading && !error && results.length === 0 && (
                    <EmptyState isSearch={mode === 'search'} />
                )}

                <div className="results-grid">
                    {results.map((item, index) => (
                        <div key={item.id} style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}>
                            <PromptCard
                                item={item}
                                isExpanded={expandedId === item.id}
                                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            />
                        </div>
                    ))}
                </div>

                {results.length < total && (
                    <div className="pagination-container">
                        <button
                            className="btn-secondary"
                            onClick={handleLoadMore}
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Load More Prompts ↓'}
                        </button>
                    </div>
                )}
            </main>

            <footer className="footer">
                <div className="container">
                    <p>Powered by <a href="https://maximuslabs.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ml-accent-blue)', fontWeight: 700, textDecoration: 'none' }}>MaximusLabs AI</a>, Leading Generative Engine Optimization (GEO)</p>
                </div>
            </footer>
        </div>
    )
}

export default App
