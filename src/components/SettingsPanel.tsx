import { useCallback, useEffect, useState } from 'react'

interface KeyboardShortcuts {
  pen: string
  eraser: string
}

interface SettingsPanelProps {
  visible: boolean
  shortcuts: KeyboardShortcuts
  penColor: string
  backgroundColor: string
  onClose: () => void
  onShortcutChange: (key: keyof KeyboardShortcuts, value: string) => void
  onPenColorChange: (color: string) => void
  onBackgroundColorChange: (color: string) => void
}

const SettingsPanel = ({ visible, shortcuts, penColor, backgroundColor, onClose, onShortcutChange, onPenColorChange, onBackgroundColorChange }: SettingsPanelProps) => {
  const [editingShortcut, setEditingShortcut] = useState<keyof KeyboardShortcuts | null>(null)

  const penColorPresets = ['#000000', '#1a1a1a', '#8b0000', '#006400', '#00008b', '#4b0082', '#2f4f4f', '#8b4513']
  const backgroundColorPresets = ['#ffffff', '#f5f5dc', '#ffe4e1', '#e0f7e9', '#e6f3ff', '#fff8dc', '#f0e6ff', '#f5f5f5']

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!editingShortcut) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setEditingShortcut(null)
      return
    }

    if (event.key.length === 1) {
      event.preventDefault()
      onShortcutChange(editingShortcut, event.key.toLowerCase())
      setEditingShortcut(null)
    }
  }, [editingShortcut, onShortcutChange])

  useEffect(() => {
    if (visible && editingShortcut) {
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [visible, editingShortcut, handleKeyDown])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={() => {
        onClose()
        setEditingShortcut(null)
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          minWidth: '500px',
          maxWidth: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Settings</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6'
              e.currentTarget.style.color = '#111'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#111' }}>
              Keyboard Shortcuts
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                  Tool Switching
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(['pen', 'eraser'] as const).map((key) => (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: editingShortcut === key ? '#f0f9ff' : '#f9fafb',
                        borderRadius: '8px',
                        border: editingShortcut === key ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '14px', textTransform: 'capitalize', fontWeight: 500 }}>
                        {key}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingShortcut(key)}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#fff',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minWidth: '50px',
                          fontFamily: 'monospace',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#9ca3af'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db'
                        }}
                      >
                        {editingShortcut === key ? '...' : shortcuts[key].toUpperCase()}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {editingShortcut && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#1e40af',
                  textAlign: 'center',
                  fontWeight: 500
                }}>
                  Press any key to set shortcut, or ESC to cancel
                </div>
              )}

              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                  Other Shortcuts
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '13px',
                  color: '#6b7280',
                  padding: '12px 16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Undo</span>
                    <kbd style={{ fontWeight: 600, fontFamily: 'monospace', color: '#374151' }}>Cmd/Ctrl+Z</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Zoom in/out</span>
                    <kbd style={{ fontWeight: 600, fontFamily: 'monospace', color: '#374151' }}>+/-</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Reset zoom</span>
                    <kbd style={{ fontWeight: 600, fontFamily: 'monospace', color: '#374151' }}>0</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Stroke width</span>
                    <kbd style={{ fontWeight: 600, fontFamily: 'monospace', color: '#374151' }}>[/]</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Show settings</span>
                    <kbd style={{ fontWeight: 600, fontFamily: 'monospace', color: '#374151' }}>?</kbd>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#111' }}>
              Colors
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                  Pen Color
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {penColorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onPenColorChange(color)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        border: penColor === color ? '3px solid #3b82f6' : '2px solid #e5e7eb',
                        backgroundColor: color,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: penColor === color ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none'
                      }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={penColor}
                    onChange={(e) => onPenColorChange(e.target.value)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      cursor: 'pointer'
                    }}
                    title="Custom color"
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                  Background Color
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {backgroundColorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onBackgroundColorChange(color)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        border: backgroundColor === color ? '3px solid #3b82f6' : '2px solid #e5e7eb',
                        backgroundColor: color,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: backgroundColor === color ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none'
                      }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => onBackgroundColorChange(e.target.value)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      cursor: 'pointer'
                    }}
                    title="Custom color"
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#111' }}>
              About
            </h3>
            <div style={{
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: 1.6,
              padding: '12px 16px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px'
            }}>
              <p style={{ margin: '0 0 8px 0' }}>
                Scrap Paper - A simple drawing canvas with auto-save functionality.
              </p>
              <p style={{ margin: 0 }}>
                Draw freely, cut and save your drawings by clicking the ruler on the right edge.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
