import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { CURRENT_CANVAS_FILENAME } from '../constants'
import type { Tool } from '../types'

const INITIAL_CANVAS_HEIGHT = 1200
const CANVAS_WIDTH = 800
const CANVAS_EXTEND_HEIGHT = 400
const MAX_HISTORY = 20

interface CutAnimationState {
  imageUrl: string
  height: number
}

interface KeyboardShortcuts {
  pen: string
  eraser: string
}

interface CanvasWorkspaceProps {
  directoryHandle: FileSystemDirectoryHandle | null
  tool: Tool
  strokeWidth: number
  strokeWidthOptions: number[]
  shortcuts: KeyboardShortcuts
  onToolChange: (tool: Tool) => void
  onStrokeWidthChange: (width: number) => void
  onImageSaved: (filename: string) => void
  onSettingsClick: () => void
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
  strokeWidthOptions,
  shortcuts,
  onToolChange,
  onStrokeWidthChange,
  onImageSaved,
  onSettingsClick
}: CanvasWorkspaceProps) => {
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT)
  const [zoom, setZoom] = useState(1)
  const [canUndo, setCanUndo] = useState(false)
  const [hoveredScissorY, setHoveredScissorY] = useState<number | null>(null)
  const [cutAnimation, setCutAnimation] = useState<CutAnimationState | null>(null)
  const [responsiveScale, setResponsiveScale] = useState(1)
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

  const sliderIndex = useMemo(() => {
    const index = strokeWidthOptions.indexOf(strokeWidth)
    return index === -1 ? 0 : index
  }, [strokeWidth, strokeWidthOptions])

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

  const handlePointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    isDrawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return

    // Capture pointer to ensure events continue even if pointer moves outside canvas
    canvas.setPointerCapture(event.pointerId)

    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) / (zoom * responsiveScale)
    const y = (event.clientY - rect.top) / (zoom * responsiveScale)

    captureSnapshot()

    const ctx = getCanvasContext()
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = tool === 'pen' ? 'black' : 'white'
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [captureSnapshot, getCanvasContext, strokeWidth, tool, zoom, responsiveScale])

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    event.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) / (zoom * responsiveScale)
    const y = (event.clientY - rect.top) / (zoom * responsiveScale)

    const ctx = getCanvasContext()
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()

    if (y > canvasHeight - 200) {
      needsExtension.current = true
    }
  }, [canvasHeight, getCanvasContext, zoom, responsiveScale])

  const finalizeStroke = useCallback(() => {
    isDrawing.current = false

    if (needsExtension.current) {
      needsExtension.current = false
      extendCanvas()
      return
    }

    scheduleAutoSave()
  }, [extendCanvas, scheduleAutoSave])

  const handlePointerUp = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
    finalizeStroke()
  }, [finalizeStroke])

  const handleScissorClick = useCallback(async (y: number) => {
    if (!directoryHandle) return

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      // Tool switching
      if (event.key === shortcuts.pen) {
        event.preventDefault()
        onToolChange('pen')
        return
      }

      if (event.key === shortcuts.eraser) {
        event.preventDefault()
        onToolChange('eraser')
        return
      }

      // Undo
      if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }

      // Zoom controls
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setZoom((prev) => {
          const next = Number((prev + 0.25).toFixed(2))
          return Math.min(2, next)
        })
        return
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setZoom((prev) => {
          const next = Number((prev - 0.25).toFixed(2))
          return Math.max(0.5, next)
        })
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        setZoom(1)
        return
      }

      // Stroke width controls
      if (event.key === '[') {
        event.preventDefault()
        const currentIndex = strokeWidthOptions.indexOf(strokeWidth)
        if (currentIndex > 0) {
          onStrokeWidthChange(strokeWidthOptions[currentIndex - 1])
        }
        return
      }

      if (event.key === ']') {
        event.preventDefault()
        const currentIndex = strokeWidthOptions.indexOf(strokeWidth)
        if (currentIndex < strokeWidthOptions.length - 1) {
          onStrokeWidthChange(strokeWidthOptions[currentIndex + 1])
        }
        return
      }

      // Toggle settings
      if (event.key === '?') {
        event.preventDefault()
        onSettingsClick()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleUndo, onSettingsClick, onToolChange, onStrokeWidthChange, shortcuts, strokeWidth, strokeWidthOptions])

  const scaledWidth = CANVAS_WIDTH * zoom
  const scaledHeight = canvasHeight * zoom
  const panelWidth = Math.min(CANVAS_WIDTH + 160, Math.max(360, scaledWidth))
  const bottomPadding = 0
  const canSave = Boolean(directoryHandle)

  useEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth
      
      // On mobile, scale down canvas to fit screen with padding
      if (viewportWidth < 900) {
        const availableWidth = viewportWidth - 80 // 40px padding on each side
        const scaleByWidth = availableWidth / CANVAS_WIDTH
        setResponsiveScale(Math.min(scaleByWidth, 1))
      } else {
        setResponsiveScale(1)
      }
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  useEffect(() => {
    if (!canSave && hoveredScissorY !== null) {
      setHoveredScissorY(null)
    }
  }, [canSave, hoveredScissorY])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '72px',
        paddingBottom: `${bottomPadding}px`
      }}
    >
      <div
        style={{
          position: 'relative',
          width: `${scaledWidth * responsiveScale}px`,
          maxWidth: '100%'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-76px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px',
            padding: '12px 20px',
            width: `${panelWidth}px`,
            maxWidth: 'calc(100vw - 40px)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onToolChange('pen')}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: '1px solid rgba(17, 24, 39, 0.08)',
                backgroundColor: tool === 'pen' ? '#111' : 'rgba(255, 255, 255, 0.6)',
                color: tool === 'pen' ? '#fff' : '#111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Pen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onToolChange('eraser')}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: '1px solid rgba(17, 24, 39, 0.08)',
                backgroundColor: tool === 'eraser' ? '#111' : 'rgba(255, 255, 255, 0.6)',
                color: tool === 'eraser' ? '#fff' : '#111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Eraser"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 20H7L2.5 15.5a2 2 0 0 1 0-2.83L12.71 2.46a2 2 0 0 1 2.83 0L21.54 8.5a2 2 0 0 1 0 2.83L16 17" />
                <path d="M7 20v-4" />
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              className="mono-slider"
              type="range"
              min="0"
              max={(strokeWidthOptions.length - 1).toString()}
              value={sliderIndex}
              onChange={(event) => {
                const index = parseInt(event.target.value, 10)
                const nextWidth = strokeWidthOptions[index] ?? strokeWidthOptions[0]
                onStrokeWidthChange(nextWidth)
              }}
              style={{ width: '148px' }}
            />
            <div style={{
              minWidth: '38px',
              textAlign: 'right',
              fontSize: '12px',
              fontWeight: 600,
              color: '#111',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {strokeWidth}px
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#111',
                cursor: canUndo ? 'pointer' : 'not-allowed',
                opacity: canUndo ? 0.85 : 0.3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.2s ease'
              }}
              title="Undo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H5v4" />
                <path d="M4 9a8 8 0 1 1 2.37 5.66" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleClear}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#111',
                cursor: 'pointer',
                opacity: 0.85,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.2s ease'
              }}
              title="Clear canvas"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="4" width="14" height="16" rx="1.5" />
                <path d="M9 9l6 6" />
                <path d="M15 9l-6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            width: `${scaledWidth * responsiveScale}px`,
            height: `${scaledHeight * responsiveScale}px`,
            overflow: 'visible'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${CANVAS_WIDTH}px`,
              height: `${canvasHeight}px`,
              transform: `scale(${zoom * responsiveScale})`,
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
                zIndex: 1,
                pointerEvents: 'none'
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
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                border: '1px solid #ddd',
                cursor: 'crosshair',
                display: 'block',
                backgroundColor: '#fff',
                touchAction: 'none'
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

            {canSave && hoveredScissorY !== null && !cutAnimation && (
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

            {canSave && (
              <>
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
                    const relativeY = (event.clientY - rect.top) / (zoom * responsiveScale)
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
              </>
            )}
          </div>
        </div>

      <div
        style={{
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          display: 'flex',
          alignItems: 'center',
          zIndex: 100
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: '999px',
              border: '1px solid rgba(17, 24, 39, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              overflow: 'hidden'
            }}
          >
            <button
              type="button"
              onClick={() => setZoom((prev) => {
                const next = Number((prev - 0.25).toFixed(2))
                return Math.max(0.5, next)
              })}
              style={{
                width: '40px',
                padding: '6px 0',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#111',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1
              }}
              title="Zoom out"
            >
              -
            </button>
            <div
              onClick={() => setZoom(1)}
              style={{
                minWidth: '58px',
                textAlign: 'center',
                padding: '6px 0',
                borderLeft: '1px solid rgba(17, 24, 39, 0.08)',
                borderRight: '1px solid rgba(17, 24, 39, 0.08)',
                fontSize: '12px',
                fontWeight: 600,
                color: '#111',
                fontVariantNumeric: 'tabular-nums',
                cursor: Math.abs(zoom - 1) < 0.001 ? 'default' : 'pointer',
                opacity: Math.abs(zoom - 1) < 0.001 ? 0.6 : 1
              }}
              title={Math.abs(zoom - 1) < 0.001 ? 'Zoom is 100%' : 'Reset zoom to 100%'}
            >
              {Math.round(zoom * 100)}%
            </div>
            <button
              type="button"
              onClick={() => setZoom((prev) => {
                const next = Number((prev + 0.25).toFixed(2))
                return Math.min(2, next)
              })}
              style={{
                width: '40px',
                padding: '6px 0',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#111',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1
              }}
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}

export default CanvasWorkspace
