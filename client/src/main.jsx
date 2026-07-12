import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
const cardNumber = Math.floor(Math.random() * 15) + 1;
document.documentElement.style.setProperty('--card-bg', `url('/cards/${cardNumber}.png')`);
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
