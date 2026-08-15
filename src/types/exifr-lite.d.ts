/**
 * exifr ships types for its main entry only. The lite build is the one we want:
 * it reads HEIC (what iPhones save) and DateTimeOriginal, without the parsers
 * for formats a photo picker will never hand us.
 */
declare module 'exifr/dist/lite.esm.mjs' {
  type Input = File | Blob | ArrayBuffer | Uint8Array | string

  const exifr: {
    gps(input: Input): Promise<{ latitude: number; longitude: number } | undefined>
    parse(input: Input, options?: string[] | Record<string, unknown>): Promise<Record<string, unknown> | undefined>
  }

  export default exifr
}
