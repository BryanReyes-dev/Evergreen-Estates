export const MAX_CAPTION_FILE_BYTES = 1_000_000;

type CaptionFileMetadata = {
  name: string;
  size: number;
};

/**
 * Validates English WebVTT captions before the file is stored alongside a video.
 * The size check is repeated on the server; the browser check is only UX feedback.
 */
export function validateWebVttCaptionFile(
  file: CaptionFileMetadata,
  content: string,
): string | null {
  if (!file.name.toLowerCase().endsWith(".vtt")) {
    return "Choose an English WebVTT caption file (.vtt).";
  }

  const byteLength = new TextEncoder().encode(content).byteLength;

  if (file.size <= 0 || byteLength <= 0) {
    return "The caption file is empty.";
  }

  if (file.size > MAX_CAPTION_FILE_BYTES || byteLength > MAX_CAPTION_FILE_BYTES) {
    return `Caption files must be no larger than ${MAX_CAPTION_FILE_BYTES.toLocaleString()} bytes.`;
  }

  if (file.size !== byteLength) {
    return "The caption file could not be decoded as valid UTF-8.";
  }

  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  if (!normalized.startsWith("WEBVTT\n") && normalized !== "WEBVTT") {
    return "The caption file must start with the WEBVTT header.";
  }

  const cueBlocks = normalized.split(/\n{2,}/).slice(1);
  const hasCaptionCue = cueBlocks.some((block) => {
    const lines = block.split("\n");
    const timingLineIndex = lines.findIndex((line) =>
      /^(?:\d{2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}\.\d{3}(?:\s+.*)?$/.test(line.trim()),
    );

    return (
      timingLineIndex >= 0 &&
      lines.slice(timingLineIndex + 1).some((line) => line.trim().length > 0)
    );
  });

  if (!hasCaptionCue) {
    return "Add at least one caption cue with start time, end time, and caption text.";
  }

  return null;
}

/** Maps a registered video filename to its companion English WebVTT file. */
export function captionFilenameForVideo(filename: string): string | null {
  if (!/\.(mp4|webm|mov)$/i.test(filename)) {
    return null;
  }

  return filename.replace(/\.(mp4|webm|mov)$/i, ".vtt");
}
