import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

export async function getStaticPaths() {
  const docs = await getCollection('docs')
  return docs.map(doc => ({
    params: { slug: doc.id },
    props: { content: doc.body }
  }))
}

export const GET: APIRoute = async ({ props }) => {
  const content = (props as { content?: string }).content

  if (!content) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  return new Response(content, {
    status: 200,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
}
