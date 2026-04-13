import type { APIRoute } from 'astro'
import modelsContent from '../data/models.md?raw'

export const GET: APIRoute = async () => {
  return new Response(modelsContent, {
    status: 200,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
}
