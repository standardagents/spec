import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { Layout } from './components/Layout'
import { DocPage } from './pages/DocPage'
import { latestVersion, getDefaultPage } from './lib/content'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// Get default page for redirect
const defaultPage = getDefaultPage(latestVersion)
const defaultPath = defaultPage
  ? `/${latestVersion}/${defaultPage.group}/${defaultPage.slug}`
  : `/${latestVersion}`

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Layout routes */}
          <Route element={<Layout />}>
            {/* Redirect root to latest version's default page */}
            <Route path="/" element={<Navigate to={defaultPath} replace />} />

            {/* Version root redirects to default page */}
            <Route path="/:version" element={<DocPage />} />

            {/* Full path with version, group, and slug */}
            <Route path="/:version/:group/:slug" element={<DocPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
