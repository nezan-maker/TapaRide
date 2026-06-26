import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import "./index.css"
import { AuthProvider, ProtectedRoute } from "./lib/auth"
import FloatingAssistant from "./components/FloatingAssistant"

import SiteLayout from "./components/SiteLayout";
import Landing from "./pages/Landing";
import SearchResults from "./pages/SearchResults";
import TripDetail from "./pages/TripDetail";
import Booking from "./pages/Booking";
import SendParcel from "./pages/SendParcel";
import Track from "./pages/Track";
import Confirmation from "./pages/Confirmation";
import ParcelConfirmation from "./pages/ParcelConfirmation";
import Support from "./pages/Support";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Journey from "./pages/Journey";
import Waitlist from "./pages/Waitlist";
import NoBuses from "./pages/booking/NoBuses";
import PaymentProcessing from "./pages/booking/PaymentProcessing";
import PaymentFailed from "./pages/booking/PaymentFailed";

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Otp from "./pages/auth/Otp";
import ForgotPassword from "./pages/auth/ForgotPassword";
import RegisterPasskey from "./pages/auth/RegisterPasskey";
import AcceptInvite from "./pages/auth/AcceptInvite";

import DashboardLayout from "./pages/dashboard/DashboardLayout";
import Dashboard from "./pages/dashboard/Dashboard";
import MyTrips from "./pages/dashboard/MyTrips";
import MyParcels from "./pages/dashboard/MyParcels";
import Notifications from "./pages/dashboard/Notifications";
import PaymentMethods from "./pages/dashboard/PaymentMethods";
import ReceiveParcel from "./pages/ReceiveParcel";
import Settings from "./pages/dashboard/Settings";

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/search", element: <SearchResults /> },
      { path: "/trip/:tripId", element: <TripDetail /> },
      { path: "/booking", element: <ProtectedRoute allowedRoles={['CLIENT']}><Booking /></ProtectedRoute> },
      { path: "/booking/processing", element: <ProtectedRoute allowedRoles={['CLIENT']}><PaymentProcessing /></ProtectedRoute> },
      { path: "/booking/failed", element: <ProtectedRoute allowedRoles={['CLIENT']}><PaymentFailed /></ProtectedRoute> },
      { path: "/booking/confirmation", element: <ProtectedRoute allowedRoles={['CLIENT']}><Confirmation /></ProtectedRoute> },
      { path: "/no-buses", element: <ProtectedRoute allowedRoles={['CLIENT']}><NoBuses /></ProtectedRoute> },
      { path: "/journey", element: <ProtectedRoute allowedRoles={['CLIENT', 'DRIVER', 'MANAGER', 'OWNER']}><Journey /></ProtectedRoute> },
      { path: "/waitlist", element: <ProtectedRoute allowedRoles={['CLIENT']}><Waitlist /></ProtectedRoute> },
      { path: "/send-parcel", element: <ProtectedRoute allowedRoles={['CLIENT']}><SendParcel /></ProtectedRoute> },
      { path: "/parcel/confirmation", element: <ProtectedRoute allowedRoles={['CLIENT']}><ParcelConfirmation /></ProtectedRoute> },
      { path: "/receive", element: <ReceiveParcel /> },
      { path: "/parcels/receive", element: <ReceiveParcel /> },
      { path: "/track", element: <ProtectedRoute allowedRoles={['CLIENT', 'DRIVER', 'MANAGER', 'OWNER', 'ORGANIZATION']}><Track /></ProtectedRoute> },
      { path: "/support", element: <Support /> },
    ],
  },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/verify-otp", element: <Otp /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/register-passkey", element: <RegisterPasskey /> },
  { path: "/accept-invite", element: <AcceptInvite /> },
  {
    path: "/onboarding",
    element: <ProtectedRoute allowedRoles={['OWNER']}><Onboarding /></ProtectedRoute>,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute allowedRoles={['CLIENT', 'DRIVER', 'MANAGER', 'OWNER', 'ORGANIZATION']}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "trips", element: <MyTrips /> },
      { path: "parcels", element: <MyParcels /> },
      { path: "notifications", element: <Notifications /> },
      { path: "payments", element: <PaymentMethods /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <FloatingAssistant />
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
