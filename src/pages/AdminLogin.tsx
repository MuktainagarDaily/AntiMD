import { Navigate } from 'react-router-dom';

// Admin login entry: preserve /admin/overview as destination
export default function AdminLogin() {
  return <Navigate to="/auth?next=%2Fadmin%2Foverview" replace />;
}

