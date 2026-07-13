declare module 'pdf-parse' {
  export type PdfParseResult = {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  };
  export default function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
}
