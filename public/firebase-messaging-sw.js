/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

let backgroundMessaging = null;

function sanitizeString(value) {
  return String(value || "").trim();
}

function configValida(config) {
  return Boolean(
    sanitizeString(config?.apiKey) &&
      sanitizeString(config?.projectId) &&
      sanitizeString(config?.appId) &&
      sanitizeString(config?.messagingSenderId)
  );
}

function inicializarFirebaseMessaging(config = {}) {
  if (!configValida(config)) return;
  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }
  if (!backgroundMessaging) {
    backgroundMessaging = firebase.messaging();
    backgroundMessaging.onBackgroundMessage((payload) => {
      const title =
        sanitizeString(payload?.notification?.title) || "Nova solicitacao de desbloqueio";
      const body =
        sanitizeString(payload?.notification?.body) || "Abra o menu para revisar a solicitacao.";
      const link =
        sanitizeString(payload?.data?.link) || "/menu/admin/solicitacoes";

      self.registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: { link },
      });
    });
  }
}

self.addEventListener("message", (event) => {
  const data = event?.data || {};
  if (data?.type !== "INIT_FIREBASE_MESSAGING") return;
  inicializarFirebaseMessaging(data?.firebaseConfig || {});
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawLink = sanitizeString(event?.notification?.data?.link) || "/menu/admin/solicitacoes";
  const destino = rawLink.startsWith("http")
    ? rawLink
    : `${self.location.origin}${rawLink.startsWith("/") ? "" : "/"}${rawLink}`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(destino);
          return client.focus();
        }
      }
      return clients.openWindow(destino);
    })
  );
});
