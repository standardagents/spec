import type { APIRoute } from 'astro'
import { getNavigation, getVersions } from '../../../lib/content'

export async function getStaticPaths() {
  const versions = await getVersions()
  return versions.map(version => ({ params: { version } }))
}

export const GET: APIRoute = async ({ params }) => {
  const { version } = params
  if (!version) {
    return new Response(JSON.stringify([]), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const navigation = await getNavigation(version)

  return new Response(JSON.stringify(navigation), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
