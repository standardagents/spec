import type { APIRoute } from 'astro'
import { getLatestVersion, getNavigation } from '../lib/content'

const BASE_URL = 'https://standardagentspec.com'

export const GET: APIRoute = async () => {
  const latestVersion = await getLatestVersion()
  const navigation = await getNavigation(latestVersion)

  const lines: string[] = [
    'Standard Agent Specification',
    `Latest version: ${latestVersion}`,
    '',
    'This file lists the latest-version documentation as raw markdown links.',
    '',
    `Current models guide: ${BASE_URL}/models.md`,
    '',
    'Documentation:',
  ]

  for (const group of navigation) {
    lines.push('')
    lines.push(`${group.title}:`)

    for (const item of group.items) {
      lines.push(`- ${item.title}: ${BASE_URL}${item.href}.md`)
      if (item.children) {
        for (const child of item.children) {
          lines.push(`  - ${child.title}: ${BASE_URL}${child.href}.md`)
        }
      }
    }
  }

  return new Response(`${lines.join('\n')}\n`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
