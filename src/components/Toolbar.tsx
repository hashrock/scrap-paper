import { Settings } from 'lucide-react'
import type { Mode } from '../types'

interface ToolbarProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
  onSettingsClick: () => void
}

const tabs: Array<{ id: Mode; label: string }> = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'gallery', label: 'Gallery' }
]

const Toolbar = ({ mode, onModeChange, onSettingsClick }: ToolbarProps) => {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
        position: 'relative',
        zIndex: 200
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '12px 24px 0',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '36px',
            position: 'relative',
            paddingBottom: '12px'
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === mode
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onModeChange(tab.id)
                  }
                }}
                style={{
                  position: 'relative',
                  padding: '12px 0',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isActive ? '#111' : '#9ca3af',
                  cursor: isActive ? 'default' : 'pointer',
                  transition: 'color 0.2s ease'
                }}
                aria-pressed={isActive}
              >
                {tab.label}
                <span
                  style={{
                    position: 'absolute',
                    left: '-8px',
                    right: '-8px',
                    bottom: '-12px',
                    height: '2px',
                    borderRadius: '999px',
                    backgroundColor: isActive ? '#111' : 'transparent',
                    transition: 'background-color 0.2s ease'
                  }}
                />
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onSettingsClick}
          style={{
            position: 'absolute',
            right: '24px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '36px',
            height: '36px',
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
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  )
}

export default Toolbar
