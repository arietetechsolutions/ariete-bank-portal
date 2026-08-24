import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TOKEN_LINK_TYPES = ['invite', 'recovery', 'signup', 'magiclink'];

const AuthCallbackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Bail out when we are already on the page that consumes these tokens.
    //
    // Without this guard the effect re-entered forever: navigating to
    // /set-password carried the fragment along in the URL, the resulting
    // location change retriggered this effect (location is a dependency), the
    // fragment was still there, so it navigated again - hundreds of
    // navigations per second. A headless-browser run against production
    // saturated the tab and never settled, which is why an invitee reported
    // never seeing the "Set your password" form at all. The session had
    // already been established by then, so reopening the site later dropped
    // them straight into the dashboard with no password ever set.
    if (location.pathname === '/set-password') return;

    const hash = window.location.hash;
    if (!hash) return;

    const hashParams = new URLSearchParams(hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    if (accessToken && TOKEN_LINK_TYPES.includes(type ?? '')) {
      navigate(`/set-password${hash}`, { replace: true });
    }
  }, [navigate, location]);

  return null;
};

export default AuthCallbackHandler;
