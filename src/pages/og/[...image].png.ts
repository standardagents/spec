import type { APIRoute, GetStaticPaths } from 'astro'
import { getShareImages, type ShareImage } from '../../lib/share-images'
import { renderShareImage } from '../../lib/share-image-render'

// The share image of each page, at /og/{page path}.png. BaseLayout.astro names
// it in the Open Graph and Twitter tags.
export const getStaticPaths = (async () => {
  return (await getShareImages()).map((image) => ({ params: { image: image.image }, props: { image } }))
}) satisfies GetStaticPaths

export const GET: APIRoute = async ({ props }) => {
  const png = await renderShareImage((props as { image: ShareImage }).image)
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  })
}
