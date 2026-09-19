import { createBrowserRouter, redirect } from 'react-router';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Home from './pages/Home';
import RecordingAction from './pages/RecordingAction';
import RecordDocuments from './pages/RecordDocuments';
import Databases from './pages/Databases';
import Setting from './pages/Setting';

// Loader to check authentication
function checkAuth() {
  const user = localStorage.getItem('user');
  if (!user) {
    throw redirect('/login');
  }
  return null;
}

// Loader for login page - redirect if already logged in
function checkLogin() {
  const user = localStorage.getItem('user');
  if (user) {
    throw redirect('/');
  }
  return null;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
    loader: checkLogin,
  },
  {
    path: '/',
    element: <Layout />,
    loader: checkAuth,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'recording-action',
        element: <RecordingAction />,
      },
      {
        path: 'record-documents',
        element: <RecordDocuments />,
      },
      {
        path: 'databases',
        element: <Databases />,
      },
      {
        path: 'setting',
        element: <Setting />,
      },
    ],
  },
]);
