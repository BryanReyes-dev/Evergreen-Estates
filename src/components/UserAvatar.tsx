"use client";

/* eslint-disable jsx-a11y/prefer-tag-over-role -- The avatar is a composite visual (uploaded image or generated initial) that needs one accessible image label. */

import Image from "next/image";
import { useState } from "react";

const AVATAR_COLORS = [
  "#4263a8",
  "#7c3f91",
  "#a34b35",
  "#236d62",
  "#72551c",
  "#315d8c",
  "#873c5d",
  "#53652a",
] as const;

function hashIdentity(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function UserAvatar({
  name,
  imageUrl,
  identity,
  className = "h-10 w-10",
}: {
  name: string;
  imageUrl?: string | null;
  identity?: string | null;
  className?: string;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const safeImageUrl = (() => {
    if (!imageUrl) return null;
    try {
      const url = new URL(imageUrl);
      return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "blob:" ? imageUrl : null;
    } catch {
      return null;
    }
  })();

  const imageFailed = safeImageUrl !== null && failedImageUrl === safeImageUrl;

  const label = name.trim() || "Evergreen Estates member";
  const initial = Array.from(label)[0]?.toLocaleUpperCase("en-US") ?? "?";
  const colorSeed = identity?.trim() || label.toLocaleLowerCase("en-US");
  const background = AVATAR_COLORS[hashIdentity(colorSeed) % AVATAR_COLORS.length];

  return (
    <span
      role="img"
      aria-label={label + " avatar"}
      className={"relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white " + className}
      style={{ backgroundColor: safeImageUrl && !imageFailed ? "#202324" : background }}
    >
      {safeImageUrl && !imageFailed ? (
        <Image
          src={safeImageUrl}
          alt=""
          aria-hidden="true"
          fill
          unoptimized
          sizes="96px"
          className="object-cover"
          onError={() => setFailedImageUrl(safeImageUrl)}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
