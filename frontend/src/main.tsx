import '@fontsource/antonio/400.css'
import '@fontsource/antonio/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import './index.css'
import { ImportPage } from './pages/Import'
import { Ops } from './pages/Ops'
import { Pipeline } from './pages/Pipeline'
import { ProspectPage } from './pages/Prospect'
import { Roster } from './pages/Roster'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Roster /> },
      { path: 'prospects/:id', element: <ProspectPage /> },
      { path: 'pipeline', element: <Pipeline /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'ops', element: <Ops /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
