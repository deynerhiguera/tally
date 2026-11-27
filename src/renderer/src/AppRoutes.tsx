import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { TodayPage } from './pages/TodayPage'
import { MonthPage } from './pages/MonthPage'
import { HabitsPage } from './pages/HabitsPage'
import { HabitDetailPage } from './pages/HabitDetailPage'
import { SettingsPage } from './pages/SettingsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="month" element={<MonthPage />} />
        <Route path="habits" element={<HabitsPage />} />
        <Route path="habits/:habitId" element={<HabitDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
