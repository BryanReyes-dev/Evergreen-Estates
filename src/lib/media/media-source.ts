/**
 * Detect animated GIF URLs, including signed URLs with query strings.
 * Netlify Image CDN currently passes GIFs through without resizing them,
 * so serving these sources directly avoids an unnecessary proxy request.
 */
export function isGifMediaSource(src: string): boolean {
  const pathname = src.split(/[?#]/, 1)[0] ?? "";
  return pathname.toLowerCase().endsWith(".gif");
}
