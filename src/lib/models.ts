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

const MODALITIES = ['text', 'image', 'audio', 'video', 'file']

function fail(message: string): never {
  throw new Error(`src/data/models.md: ${message}`)
}

function requireText(value: unknown, where: string) {
  if (typeof value !== 'string' || !value.trim()) fail(`${where} must be non-empty text`)
}

function requireModalities(value: unknown, where: string) {
  const valid = Array.isArray(value) && value.length > 0 && value.every((item) => MODALITIES.includes(item))
  if (!valid) fail(`${where} must list one or more of ${MODALITIES.join(', ')}`)
}

// A broken data block fails the build, so a bad edit never reaches the site.
export function parseModelsGuide(markdown: string): ModelsGuide {
  const heading = markdown.indexOf('\n## Data')
  const block = heading < 0 ? null : /```json\n([\s\S]*?)\n```/.exec(markdown.slice(heading))
  if (!block) fail('no json block under "## Data"')
  const data = JSON.parse(block[1]) as ModelsGuide
  for (const key of ['categories', 'recommendations', 'models'] as const) {
    if (!Array.isArray(data[key])) fail(`"${key}" must be an array`)
  }
  if (typeof data.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) {
    fail('"updated" must be a YYYY-MM-DD date')
  }

  const ids = new Set<string>()
  data.categories.forEach((category, index) => {
    const where = `categories[${index}]`
    for (const field of ['id', 'label', 'description'] as const) requireText(category?.[field], `${where}.${field}`)
    if (ids.has(category.id)) fail(`category "${category.id}" is listed twice`)
    ids.add(category.id)
  })

  const used = new Set<string>()
  data.recommendations.forEach((pick, index) => {
    const where = `recommendations[${index}]`
    for (const field of ['category', 'name', 'provider', 'model', 'price', 'why'] as const) {
      requireText(pick?.[field], `${where}.${field}`)
    }
    if (!ids.has(pick.category)) fail(`unknown category "${pick.category}"`)
    if (used.has(pick.category)) fail(`"${pick.category}" has two recommendations`)
    used.add(pick.category)
    requireModalities(pick.modalities?.input, `${where}.modalities.input`)
    requireModalities(pick.modalities?.output, `${where}.modalities.output`)
    if (typeof pick.openWeights !== 'boolean') fail(`${where}.openWeights must be true or false`)
    if (!Array.isArray(pick.alternatives)) fail(`${where}.alternatives must be an array`)
    pick.alternatives.forEach((alternative, position) => {
      for (const field of ['name', 'provider', 'model', 'price', 'note'] as const) {
        requireText(alternative?.[field], `${where}.alternatives[${position}].${field}`)
      }
    })
  })

  data.models.forEach((model, index) => {
    requireText(model?.name, `models[${index}].name`)
    requireText(model?.price, `models[${index}].price`)
  })
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
