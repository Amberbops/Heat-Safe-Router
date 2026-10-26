import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { AuthProvider } from 'react-oidc-context';

const redirectUri =
  import.meta.env.VITE_OIDC_REDIRECT_URI ||
  (typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:5173/');

const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_hZDsLmIlK",
  client_id: "e77bkvfc5bqpgcvaepo4mj71v",
  redirect_uri: redirectUri,
  response_type: "code",
  scope: "phone openid email",
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
