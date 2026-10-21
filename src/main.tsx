import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './ui/App'
import './styles/tokens.css'
import './styles/app.css'
import './styles/editor.css'
import 'katex/dist/katex.min.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
