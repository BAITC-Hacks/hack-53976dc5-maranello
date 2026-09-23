import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/manrope'
import App from './App'
import { WorkspaceProvider } from './workspace'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><WorkspaceProvider><App /></WorkspaceProvider></BrowserRouter></React.StrictMode>,
)
