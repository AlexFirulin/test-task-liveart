export async function preloadImage(src: string): Promise<void> {
  const image = new Image()
  image.src = src
  try {
    await image.decode()
  } catch {
    // Let the cropper surface any real load/decode error itself.
  }
}
