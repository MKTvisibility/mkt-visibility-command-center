import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ClientReportPortal from './ClientReportPortal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('clientReport')?<ClientReportPortal/>:<App/>}
  </StrictMode>,
)
