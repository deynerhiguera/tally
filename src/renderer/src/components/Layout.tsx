import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useApi } from '../api/useApi'
import { useDemo } from '../api/useDemo'

const links = [
  { to: '/', label: 'Today', end: true },
  { to: '/month', label: 'Month', end: false },
  { to: '/habits', label: 'Habits', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

export function Layout() {
  const { enabled: demo } = useDemo()
  const api = useApi()
  const navigate = useNavigate()

  // The platform can ask for a screen, e.g. Today when a reminder notification is clicked.
  useEffect(
    () =>
      api.app.onNavigate((path) => {
        if (path.startsWith('/')) void navigate(path)
      }),
    [api, navigate],
  )
  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">Tally</div>
        {demo && (
          <NavLink
            to="/settings"
            className="demo-badge"
            title="Showing example data. Turn it off in Settings."
          >
            Demo data
          </NavLink>
        )}
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className="nav-link">
            {link.label}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
