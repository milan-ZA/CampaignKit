import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { supabaseConfigured } from './lib/supabase'
import './index.css'

function SetupNeeded() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl">CampaignKit needs its Supabase settings</h1>
      <p className="mt-3">
        Create a <code>.env.local</code> file with <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{' '}
        (see <code>.env.example</code>), then restart the dev server.
      </p>
    </main>
  )
}

// A data router (rather than <BrowserRouter>) so pages can use useBlocker for "Leave without saving?".
const router = createBrowserRouter([{ path: '*', element: <App /> }])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      {supabaseConfigured ? (
        <RouterProvider router={router} />
      ) : (
        <SetupNeeded />
      )}
    </ThemeProvider>
  </StrictMode>,
)
