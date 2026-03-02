import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './ui/AppLayout'
import { DashboardPage } from './ui/pages/DashboardPage'
import { ChatsPage } from './ui/pages/ChatsPage'
import { ContactsPage } from './ui/pages/ContactsPage'
import { GroupsPage } from './ui/pages/GroupsPage'
import { AssistantPage } from './ui/pages/AssistantPage'
import { RulesPage } from './ui/pages/RulesPage'
import { CampaignsPage } from './ui/pages/CampaignsPage'
import { SettingsPage } from './ui/pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

