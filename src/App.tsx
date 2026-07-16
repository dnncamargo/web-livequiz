import { Navigate, Route, Routes } from "react-router-dom";
import { FirebaseTestPage } from "./pages/FirebaseTestPage";
import { HomePage } from "./pages/HomePage";
import { ManagementPage } from "./pages/ManagementPage";
import { PresentationPage } from "./pages/PresentationPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/apresentacao" element={<PresentationPage />} />
      <Route path="/gerenciar" element={<ManagementPage />} />
      <Route path="/firebase-test" element={<FirebaseTestPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}