export default function ErrorPage({ message, onRetry }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
    >
      <img
        src="/error.jpg"
        alt="Error"
        style={{
          maxWidth: '90vw',
          maxHeight: '80vh',
          objectFit: 'contain',
        }}
      />
      {message && (
        <p style={{ color: '#fff', marginTop: '1rem', fontFamily: 'Arial, sans-serif', fontSize: '0.9rem', opacity: 0.7 }}>
          {message}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '1rem',
            padding: '0.6rem 2rem',
            background: '#fff',
            color: '#000',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
