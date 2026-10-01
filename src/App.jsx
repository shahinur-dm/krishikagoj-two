import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider, useLang } from './context/LanguageContext'
import { SiteDataProvider } from './context/SiteDataContext'
import ProtectedRoute from './components/admin/ProtectedRoute'
import Layout from './Layout'
import HomePage from './pages/HomePage'
import CategoryPage from './pages/CategoryPage'
import ArticlePage from './pages/ArticlePage'
import SearchPage from './pages/SearchPage'
import VideosPage from './pages/VideosPage'
import PhotosPage from './pages/PhotosPage'
import EpaperPage from './pages/EpaperPage'
import LoginPage from './pages/admin/LoginPage'
import VisitorLoginPage from './pages/VisitorLoginPage'
import './styles/global.css'

const RegisterPage = lazy(() => import('./pages/admin/RegisterPage'))
const HomeLeadPage = lazy(() => import('./pages/admin/HomeLeadPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'))
const SubcategoriesPage = lazy(() => import('./pages/admin/SubcategoriesPage'))
const PostFormPage = lazy(() => import('./pages/admin/PostFormPage'))
const PostsListPage = lazy(() => import('./pages/admin/PostsListPage'))
const PhotoGalleryPage = lazy(() => import('./pages/admin/PhotoGalleryPage'))
const VideoGalleryPage = lazy(() => import('./pages/admin/VideoGalleryPage'))
const StaffPage = lazy(() => import('./pages/admin/StaffPage'))
const WritersPage = lazy(() => import('./pages/admin/WritersPage'))
const PasswordPage = lazy(() => import('./pages/admin/PasswordPage'))
const WebsiteSettingsPage = lazy(() => import('./pages/admin/WebsiteSettingsPage'))
const LiveTvPage = lazy(() => import('./pages/admin/LiveTvPage'))
const NamazPage = lazy(() => import('./pages/admin/NamazPage'))
const NoticePage = lazy(() => import('./pages/admin/NoticePage'))
const SocialPage = lazy(() => import('./pages/admin/SocialPage'))
const SeoPage = lazy(() => import('./pages/admin/SeoPage'))
const AdsPage = lazy(() => import('./pages/admin/AdsPage'))
const ImportantWebsitesPage = lazy(() => import('./pages/admin/ImportantWebsitesPage'))
const BreakingNewsPage = lazy(() => import('./pages/admin/BreakingNewsPage'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage'))
const UserFormPage = lazy(() => import('./pages/admin/UserFormPage'))
const RolesPage = lazy(() => import('./pages/admin/RolesPage'))
const PermissionsPage = lazy(() => import('./pages/admin/PermissionsPage'))
const LoginLogoPage = lazy(() => import('./pages/admin/LoginLogoPage'))
const TopicGridPage = lazy(() => import('./pages/admin/TopicGridPage'))
const AiSettingsPage = lazy(() => import('./pages/admin/AiSettingsPage'))
const FacebookSettingsPage = lazy(() => import('./pages/admin/FacebookSettingsPage'))
const OpinionAdminPage = lazy(() => import('./pages/admin/OpinionAdminPage'))
const PollAdminPage = lazy(() => import('./pages/admin/PollAdminPage'))
const SurveyAdminPage = lazy(() => import('./pages/admin/SurveyAdminPage'))
const CmsPageAdminPage = lazy(() => import('./pages/admin/CmsPageAdminPage'))
const SidebarSettingsPage = lazy(() => import('./pages/admin/SidebarSettingsPage'))
const LayoutTopicPage = lazy(() => import('./pages/admin/LayoutTopicPage'))
const LatestPopularAdminPage = lazy(() => import('./pages/admin/LatestPopularAdminPage'))
const CmsPageView = lazy(() => import('./pages/CmsPageView'))
const SurveyView = lazy(() => import('./pages/SurveyView'))

function AdminFallback() {
  const { t } = useLang()
  return (
    <div className="container py-5 text-center text-muted">
      {t.adminLoading}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
    <LanguageProvider>
    <AuthProvider>
    <SiteDataProvider>
        <Routes>
          <Route path="/login" element={<VisitorLoginPage />} />
          <Route path="/visitor/login" element={<VisitorLoginPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/register"
            element={
              <Suspense fallback={<AdminFallback />}>
                <RegisterPage />
              </Suspense>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Suspense fallback={<AdminFallback />}>
                  <AdminLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/home" replace />} />
            <Route path="home" element={<DashboardPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="subcategories" element={<SubcategoriesPage />} />
            <Route path="posts" element={<PostsListPage />} />
            <Route path="posts/new" element={<PostFormPage />} />
            <Route path="posts/:id" element={<PostFormPage />} />
            <Route path="photos" element={<PhotoGalleryPage />} />
            <Route path="videos" element={<VideoGalleryPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="writers" element={<WritersPage />} />
            <Route path="password" element={<PasswordPage />} />
            <Route path="website" element={<WebsiteSettingsPage />} />
            <Route path="login-logo" element={<LoginLogoPage />} />
            <Route path="livetv" element={<LiveTvPage />} />
            <Route path="namaz" element={<NamazPage />} />
            <Route path="notice" element={<NoticePage />} />
            <Route path="social" element={<SocialPage />} />
            <Route path="home-lead" element={<HomeLeadPage />} />
            <Route path="sidebars" element={<SidebarSettingsPage />} />
            <Route path="layout-topics" element={<LayoutTopicPage />} />
            <Route path="latest-popular" element={<LatestPopularAdminPage />} />
            <Route path="topic-grid" element={<TopicGridPage />} />
            <Route path="ai" element={<AiSettingsPage />} />
            <Route path="facebook-settings" element={<FacebookSettingsPage />} />
            <Route path="opinions" element={<OpinionAdminPage />} />
            <Route path="opinions/new" element={<OpinionAdminPage />} />
            <Route path="opinions/:id" element={<OpinionAdminPage />} />
            <Route path="polls" element={<PollAdminPage />} />
            <Route path="polls/new" element={<PollAdminPage />} />
            <Route path="polls/:id/results" element={<PollAdminPage />} />
            <Route path="polls/:id" element={<PollAdminPage />} />
            <Route path="surveys" element={<SurveyAdminPage />} />
            <Route path="surveys/new" element={<SurveyAdminPage />} />
            <Route path="surveys/:id/results" element={<SurveyAdminPage />} />
            <Route path="surveys/:id" element={<SurveyAdminPage />} />
            <Route path="pages" element={<CmsPageAdminPage />} />
            <Route path="pages/new" element={<CmsPageAdminPage />} />
            <Route path="pages/:id" element={<CmsPageAdminPage />} />
            <Route path="seo" element={<SeoPage />} />
            <Route path="ads" element={<AdsPage />} />
            <Route path="important-websites" element={<ImportantWebsitesPage />} />
            <Route path="breaking" element={<BreakingNewsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/new" element={<UserFormPage />} />
            <Route path="users/:id" element={<UserFormPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="permissions" element={<PermissionsPage />} />
          </Route>

          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="category/:slug" element={<CategoryPage />} />
            <Route path="news/:id" element={<ArticlePage />} />
            <Route path="epaper" element={<EpaperPage />} />
            <Route path="videos" element={<VideosPage />} />
            <Route path="photos" element={<PhotosPage />} />
            <Route path="page/:slug" element={<CmsPageView />} />
            <Route path="survey" element={<SurveyView />} />
            <Route path="survey/:id" element={<SurveyView />} />
          </Route>
        </Routes>
    </SiteDataProvider>
    </AuthProvider>
    </LanguageProvider>
    </BrowserRouter>
  )
}
