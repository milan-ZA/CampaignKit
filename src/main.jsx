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
      <p className="mt-3">This copy of the app doesn't know which Supabase project to use. Two values are missing:</p>
      <ul className="mt-2 list-disc pl-6">
        <li>
          <code>VITE_SUPABASE_URL</code>, for example <code>https://your-project.supabase.co</code>
        </li>
        <li>
          <code>VITE_SUPABASE_ANON_KEY</code>, the public "anon" key
        </li>
      </ul>
      <p className="mt-3">Find both in Supabase → Project Settings → API.</p>
      <p className="mt-3">
        <strong>On your computer:</strong> copy <code>.env.example</code> to <code>.env.local</code>, fill them in and
        restart <code>npm run dev</code>.
      </p>
      <p className="mt-2">
        <strong>On a hosting service</strong> (Bolt, Netlify, Vercel…): add them as environment variables, then build and
        deploy again. They are read at build time.
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
