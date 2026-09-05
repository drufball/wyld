import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCatchup, postSeen } from './api/client.js';

export function CatchUpGate({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const location = useLocation();
  const pathname = useRef(location.pathname);
  pathname.current = location.pathname;
  const navigate = useNavigate();

  const check = useCallback(() => {
    void getCatchup()
      .then((view) => {
        if (view.show) {
          if (pathname.current !== '/catch-up') navigate('/catch-up', { replace: true });
        } else {
          void postSeen().catch(() => undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        setReady(true);
      });
  }, [navigate]);

  useEffect(() => {
    check();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [check]);

  return ready ? children : null;
}
