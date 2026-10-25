"use client";

import { useEffect, useRef } from "react";

type ListingVideoPlayerProps = {
  src: string;
  captionSrc?: string | null;
  label: string;
  className: string;
  disablePictureInPicture?: boolean;
  disableRemotePlayback?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
};

/**
 * Native video playback with an optional English WebVTT track.
 * Missing captions must never prevent the underlying video from playing.
 */
export function ListingVideoPlayer({
  src,
  captionSrc,
  label,
  className,
  disablePictureInPicture = false,
  disableRemotePlayback = false,
  autoPlay = false,
  loop = false,
}: ListingVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!autoPlay) {
      video.pause();
      return;
    }

    // Muted inline playback is the most compatible browser autoplay mode.
    video.muted = true;
    const playback = video.play();
    if (playback) {
      void playback.catch(() => {
        // Browsers can still reject playback due to user/device policy.
      });
    }

    return () => video.pause();
  }, [autoPlay, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay={autoPlay}
      muted={autoPlay}
      loop={loop}
      className={className}
      controls
      playsInline
      preload="metadata"
      disablePictureInPicture={disablePictureInPicture}
      disableRemotePlayback={disableRemotePlayback}
      aria-label={label}
    >
      {captionSrc ? (
        <track
          kind="captions"
          src={captionSrc}
          srcLang="en"
          label="English captions"
          default
        />
      ) : null}
    </video>
  );
}
