export type AudioGenerationFailureClass = "transient" | "terminal" | "policy" | "canceled";

export class AudioGenerationError extends Error {
  constructor(
    message: string,
    public readonly failureClass: AudioGenerationFailureClass,
    public readonly reasonCode: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AudioGenerationError";
  }
}

