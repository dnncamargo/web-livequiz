import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAdministrator } from "./components/RequireAdministrator";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { ArchivedRoomsPage } from "./pages/ArchivedRoomsPage";
import { FirebaseTestPage } from "./pages/FirebaseTestPage";
import { HomePage } from "./pages/HomePage";
import { ManagementPage } from "./pages/ManagementPage";
import { PresentationPage } from "./pages/PresentationPage";
import { WaitingRoomPage } from "./pages/WaitingRoomPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route path="/apresentacao" element={<PresentationPage />} />

      <Route path="/login" element={<AdminLoginPage />} />

      <Route
        path="/firebase-test"
        element={
          <RequireAdministrator>
            <FirebaseTestPage />
          </RequireAdministrator>
        }
      />

      <Route
        path="/gerenciar"
        element={
          <RequireAdministrator>
            <ManagementPage />
          </RequireAdministrator>
        }
      />

      <Route
        path="/gerenciar/sala/:id"
        element={
          <RequireAdministrator>
            <WaitingRoomPage />
          </RequireAdministrator>
        }
      />

      <Route
        path="/gerenciar/salas-arquivadas"
        element={
          <RequireAdministrator>
            <ArchivedRoomsPage />
          </RequireAdministrator>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
