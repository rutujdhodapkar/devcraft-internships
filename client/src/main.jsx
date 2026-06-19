import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        layout: { socialButtonsPlacement: 'bottom', showOptionalFields: false },
        elements: { footer: 'hidden', footerAction: 'hidden', headerTitle: 'hidden', headerSubtitle: 'hidden', dividerLine: 'hidden', dividerText: 'hidden', card: { boxShadow: 'none' }, formFieldRow: 'hidden', formField: 'hidden', form: { gap: '0' }, socialButtonsBlockButton: { backgroundColor: '#000', color: '#fff', border: 'none', fontWeight: 700 }, socialButtonsBlockButtonText: { color: '#fff' }, socialButtonsBlockButtonArrow: { display: 'none' } },
      }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
