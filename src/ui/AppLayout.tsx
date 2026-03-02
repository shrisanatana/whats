import { NavLink, Outlet } from 'react-router-dom'
import { cn } from './cn'

const navItems: Array<{ to: string; label: string }> = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/chats', label: 'Chats / CRM' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/groups', label: 'Groups' },
  { to: '/assistant', label: 'AI Assistant' },
  { to: '/rules', label: 'Automation Rules' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/settings', label: 'Settings' }
]

export function AppLayout() {
  return (
    <div className="h-full w-full bg-neutral-950 text-neutral-50">
      <div className="flex h-full">
        <aside className="w-[260px] border-r border-neutral-800 bg-neutral-950">
          <div className="px-4 py-4">
            <div className="text-sm font-semibold tracking-wide text-neutral-100">Whats AI CRM</div>
            <div className="mt-1 text-xs text-neutral-400">Desktop</div>
          </div>
          <nav className="px-2 pb-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'mb-1 block rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-neutral-50',
                    isActive && 'bg-neutral-900 text-neutral-50'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-5 py-3">
            <div className="text-sm text-neutral-200">AI WhatsApp CRM</div>
            <div className="text-xs text-neutral-400">MVP scaffold</div>
          </header>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

