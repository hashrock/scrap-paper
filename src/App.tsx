import { useState, useRef, useCallback } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import Konva from 'konva'
import './App.css'

interface DrawLine {
  tool: 'pen' | 'eraser'
  points: number[]
  strokeWidth: number
}

interface ScissorLine {
  y: number
}

type Tool = 'pen' | 'eraser'

const INITIAL_CANVAS_HEIGHT = 1200
const CANVAS_WIDTH = 800
const CANVAS_EXTEND_HEIGHT = 400

function App() {
  const [lines, setLines] = useState<DrawLine[]>([])
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT)
  const [tool, setTool] = useState<Tool>('pen')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [scissorLine, setScissorLine] = useState<ScissorLine | null>(null)
  const isDrawing = useRef(false)
  const isPanning = useRef(false)
  const stageRef = useRef<Konva.Stage>(null)

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Middle mouse button or Ctrl+click for panning
    if (e.evt.button === 1 || e.evt.ctrlKey) {
      isPanning.current = true
      return
    }

    isDrawing.current = true
    const stage = e.target.getStage()
    if (!stage) return

    const pos = stage.getPointerPosition()
    if (!pos) return

    // Get position relative to the stage (considering scale and position)
    const transform = stage.getAbsoluteTransform().copy().invert()
    const relativePos = transform.point(pos)

    setLines([...lines, { tool, points: [relativePos.x, relativePos.y], strokeWidth }])
  }, [lines, tool, strokeWidth])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning.current) {
      return
    }

    if (!isDrawing.current) return

    const stage = e.target.getStage()
    if (!stage) return

    const point = stage.getPointerPosition()
    if (!point) return

    // Get position relative to the stage (considering scale and position)
    const transform = stage.getAbsoluteTransform().copy().invert()
    const relativePos = transform.point(point)

    const lastLine = lines[lines.length - 1]
    if (!lastLine) return

    lastLine.points = lastLine.points.concat([relativePos.x, relativePos.y])
    setLines([...lines.slice(0, -1), lastLine])
  }, [lines])

  const handleMouseUp = useCallback(() => {
    isDrawing.current = false
    isPanning.current = false
  }, [])

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()

    const stage = stageRef.current
    if (!stage) return

    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const scaleBy = 1.1
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy

    // Limit zoom range
    const limitedScale = Math.max(0.1, Math.min(5, newScale))

    stage.scale({ x: limitedScale, y: limitedScale })

    const newPos = {
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    }

    stage.position(newPos)
  }, [])

  const handleSelectDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker()
      setDirectoryHandle(handle)
    } catch (err) {
      console.error('Directory selection cancelled or failed', err)
    }
  }

  const extendCanvas = () => {
    setCanvasHeight(canvasHeight + CANVAS_EXTEND_HEIGHT)
  }

  const handleScissorClick = (y: number) => {
    setScissorLine({ y })
  }

  const handleCut = async () => {
    if (!scissorLine || !directoryHandle) {
      alert('Please select a directory first')
      return
    }

    const stage = stageRef.current
    if (!stage) return

    // Create a temporary canvas for the upper part
    const upperCanvas = document.createElement('canvas')
    upperCanvas.width = CANVAS_WIDTH
    upperCanvas.height = scissorLine.y
    const upperCtx = upperCanvas.getContext('2d')

    if (!upperCtx) return

    // Fill with white background
    upperCtx.fillStyle = 'white'
    upperCtx.fillRect(0, 0, CANVAS_WIDTH, scissorLine.y)

    // Draw the upper part of the lines
    lines.forEach(line => {
      upperCtx.beginPath()
      upperCtx.strokeStyle = line.tool === 'pen' ? 'black' : 'white'
      upperCtx.lineWidth = line.strokeWidth
      upperCtx.lineCap = 'round'
      upperCtx.lineJoin = 'round'

      for (let i = 0; i < line.points.length - 1; i += 2) {
        const x = line.points[i]
        const y = line.points[i + 1]

        if (y <= scissorLine.y) {
          if (i === 0) {
            upperCtx.moveTo(x, y)
          } else {
            upperCtx.lineTo(x, y)
          }
        }
      }
      upperCtx.stroke()
    })

    // Convert to blob and save
    upperCanvas.toBlob(async (blob) => {
      if (!blob) return

      const now = new Date()
      const filename = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.png`

      try {
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()

        // Filter lines to keep only the lower part
        const newLines = lines.map(line => {
          const newPoints: number[] = []
          for (let i = 0; i < line.points.length - 1; i += 2) {
            const x = line.points[i]
            const y = line.points[i + 1]
            if (y > scissorLine.y) {
              newPoints.push(x, y - scissorLine.y)
            }
          }
          return { ...line, points: newPoints }
        }).filter(line => line.points.length > 0)

        setLines(newLines)
        setCanvasHeight(canvasHeight - scissorLine.y)
        setScissorLine(null)
      } catch (err) {
        console.error('Failed to save file', err)
        alert('Failed to save file')
      }
    }, 'image/png')
  }

  const strokeWidthOptions = [1, 2, 4, 8, 16, 32, 64]

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#888',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '20px',
      boxSizing: 'border-box',
      overflow: 'auto'
    }}>
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => setTool('pen')}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'pen' ? '#333' : '#fff',
            color: tool === 'pen' ? '#fff' : '#333',
            border: '1px solid #333',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Pen
        </button>
        <button
          onClick={() => setTool('eraser')}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'eraser' ? '#333' : '#fff',
            color: tool === 'eraser' ? '#fff' : '#333',
            border: '1px solid #333',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Eraser
        </button>
        <div style={{ borderLeft: '1px solid #ccc', height: '30px', margin: '0 10px' }} />
        <label>Size:</label>
        {strokeWidthOptions.map(size => (
          <button
            key={size}
            onClick={() => setStrokeWidth(size)}
            style={{
              padding: '8px 12px',
              backgroundColor: strokeWidth === size ? '#333' : '#fff',
              color: strokeWidth === size ? '#fff' : '#333',
              border: '1px solid #333',
              borderRadius: '4px',
              cursor: 'pointer',
              minWidth: '40px'
            }}
          >
            {size}
          </button>
        ))}
        <div style={{ borderLeft: '1px solid #ccc', height: '30px', margin: '0 10px' }} />
        <button
          onClick={handleSelectDirectory}
          style={{
            padding: '8px 16px',
            backgroundColor: directoryHandle ? '#4CAF50' : '#fff',
            color: directoryHandle ? '#fff' : '#333',
            border: '1px solid #333',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {directoryHandle ? 'Directory Selected' : 'Select Directory'}
        </button>
        {scissorLine && (
          <button
            onClick={handleCut}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cut & Save
          </button>
        )}
      </div>

      <div style={{ position: 'relative', backgroundColor: '#fff' }}>
        <Stage
          width={CANVAS_WIDTH}
          height={canvasHeight}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onWheel={handleWheel}
          draggable
          ref={stageRef}
          style={{ backgroundColor: 'white' }}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.tool === 'pen' ? 'black' : 'white'}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
            {scissorLine && (
              <Line
                points={[0, scissorLine.y, CANVAS_WIDTH, scissorLine.y]}
                stroke="red"
                strokeWidth={2}
                dash={[10, 5]}
              />
            )}
          </Layer>
        </Stage>

        {/* Scissor buttons on the right edge */}
        <div style={{
          position: 'absolute',
          right: '-40px',
          top: 0,
          height: canvasHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly'
        }}>
          {Array.from({ length: Math.ceil(canvasHeight / 100) }).map((_, i) => {
            const y = (i + 1) * 100
            return (
              <button
                key={i}
                onClick={() => handleScissorClick(y)}
                style={{
                  width: '30px',
                  height: '30px',
                  backgroundColor: scissorLine?.y === y ? '#f44336' : '#fff',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
                title={`Cut at ${y}px`}
              >
                ✂️
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={extendCanvas}
        style={{
          padding: '12px 24px',
          backgroundColor: '#2196F3',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '24px',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        +
      </button>
    </div>
  )
}

export default App
