import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'

// Mirrors the API's accepted image types (ADR 0006). Anything else that
// slipped past the file input's `accept` gets re-encoded as JPEG on export.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface ImageCropModalProps {
  /** The file the vendor just picked, before any cropping. */
  file: File
  /** Fixed output aspect ratio (width / height). 1 = square. */
  aspect: number
  cropShape?: 'rect' | 'round'
  title: string
  hint?: string
  /** Longest edge of the exported image, so a 12MP phone photo doesn't
   * blow past the API's 5MB per-image limit. */
  maxWidth?: number
  onCancel: () => void
  /** Receives the cropped image as a File, ready to append to FormData. */
  onConfirm: (cropped: File) => void
}

/**
 * Facebook-style crop-on-upload dialog: drag to reposition, slide to zoom,
 * fixed aspect ratio per field. What leaves here is the cropped canvas
 * export, never the original file.
 */
export function ImageCropModal({
  file,
  aspect,
  cropShape = 'rect',
  title,
  hint,
  maxWidth = 1600,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const onCropComplete = useCallback((_area: Area, pixels: Area) => setArea(pixels), [])

  async function confirm() {
    if (!imageSrc || !area) return
    setError(null)
    setWorking(true)
    try {
      onConfirm(await cropToFile(imageSrc, area, file, maxWidth))
    } catch {
      setError('Could not crop that image. Try a different file.')
      setWorking(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal crop-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>
          ×
        </button>
        <h2>{title}</h2>
        {hint && <p className="muted">{hint}</p>}

        <div className="crop-area">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <label className="crop-zoom">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            aria-label="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        <div className="row gap crop-actions">
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={!area || working}>
            {working ? 'Cropping…' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Could not load image')))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Empty canvas'))), type, 0.92)
  })
}

/**
 * Draws the selected region onto an offscreen canvas and hands back the
 * result as a File. Exported for testing; the modal is the only caller.
 */
export async function cropToFile(
  imageSrc: string,
  area: Area,
  source: File,
  maxWidth: number,
): Promise<File> {
  const image = await loadImage(imageSrc)
  const scale = area.width > maxWidth ? maxWidth / area.width : 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(area.width * scale))
  canvas.height = Math.max(1, Math.round(area.height * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)

  const type = ALLOWED_TYPES.includes(source.type) ? source.type : 'image/jpeg'
  const blob = await canvasToBlob(canvas, type)
  return new File([blob], source.name, { type })
}
