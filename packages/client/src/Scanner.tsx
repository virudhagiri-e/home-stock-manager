import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, FormEvent } from 'react'
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { normalizeBarcode } from './utils/barcode.js'

// Serve the barcode engine from this app instead of the library's default CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? wasmUrl : prefix + path,
  },
})

let detector: BarcodeDetector | null = null
function getDetector() {
  detector ??= new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] })
  return detector
}

type CameraState =
  | { status: 'starting' }
  | { status: 'scanning'; torch: boolean | null }
  | { status: 'unavailable'; message: string }

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access is blocked. Allow the camera for this site in your browser settings, or use a photo or type the number instead.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found. Use a photo or type the number instead.'
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera is busy in another app. Close it and try again, or use a photo instead.'
  }
  return 'The camera could not be started. Use a photo or type the number instead.'
}

export type ScannerProps = {
  busy: boolean
  error: string
  onDetected: (code: string) => void
  onClose: () => void
}

export default function Scanner({ busy, error, onDetected, onClose }: ScannerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const detectedRef = useRef(false)
  const runRef = useRef(0)
  // Keep the latest callback without restarting the camera every time the app re-renders.
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])
  const [camera, setCamera] = useState<CameraState>({ status: 'starting' })
  const [torchOn, setTorchOn] = useState(false)
  const [typedCode, setTypedCode] = useState('')
  const [message, setMessage] = useState('')
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)

  const stopCamera = useCallback(() => {
    window.clearTimeout(timerRef.current)
    // Invalidates any camera start still in progress, so it releases its stream quietly.
    runRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const found = useCallback(
    (raw: string) => {
      const code = normalizeBarcode(raw)
      if (!code || detectedRef.current) return false
      detectedRef.current = true
      stopCamera()
      navigator.vibrate?.(60)
      onDetectedRef.current(code)
      return true
    },
    [stopCamera],
  )

  const startCamera = useCallback(async () => {
    detectedRef.current = false
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamera({
        status: 'unavailable',
        message: 'This browser cannot use the camera here. Use a photo or type the number instead.',
      })
      return
    }

    const run = ++runRef.current
    setCamera({ status: 'starting' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      const video = videoRef.current
      if (run !== runRef.current || !video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      video.srcObject = stream
      await video.play()
      if (run !== runRef.current) return

      const [track] = stream.getVideoTracks()
      const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined
      setCamera({ status: 'scanning', torch: capabilities?.torch ? false : null })

      const tick = async () => {
        if (run !== runRef.current || detectedRef.current) return
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            const [barcode] = await getDetector().detect(video)
            if (barcode && found(barcode.rawValue)) return
          } catch {
            // A single unreadable frame is normal; keep scanning.
          }
        }
        timerRef.current = window.setTimeout(tick, 200)
      }
      void tick()
    } catch (cameraError) {
      // A start that was superseded (closed, tab hidden, restarted) is not a camera problem.
      if (run !== runRef.current) return
      stopCamera()
      setCamera({ status: 'unavailable', message: cameraErrorMessage(cameraError) })
    }
  }, [found, stopCamera])

  useEffect(() => {
    dialogRef.current?.showModal()
    void startCamera()

    // Turn the camera off while the tab is hidden, and back on when the user returns.
    const onVisibility = () => {
      if (document.hidden) stopCamera()
      else if (!detectedRef.current) void startCamera()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    // A failed lookup leaves the dialog open, so allow another scan.
    if (!error) return
    detectedRef.current = false
    if (!streamRef.current) void startCamera()
  }, [error, startCamera])

  async function toggleTorch() {
    const [track] = streamRef.current?.getVideoTracks() ?? []
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch {
      setCamera((current) =>
        current.status === 'scanning' ? { ...current, torch: null } : current,
      )
    }
  }

  async function readPhoto(file: File | undefined) {
    if (!file) return
    setMessage('')
    if (!file.type.startsWith('image/')) {
      setMessage('That file is not a picture. Choose a photo of the barcode.')
      return
    }

    setIsReadingPhoto(true)
    try {
      const barcodes = await getDetector().detect(file)
      const match = barcodes.find((barcode) => normalizeBarcode(barcode.rawValue))
      detectedRef.current = false
      if (!match || !found(match.rawValue)) {
        setMessage(
          'No barcode found in that photo. Take it closer, straight on and in good light, or type the number.',
        )
      }
    } catch {
      setMessage("This picture couldn't be read here. Use a JPEG or PNG photo, or type the number.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function submitTyped(event: FormEvent) {
    event.preventDefault()
    const code = normalizeBarcode(typedCode)
    if (!code) {
      setMessage(
        "That number doesn't look right. Type all the digits under the barcode, usually 13.",
      )
      return
    }
    setMessage('')
    detectedRef.current = false
    found(code)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    void readPhoto(event.dataTransfer.files[0])
  }

  function onPaste(event: ClipboardEvent) {
    const file = [...event.clipboardData.files].find((entry) => entry.type.startsWith('image/'))
    if (file) {
      event.preventDefault()
      void readPhoto(file)
    }
  }

  const statusText = busy
    ? 'Looking up this product...'
    : isReadingPhoto
      ? 'Reading the photo...'
      : camera.status === 'starting'
        ? 'Starting the camera...'
        : camera.status === 'scanning'
          ? 'Point the camera at the barcode. It scans automatically.'
          : ''

  return (
    <dialog
      ref={dialogRef}
      className="scanner-dialog"
      aria-labelledby="scanner-title"
      onClose={onClose}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      <div className="dialog-heading">
        <div>
          <h2 id="scanner-title">Scan a barcode</h2>
          <p>Fill in an item from its barcode, or find one you already have.</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close scanner"
          onClick={() => dialogRef.current?.close()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="m6 6 12 12M6 18 18 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="scanner-body">
        {camera.status === 'unavailable' ? (
          <p className="scanner-camera-off" role="status">
            {camera.message}
          </p>
        ) : (
          <div className="scanner-viewfinder">
            <video ref={videoRef} muted playsInline aria-label="Camera preview" />
            <span className="scanner-frame" aria-hidden="true" />
            {camera.status === 'scanning' && camera.torch !== null ? (
              <button
                className="secondary-button scanner-torch"
                type="button"
                onClick={toggleTorch}
              >
                {torchOn ? 'Light off' : 'Light on'}
              </button>
            ) : null}
          </div>
        )}

        <p className="scanner-status" role="status" aria-live="polite">
          {statusText}
        </p>
        {error || message ? (
          <p className="notice error" role="alert">
            {error || message}
          </p>
        ) : null}

        <div className="scanner-fallbacks">
          <label className="secondary-button scanner-photo">
            Use a photo
            <input
              type="file"
              accept="image/*"
              disabled={busy || isReadingPhoto}
              onChange={(event) => {
                void readPhoto(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
          <p className="scanner-hint">
            On a computer you can also drag a picture here or paste one with Ctrl+V.
          </p>
          <form className="scanner-typed" onSubmit={submitTyped}>
            <label>
              Or type the number under the barcode
              <span className="scanner-typed-row">
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="e.g. 7310865004703"
                  value={typedCode}
                  onChange={(event) => setTypedCode(event.target.value)}
                  disabled={busy}
                />
                <button
                  className="primary-button"
                  type="submit"
                  disabled={busy || !typedCode.trim()}
                >
                  Look up
                </button>
              </span>
            </label>
          </form>
        </div>
      </div>
    </dialog>
  )
}
