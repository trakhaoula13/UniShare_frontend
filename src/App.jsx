import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPasswordConfirm from "./pages/ResetPasswordConfirm";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ServerStatusBanner from "./components/ServerStatusBanner";
import { PageLoader } from "./components/Skeletons";
import { wakeServer } from "./services/api";

// Les pages de l'application sont chargees a la demande : le premier
// affichage est plus rapide (moins de code a telecharger au depart).
const loaders = {
  Dashboard: () => import("./pages/Dashboard"),
  Courses: () => import("./pages/Courses"),
  CourseDetail: () => import("./pages/CourseDetail"),
  Assignments: () => import("./pages/Assignments"),
  // Notes: () => import("./pages/Notes"),
  NoteDetail: () => import("./pages/NoteDetail"),
  Research: () => import("./pages/Research"),
  ResearchDetail: () => import("./pages/ResearchDetail"),
  Schedule: () => import("./pages/Schedule"),
  Todos: () => import("./pages/Todos"),
  Admin: () => import("./pages/Admin"),
  Profile: () => import("./pages/Profile"),
  AccessCodes: () => import("./pages/AccessCodes"),
};
const Dashboard = lazy(loaders.Dashboard);
const Courses = lazy(loaders.Courses);
const CourseDetail = lazy(loaders.CourseDetail);
const Assignments = lazy(loaders.Assignments);
const Notes = lazy(loaders.Notes);
const NoteDetail = lazy(loaders.NoteDetail);
const Research = lazy(loaders.Research);
const ResearchDetail = lazy(loaders.ResearchDetail);
const Schedule = lazy(loaders.Schedule);
const Todos = lazy(loaders.Todos);
const Admin = lazy(loaders.Admin);
const Profile = lazy(loaders.Profile);
const AccessCodes = lazy(loaders.AccessCodes);

function App() {
  useEffect(() => {
    // 1) Reveille le serveur (hebergement gratuit) des l'ouverture du site.
    wakeServer();

    // 2) Une fois connecte, precharge en douce les pages les plus utilisees.
    if (localStorage.getItem("token")) {
      const preload = () => ["Courses", "Notes", "Assignments", "Schedule", "Todos", "Dashboard"].forEach((k) => loaders[k]());
      if ("requestIdleCallback" in window) window.requestIdleCallback(preload, { timeout: 4000 });
      else setTimeout(preload, 2500);
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ServerStatusBanner />
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPasswordConfirm />} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute denyRoles={["viewonly"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="/courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="/assignments" element={<ProtectedRoute><Assignments /></ProtectedRoute>} />
            <Route path="/notes/:id" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
            <Route path="/research" element={<ProtectedRoute denyRoles={["viewonly"]}><Research /></ProtectedRoute>} />
            <Route path="/research/:id" element={<ProtectedRoute denyRoles={["viewonly"]}><ResearchDetail /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/todos" element={<ProtectedRoute denyRoles={["viewonly"]}><Todos /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/access-codes" element={<ProtectedRoute><AccessCodes /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </MotionConfig>
  );
}

export default App;