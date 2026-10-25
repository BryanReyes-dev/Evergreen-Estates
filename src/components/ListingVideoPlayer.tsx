type ListingVideoPlayerProps = {
  src: string;
  captionSrc?: string | null;
  label: string;
  className: string;
  disablePictureInPicture?: boolean;
  disableRemotePlayback?: boolean;
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
}: ListingVideoPlayerProps) {
  return (
    <video
      src={src}
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
