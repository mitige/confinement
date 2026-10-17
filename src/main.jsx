import { createRoot } from 'react-dom/client'

// Self-hosted variable fonts: no third-party requests, no flash of fallback.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './styles/global.css'
import App from './App.jsx'

/*
 * Intentionally not wrapped in StrictMode.
 *
 * The scene allocates GPU resources imperatively — geometries, PMREM environment
 * maps, instanced matrices — and StrictMode's deliberate double-invocation of
 * effects would create and tear down each of those twice on every mount. For a
 * WebGL document like this one, dev-only double mounting diverges from production
 * behaviour rather than catching bugs in it.
 */
createRoot(document.getElementById('root')).render(<App />)