import type { APIRoute } from 'astro'
import sharp from 'sharp'
import artwork from '../assets/og.svg?raw'

// The share image named by the Open Graph and Twitter tags in BaseLayout.astro.
// Sharing clients need a raster image, so the build renders the SVG artwork.
export const GET: APIRoute = async () => {
  const png = await sharp(Buffer.from(artwork)).png({ compressionLevel: 9 }).toBuffer()
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  })
}
