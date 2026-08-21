import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthCallbackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      if (accessToken && (type === 'invite' || type === 'recovery' || type === 'signup' || type === 'magiclink')) {
        navigate(`/set-password${hash}`, { replace: true });
      }
    }
  }, [navigate, location]);

  return null;
};

export default AuthCallbackHandler;
