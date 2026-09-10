"use client";

interface NetlifyImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export default function netlifyImageLoader({
  src,
  width,
  quality = 75,
}: NetlifyImageLoaderProps): string {
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality),
  });

  return `/.netlify/images?${params.toString()}`;
}
