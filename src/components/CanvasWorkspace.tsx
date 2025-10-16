import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { CURRENT_CANVAS_FILENAME } from '../constants'
import type { Tool } from '../types'

const INITIAL_CANVAS_HEIGHT = 1200
const CANVAS_WIDTH = 800
const CANVAS_EXTEND_HEIGHT = 400
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
const ZOOM_STEP = 0.25
const MAX_HISTORY = 20

interface CutAnimationState {
  imageUrl: string
  height: number
}

interface CanvasWorkspaceProps {
  directoryHandle: FileSystemDirectoryHandle
  tool: Tool
  strokeWidth: number
  onImageSaved: (filename: string) => void
}

interface CanvasSnapshot {
  imageData: ImageData
  height: number
}

const generateFilename = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.png`
}

const CanvasWorkspace = ({
  directoryHandle,
  tool,
  strokeWidth,
  onImageSaved
}: CanvasWorkspaceProps) => {
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT)
  const [zoom, setZoom] = useState(1)
  const [canUndo, setCanUndo] = useState(false)
  const [hoveredScissorY, setHoveredScissorY] = useState<number | null>(null)
  const [cutAnimation, setCutAnimation] = useState<CutAnimationState | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const isExtending = useRef(false)
  const needsExtension = useRef(false)
  const historyRef = useRef<CanvasSnapshot[]>([])
  const skipBackgroundFillRef = useRef(false)
  const pendingRestoreRef = useRef<CanvasSnapshot | null>(null)
  const autoSaveTimeoutRef = useRef<number | null>(null)

  const tornEdgePath = useMemo(() => {
    const points = Array.from({ length: 40 }, (_, i) => {
      const x = (i / 40) * CANVAS_WIDTH
      const y = 20 - Math.random() * 8 - (Math.sin(i * 0.5) * 3)
      return `L${x},${y}`
    }).join(' ')
    return `M0,20 ${points} L${CANVAS_WIDTH},20 Z`
  }, [])

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const captureSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = getCanvasContext()
    if (!ctx) return

    try {
      const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, canvasHeight)
      const snapshot: CanvasSnapshot = { imageData, height: canvasHeight }
      const updatedHistory = [...historyRef.current, snapshot]
      if (updatedHistory.length > MAX_HISTORY) {
        updatedHistory.shift()
      }
      historyRef.current = updatedHistory
      setCanUndo(updatedHistory.length > 0)
    } catch (err) {
      console.error('Failed to capture snapshot', err)
    }
  }, [canvasHeight, getCanvasContext])

  const restoreSnapshot = useCallback((snapshot: CanvasSnapshot | null) => {
    if (!snapshot) return
    const canvas = canvasRef.current
    if (!canvas) return

    if (canvas.height !== snapshot.height) {
      pendingRestoreRef.current = snapshot
      skipBackgroundFillRef.current = true
      setCanvasHeight(snapshot.height)
      return
    }

    const ctx = getCanvasContext()
    if (!ctx) return
    ctx.putImageData(snapshot.imageData, 0, 0)
    ctx.beginPath()
  }, [getCanvasContext])

  const saveCurrentCanvas = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !directoryHandle) return

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/png')
    })

    if (!blob) return

    try {
      const fileHandle = await directoryHandle.getFileHandle(CURRENT_CANVAS_FILENAME, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
    } catch (err) {
      console.error('Failed to save current canvas', err)
    }
  }, [directoryHandle])

  const scheduleAutoSave = useCallback(() => {
    if (!directoryHandle) return
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      autoSaveTimeoutRef.current = null
      void saveCurrentCanvas()
    }, 1000)
  }, [directoryHandle, saveCurrentCanvas])

  const extendCanvas = useCallback(() => {
    if (isExtending.current) return
    isExtending.current = true

    const canvas = canvasRef.current
    if (!canvas) {
      isExtending.current = false
      return
    }

    captureSnapshot()

    const currentImageData = canvas.toDataURL('image/png')
    const newHeight = canvasHeight + CANVAS_EXTEND_HEIGHT
    setCanvasHeight(newHeight)

    setTimeout(() => {
      const ctx = getCanvasContext()
      if (!ctx) {
        isExtending.current = false
        return
      }

      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, CANVAS_WIDTH, newHeight)

      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        isExtending.current = false
        scheduleAutoSave()
      }
      img.onerror = () => {
        console.error('Failed to rehydrate canvas after extension')
        isExtending.current = false
      }
      img.src = currentImageData
    }, 0)
  }, [canvasHeight, captureSnapshot, getCanvasContext, scheduleAutoSave])

  const adjustZoom = useCallback((direction: 'in' | 'out') => {
    setZoom((prev) => {
      const delta = direction === 'in' ? ZOOM_STEP : -ZOOM_STEP
      const nextZoom = prev + delta
      const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
      return Number(clampedZoom.toFixed(2))
    })
  }, [])

  const resetZoom = useCallback(() => {
    setZoom(1)
  }, [])

  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom])

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) {
      return
    }

    const history = historyRef.current
    const snapshot = history[history.length - 1]
    historyRef.current = history.slice(0, -1)
    setCanUndo(historyRef.current.length > 0)
    restoreSnapshot(snapshot)
    scheduleAutoSave()
  }, [restoreSnapshot, scheduleAutoSave])

  const handleClear = useCallback(() => {
    if (!confirm('Clear the canvas?')) return
    captureSnapshot()

    const ctx = getCanvasContext()
    if (!ctx) return

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)
    ctx.beginPath()
    if (hoveredScissorY !== null) {
      setHoveredScissorY(null)
    }
    needsExtension.current = false
    scheduleAutoSave()
  }, [canvasHeight, captureSnapshot, getCanvasContext, hoveredScissorY, scheduleAutoSave])

  const handleMouseDown = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) / zoom
    const y = (event.clientY - rect.top) / zoom

    captureSnapshot()

    const ctx = getCanvasContext()
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = tool === 'pen' ? 'black' : 'white'
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [captureSnapshot, getCanvasContext, strokeWidth, tool, zoom])

  const handleMouseMove = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) / zoom
    const y = (event.clientY - rect.top) / zoom

    const ctx = getCanvasContext()
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()

    if (y > canvasHeight - 200) {
      needsExtension.current = true
    }
  }, [canvasHeight, getCanvasContext, zoom])

  const finalizeStroke = useCallback(() => {
    isDrawing.current = false

    if (needsExtension.current) {
      needsExtension.current = false
      extendCanvas()
      return
    }

    scheduleAutoSave()
  }, [extendCanvas, scheduleAutoSave])

  const handleScissorClick = useCallback(async (y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    captureSnapshot()

    const upperCanvas = document.createElement('canvas')
    upperCanvas.width = CANVAS_WIDTH
    upperCanvas.height = y
    const upperCtx = upperCanvas.getContext('2d')
    const ctx = getCanvasContext()

    if (!upperCtx || !ctx) return

    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, y)
    upperCtx.putImageData(imageData, 0, 0)

    const animationImageUrl = upperCanvas.toDataURL('image/png')
    setCutAnimation({ imageUrl: animationImageUrl, height: y })

    setTimeout(() => {
      setCutAnimation(null)
    }, 800)

    upperCanvas.toBlob(async (blob) => {
      if (!blob) return

      const filename = generateFilename()

      try {
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()

        if (hoveredScissorY !== null) {
          setHoveredScissorY(null)
        }

        const lowerImageData = ctx.getImageData(0, y, CANVAS_WIDTH, canvasHeight - y)

        setTimeout(() => {
          const newHeight = canvasHeight - y
          setCanvasHeight(newHeight)

          setTimeout(() => {
            const newCtx = getCanvasContext()
            if (!newCtx) return

            newCtx.fillStyle = 'white'
            newCtx.fillRect(0, 0, CANVAS_WIDTH, newHeight)
            newCtx.putImageData(lowerImageData, 0, 0)
            scheduleAutoSave()
          }, 0)
        }, 100)

        onImageSaved(filename)
      } catch (err) {
        console.error('Failed to save file', err)
        alert('Failed to save file')
      }
    }, 'image/png')
  }, [canvasHeight, captureSnapshot, directoryHandle, getCanvasContext, hoveredScissorY, onImageSaved, scheduleAutoSave])

  useEffect(() => {
    const ctx = getCanvasContext()
    if (!ctx) return

    if (skipBackgroundFillRef.current) {
      skipBackgroundFillRef.current = false
      return
    }

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)
  }, [canvasHeight, directoryHandle, getCanvasContext])

  useEffect(() => {
    if (!pendingRestoreRef.current) return
    const snapshot = pendingRestoreRef.current
    pendingRestoreRef.current = null

    const ctx = getCanvasContext()
    if (!ctx) return
    ctx.putImageData(snapshot.imageData, 0, 0)
    ctx.beginPath()
  }, [canvasHeight, getCanvasContext])

  useEffect(() => {
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }
    historyRef.current = []
    setCanUndo(false)
  }, [directoryHandle])

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  const isAtMinZoom = zoom <= MIN_ZOOM
  const isAtMaxZoom = zoom >= MAX_ZOOM
  const scaledWidth = CANVAS_WIDTH * zoom
  const scaledHeight = canvasHeight * zoom

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px'
    }}>
      <div
        style={{
          width: '100%',
          maxWidth: `${CANVAS_WIDTH + 120}px`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => adjustZoom('out')}
            disabled={isAtMinZoom}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              border: '1px solid #ddd',
              backgroundColor: '#fff',
              cursor: isAtMinZoom ? 'not-allowed' : 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isAtMinZoom ? 0.4 : 1
            }}
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={resetZoom}
            disabled={zoom === 1}
            style={{
              minWidth: '72px',
              padding: '0 12px',
              height: '32px',
              borderRadius: '16px',
              border: '1px solid #ddd',
              backgroundColor: '#fff',
              cursor: zoom === 1 ? 'default' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              opacity: zoom === 1 ? 0.6 : 1,
              fontVariantNumeric: 'tabular-nums'
            }}
            title={zoom === 1 ? 'Current zoom' : 'Reset zoom to 100%'}
          >
            {zoomPercentage}%
          </button>
          <button
            type="button"
            onClick={() => adjustZoom('in')}
            disabled={isAtMaxZoom}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              border: '1px solid #ddd',
              backgroundColor: '#fff',
              cursor: isAtMaxZoom ? 'not-allowed' : 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isAtMaxZoom ? 0.4 : 1
            }}
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            style={{
              minWidth: '72px',
              padding: '0 16px',
              height: '32px',
              borderRadius: '16px',
              border: '1px solid #ddd',
              backgroundColor: '#fff',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 500,
              opacity: canUndo ? 1 : 0.4
            }}
            title="Undo last change"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            style={{
              minWidth: '72px',
              padding: '0 16px',
              height: '32px',
              borderRadius: '16px',
              border: '1px solid #f87171',
              backgroundColor: '#fff5f5',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
            title="Clear the canvas"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={extendCanvas}
            style={{
              padding: '0 16px',
              height: '32px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: '#000',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
            title="Extend the canvas"
          >
            Extend
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
          overflow: 'visible'
        }}
      >
        <div
          style={{
            position: 'relative',
            width: `${CANVAS_WIDTH}px`,
            height: `${canvasHeight}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left'
          }}
        >
          <svg
            width={CANVAS_WIDTH}
            height="20"
            viewBox={`0 0 ${CANVAS_WIDTH} 20`}
            style={{
              position: 'absolute',
              top: '-20px',
              left: 0,
              zIndex: 1
            }}
            preserveAspectRatio="none"
          >
            <path
              d={tornEdgePath}
              fill="#fff"
              stroke="#ddd"
              strokeWidth="1"
            />
          </svg>

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={canvasHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={finalizeStroke}
            onMouseLeave={finalizeStroke}
            style={{
              border: '1px solid #ddd',
              cursor: 'crosshair',
              display: 'block',
              backgroundColor: '#fff'
            }}
          />

          {cutAnimation && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${CANVAS_WIDTH}px`,
                height: `${cutAnimation.height}px`,
                pointerEvents: 'none',
                animation: 'slideUp 0.8s cubic-bezier(0.4, 0.0, 0.2, 1) forwards',
                zIndex: 100
              }}
            >
              <img
                src={cutAnimation.imageUrl}
                alt="Cut animation"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                }}
              />
            </div>
          )}

          {hoveredScissorY !== null && !cutAnimation && (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${CANVAS_WIDTH}px`,
                  height: `${hoveredScissorY}px`,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#000',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}>
                  Save as {generateFilename()}
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: `${hoveredScissorY}px`,
                  left: 0,
                  width: `${CANVAS_WIDTH}px`,
                  height: '2px',
                  backgroundColor: '#000',
                  pointerEvents: 'none',
                  boxShadow: '0 0 4px rgba(0, 0, 0, 0.5)'
                }}
              />
            </>
          )}

          <svg
            width="40"
            height={canvasHeight}
            viewBox={`0 0 40 ${canvasHeight}`}
            style={{
              position: 'absolute',
              right: '-40px',
              top: 0,
              pointerEvents: 'none'
            }}
          >
            {Array.from({ length: Math.floor(canvasHeight / 10) + 1 }).map((_, i) => {
              const y = i * 10
              const isMajor = i % 10 === 0
              const isMedium = i % 5 === 0
              const lineWidth = isMajor ? 20 : isMedium ? 12 : 6
              const opacity = isMajor ? 0.5 : isMedium ? 0.35 : 0.25

              return (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2={lineWidth}
                  y2={y}
                  stroke="#999"
                  strokeWidth="1"
                  opacity={opacity}
                />
              )
            })}
          </svg>

          <div
            style={{
              position: 'absolute',
              right: '-40px',
              top: 0,
              width: '40px',
              height: canvasHeight,
              cursor: 'pointer'
            }}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              const relativeY = (event.clientY - rect.top) / zoom
              const clampedY = Math.max(50, Math.min(canvasHeight - 50, relativeY))
              setHoveredScissorY(Math.round(clampedY))
            }}
            onMouseLeave={() => setHoveredScissorY(null)}
            onClick={() => {
              if (hoveredScissorY !== null) {
                handleScissorClick(hoveredScissorY)
              }
            }}
          />
        </div>
      </div>

    </div>
  )
}

export default CanvasWorkspace
