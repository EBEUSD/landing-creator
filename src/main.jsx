import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { authReady } from './firebase'
import StorePicker from './pages/StorePicker'
import ProjectsList from './pages/ProjectsList'
import Calendar from './pages/Calendar'
import AllProjects from './pages/AllProjects'
import App from './App.jsx'

// Espera la sesión anónima antes de montar, así las primeras lecturas ya van autenticadas.
authReady.then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <HashRouter>
        <Routes>
          <Route path="/" element={<StorePicker />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/all-projects" element={<AllProjects />} />
          <Route path="/store/:storeId" element={<ProjectsList />} />
          <Route path="/store/:storeId/editor" element={<App />} />
        </Routes>
      </HashRouter>
    </StrictMode>,
  )
})
