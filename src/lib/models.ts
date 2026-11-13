// Reads the data block of the models guide (src/data/models.md) for the
// Recommended Models page. The guide is the single source: the page, the raw
// Markdown at /models.md, and `agents current-models` all show the same data.

export interface ModelCategory {
  id: string
  label: string
  description: string
}

export interface ModelAlternative {
  name: string
  provider: string
  model: string
  price: string
  note: string
}

export interface ModelRecommendation {
  category: string
  name: string
  provider: string
  model: string
  price: string
  modalities: { input: string[]; output: string[] }
  openWeights: boolean
  why: string
  alternatives: ModelAlternative[]
}

export interface CatalogModel {
  name: string
  bestFor?: string
  price: string
  summary?: string
}

export interface ModelsGuide {
  updated: string
  categories: ModelCategory[]
  recommendations: ModelRecommendation[]
  models: CatalogModel[]
}

// Provider ids as the guide writes them, and how the page shows them.
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  cerebras: 'Cerebras',
  cloudflare: 'Cloudflare Workers AI',
  deepinfra: 'DeepInfra',
  google: 'Google',
  groq: 'Groq',
  novita: 'Novita',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  xai: 'xAI',
}

export function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id
}

// A broken data block fails the build, so a bad edit never reaches the site.
export function parseModelsGuide(markdown: string): ModelsGuide {
  const heading = markdown.indexOf('\n## Data')
  const block = heading < 0 ? null : /```json\n([\s\S]*?)\n```/.exec(markdown.slice(heading))
  if (!block) throw new Error('src/data/models.md has no json block under "## Data"')
  const data = JSON.parse(block[1]) as ModelsGuide
  for (const key of ['categories', 'recommendations', 'models'] as const) {
    if (!Array.isArray(data[key])) throw new Error(`src/data/models.md: "${key}" must be an array`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.updated ?? '')) {
    throw new Error('src/data/models.md: "updated" must be a YYYY-MM-DD date')
  }
  const ids = new Set(data.categories.map((category) => category.id))
  const used = new Set<string>()
  for (const pick of data.recommendations) {
    if (!ids.has(pick.category)) throw new Error(`src/data/models.md: unknown category "${pick.category}"`)
    if (used.has(pick.category)) throw new Error(`src/data/models.md: "${pick.category}" has two recommendations`)
    used.add(pick.category)
  }
  return data
}

export function formatUpdated(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
