import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import { MenuProvider } from "./context/MenuContext";
import { AuthProvider } from "./context/AuthContext";
import { PeriodProvider } from "./context/PeriodContext";
import DialogProvider from "./context/DialogProvider";
import { UnsavedChangesProvider } from "./context/UnsavedChangesContext";
import PrivateRoute from "./components/PrivateRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DataDesa from "./pages/DataDesa";
import BPKal from "./pages/BPKal";
import KriteriaBobot from "./pages/KriteriaBobot";
import PerhitunganAHP from "./pages/PerhitunganAHP";
import PerhitunganMOORA from "./pages/PerhitunganMOORA";
import PeringkatHasil from "./pages/PeringkatHasil";
import PraKalkulasi from "./pages/PraKalkulasi";
import DetailPeringkat from "./pages/DetailPeringkat";
import Periods from "./pages/Periods";
import Users from "./pages/Users";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PeriodProvider>
          <DialogProvider>
            <UnsavedChangesProvider>
              <MenuProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/desa" element={<DataDesa />} />
                    <Route path="/bpkal" element={<BPKal />} />
                    <Route path="/kriteria" element={<KriteriaBobot />} />
                    <Route path="/ahp" element={<PerhitunganAHP />} />
                    <Route path="/moora" element={<PerhitunganMOORA />} />
                    <Route path="/pra-kalkulasi" element={<PraKalkulasi />} />
                    <Route path="/periods" element={<Periods />} />
                    <Route path="/peringkat" element={<PeringkatHasil />} />
                    <Route path="/peringkat/:id" element={<DetailPeringkat />} />
                    <Route path="/pengguna" element={<Users />} />
                  </Route>
                </Routes>
              </MenuProvider>
            </UnsavedChangesProvider>
          </DialogProvider>
        </PeriodProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;