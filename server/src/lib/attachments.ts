import multer from "multer";

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

// Memory storage only — attachment bytes are persisted straight to Postgres (see the
// Attachment model), so nothing needs to land on disk.
export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: MAX_ATTACHMENTS_PER_MESSAGE },
});

export type UploadedFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

export function filesToAttachmentData(files: UploadedFile[]) {
  return files.map((file) => ({
    filename: file.originalname,
    contentType: file.mimetype || null,
    size: file.size,
    content: file.buffer,
  }));
}

export const attachmentSelect = { id: true, filename: true, contentType: true, size: true } as const;
