// media.ts
// Auto-generated from contracts/media.md
// Do not edit manually

export interface Mediaasset {
  id: string;
  type: image|video|audio|document;
  url: unknown;
  size: unknown;
  metadata: unknown;
  createdAt: Timestamp;
}

export interface Mediavariant {
  id: string;
  assetId: string;
  transformation: unknown;
  url: unknown;
  size: unknown;
}

export interface Processingjob {
  id: string;
  assetId: string;
  status: unknown;
  createdAt: Timestamp;
}

export interface Transformation {

}

export interface MediaContract {
  uploadMedia(file: unknown, options?: unknown): Promise<MediaAsset>;
  processMedia(assetId: unknown, transformations: unknown): Promise<ProcessingJob>;
  getMediaAsset(assetId: unknown): Promise<MediaAsset>;
  getVariants(assetId: unknown): Promise<MediaVariant[]>;
  deleteMediaAsset(assetId: unknown): Promise<void>;
  generateThumbnail(assetId: unknown, options?: unknown): Promise<MediaVariant>;
  transcodeVideo(assetId: unknown, format: unknown, options?: unknown): Promise<ProcessingJob>;
  getProcessingJob(jobId: unknown): Promise<ProcessingJob>;
}
