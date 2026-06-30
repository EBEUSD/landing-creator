import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import StorePicker from './pages/StorePicker'
import ProjectsList from './pages/ProjectsList'
import Calendar from './pages/Calendar'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<StorePicker />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/store/:storeId" element={<ProjectsList />} />
        <Route path="/store/:storeId/editor" element={<App />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
