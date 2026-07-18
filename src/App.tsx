import {
  Navigate,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { RequireAdministrator } from "./components/RequireAdministrator";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminLayout } from "./pages/AdminLayout";
import { ArchivedRoomsPage } from "./pages/ArchivedRoomsPage";
import { FirebaseTestPage } from "./pages/FirebaseTestPage";
import { HomePage } from "./pages/HomePage";
import { ManagementPage } from "./pages/ManagementPage";
import { PresentationPage } from "./pages/PresentationPage";
import { QuizLibraryPage } from "./pages/QuizLibraryPage";
import { WaitingRoomPage } from "./pages/WaitingRoomPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootPage />} />

      <Route path="/apresentacao" element={<LegacyPresentationRedirect />} />

      <Route path="/login" element={<AdminLoginPage />} />

      <Route
        path="/admin"
        element={
          <RequireAdministrator>
            <AdminLayout />
          </RequireAdministrator>
        }
      >
        <Route index element={<ManagementPage />} />
        <Route path="quizzes" element={<QuizLibraryPage />} />
        <Route path="room/:id" element={<WaitingRoomPage />} />
        <Route path="archive" element={<ArchivedRoomsPage />} />
        <Route path="firebase-test" element={<FirebaseTestPage />} />
      </Route>

      <Route
        path="/firebase-test"
        element={<Navigate to="/admin/firebase-test" replace />}
      />
      <Route path="/gerenciar" element={<Navigate to="/admin" replace />} />
      <Route
        path="/gerenciar/quizzes"
        element={<Navigate to="/admin/quizzes" replace />}
      />
      <Route path="/gerenciar/sala/:id" element={<LegacyAdminRoomRedirect />} />
      <Route
        path="/gerenciar/salas-arquivadas"
        element={<Navigate to="/admin/archive" replace />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LegacyPresentationRedirect() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("room") ?? searchParams.get("sala");

  return <Navigate to={gameId ? `/?room=${gameId}` : "/"} replace />;
}

function RootPage() {
  const [searchParams] = useSearchParams();

  return searchParams.get("room") ? <PresentationPage /> : <HomePage />;
}

function LegacyAdminRoomRedirect() {
  const { id } = useParams();

  return <Navigate to={id ? `/admin/room/${id}` : "/admin"} replace />;
}
