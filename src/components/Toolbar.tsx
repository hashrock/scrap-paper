import { Settings } from 'lucide-react'
import type { Mode } from '../types'

interface ToolbarProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
  onSettingsClick: () => void
  backgroundColor?: string
}

const tabs: Array<{ id: Mode; label: string }> = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'gallery', label: 'Gallery' }
]

const Toolbar = ({ mode, onModeChange, onSettingsClick, backgroundColor = '#f5f5f5' }: ToolbarProps) => {
  return (
    <div
      style={{
        backgroundColor: backgroundColor,
        position: 'relative',
        zIndex: 200,
        transition: 'background-color 0.3s ease'
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            padding: '4px'
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
                  padding: '6px 16px',
                  backgroundColor: isActive ? '#fff' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isActive ? '#111' : '#6b7280',
                  cursor: isActive ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                }}
                aria-pressed={isActive}
              >
                {tab.label}
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
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5'
            e.currentTarget.style.color = '#111'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#9ca3af'
          }}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  )
}

export default Toolbar
