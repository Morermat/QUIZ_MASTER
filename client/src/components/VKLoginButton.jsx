import { useEffect, useRef } from 'react';

export default function VKLoginButton({ onSuccess, onError }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const initVKID = () => {
      const VKID = window.VKIDSDK;
      if (!VKID) {
        console.warn('VKID SDK not loaded');
        return;
      }

      const redirectUri = import.meta.env.VITE_VK_REDIRECT_URI || 'https://abc123.loca.lt/auth/vk-callback';

      VKID.Config.init({
        app: Number(import.meta.env.VITE_VK_CLIENT_ID) || 54674075,
        redirectUrl: redirectUri,
        responseMode: VKID.ConfigResponseMode.Redirect,
        source: VKID.ConfigSource.LOWCODE,
        scope: 'email vkid.personal_info',
        mode: VKID.ConfigAuthMode.Redirect,
      });

      const oneTap = new VKID.OneTap();

      if (containerRef.current) {
        oneTap.render({
          container: containerRef.current,
          showAlternativeLogin: true,
          scheme: VKID.Scheme.LIGHT,
          lang: VKID.Languages.RUS,
        })
        .on(VKID.WidgetEvents.ERROR, (error) => {
          console.error('VK ID Error:', error);
          onError?.(error);
        })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, function (payload) {
          const code = payload.code;
          const deviceId = payload.device_id;

          VKID.Auth.exchangeCode(code, deviceId)
            .then((data) => {
              handleVKLogin(data);
            })
            .catch((error) => {
              console.error('Exchange code error:', error);
              onError?.(error);
            });
        });
      }
    };

    async function handleVKLogin(data) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/vk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: data.access_token,
            user_id: data.user_id,
          }),
        });
        const result = await response.json();
        if (result.user && result.token) {
          onSuccess?.(result);
        } else {
          onError?.(new Error('Не удалось получить данные пользователя'));
        }
      } catch (err) {
        onError?.(err);
      }
    }

    if (window.VKIDSDK) {
      initVKID();
    } else {
      const checkSDK = setInterval(() => {
        if (window.VKIDSDK) {
          clearInterval(checkSDK);
          initVKID();
        }
      }, 100);
      return () => clearInterval(checkSDK);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [onSuccess, onError]);

  return (
    <div 
      ref={containerRef} 
      id="VkIdSdkOneTap" 
      style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
    />
  );
}