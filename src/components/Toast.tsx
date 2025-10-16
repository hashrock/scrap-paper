interface ToastProps {
  message: string
}

const Toast = ({ message }: ToastProps) => (
  <div style={{
    position: 'fixed',
    bottom: '32px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#000',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease-in'
  }}>
    {message}
  </div>
)

export default Toast
