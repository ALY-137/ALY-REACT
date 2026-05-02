import { useLayoutEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { auth } from "../../Banco/init-firebase";
import { registrarAuditLog } from "../Sistema/auditLogsApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOneOwnerComEntradaPublica,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";
import { getOrCreateNavigationId } from "../Espacos/trackableLinksApi";

const Navbar = ({ pages = [] }) => {
  const tabNodesRef = useRef(new Map());
  const previousRectsRef = useRef(new Map());
  const previousStatesRef = useRef(new Map());
  const tabFlipAnimationsRef = useRef(new Map());
  const tabOpeningTimersRef = useRef(new Map());
  const targetUsername = localStorage.getItem("targetUsername");
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const oneOwnerPublicaAtiva = isOneOwnerComEntradaPublica(configSistema);
  const temaSistema = String(configSistema?.temaPadraoSistema || "")
    .trim()
    .toUpperCase();
  const navbarCyberpinkEspecial = temaSistema === "CYBERPINK";
  const normalizeRouteValue = (value = "") =>
    decodeURIComponent(String(value || "").trim())
      .toLowerCase()
      .replace(/\/+$/, "");

  const activePath = normalizeRouteValue(window.location.pathname || "/") || "/";
  const activePage = normalizeRouteValue(window.location.pathname.split("/").pop() || "");

  const menu = pages.map((p) => ({
    ...p,
    tipo: p.isHome ? "home" : "add",
    rota: oneOwnerPublicaAtiva ? `/${p.nome}` : `/${targetUsername}/${p.nome}`,
    rotaNormalizada: normalizeRouteValue(
      oneOwnerPublicaAtiva ? `/${p.nome}` : `/${targetUsername}/${p.nome}`
    ),
    nomeNormalizado: normalizeRouteValue(p.nome),
  }));

  if ((!oneOwnerPublicaAtiva && !targetUsername) || !menu.length) return null;

  const activeItem =
    menu.find(
      (item) => item.rotaNormalizada === activePath || item.nomeNormalizado === activePage
    ) || menu[0];

  const inactiveItems = menu.filter((item) => item !== activeItem);
  const getTabId = (item, index) =>
    String(item.id_espaco || item.id || item.rotaNormalizada || item.nomeNormalizado || index);

  const getEspacoId = (item = {}) =>
    String(item.id_espaco || item.id || item.espacoId || item.nome || "").trim();

  const registrarTrocaEspaco = (destino = {}) => {
    const destinoId = getEspacoId(destino);
    const origemId = getEspacoId(activeItem);
    if (!destinoId || destinoId === origemId) return;

    const navigationId = getOrCreateNavigationId();
    const detail = {
      eventoTipo: "space_switch",
      eventoAcao: "navbar_tab",
      origemEspacoId: origemId || null,
      origemEspacoNome: String(activeItem?.nome || "").trim() || null,
      origemRota: activeItem?.rota || null,
      destinoEspacoId: destinoId,
      destinoEspacoNome: String(destino?.nome || "").trim() || null,
      destinoRota: destino?.rota || null,
      navigationId,
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aly:space-switch", { detail }));
    }

    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    void registrarAuditLog({
      action: "navegou_entre_espacos",
      entityType: "acesso",
      entityId: `space_switch:${navigationId}:${Date.now()}`,
      ownerUserId: String(destino?.ownerUserId || activeItem?.ownerUserId || "").trim(),
      espacoId: destinoId,
      espacoNome: String(destino?.nome || "").trim(),
      projectSystemKey: configSistema?.projectSystemKey || "",
      source: "navbar_tab",
      metadata: {
        auditCategory: "acessos",
        navigationId,
        origemEspacoId: detail.origemEspacoId,
        origemEspacoNome: detail.origemEspacoNome,
        origemRota: detail.origemRota,
        destinoEspacoId: detail.destinoEspacoId,
        destinoEspacoNome: detail.destinoEspacoNome,
        destinoRota: detail.destinoRota,
      },
    });
  };

  const navbarAnimationSignature = useMemo(
    () =>
      menu
        .map(
          (item, index) =>
            `${getTabId(item, index)}:${item === activeItem ? "active" : "inactive"}`
        )
        .join("|"),
    [menu, activeItem]
  );

  const triggerCyberpinkTabOpen = (node, tabId) => {
    if (!node || typeof window === "undefined") return;

    const previousTimer = tabOpeningTimersRef.current.get(tabId);
    if (previousTimer) {
      window.clearTimeout(previousTimer);
    }

    node.classList.remove("navbar-tab--opening");
    void node.offsetWidth;
    node.classList.add("navbar-tab--opening");

    const timerId = window.setTimeout(() => {
      const currentNode = tabNodesRef.current.get(tabId);
      currentNode?.classList.remove("navbar-tab--opening");
      tabOpeningTimersRef.current.delete(tabId);
    }, 420);

    tabOpeningTimersRef.current.set(tabId, timerId);
  };

  useLayoutEffect(() => {
    if (!navbarCyberpinkEspecial || typeof window === "undefined") return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const currentRects = new Map();
    const currentStates = new Map();
    tabNodesRef.current.forEach((node, tabId) => {
      if (!node) return;
      currentRects.set(tabId, node.getBoundingClientRect());
    });
    menu.forEach((item, index) => {
      const tabId = getTabId(item, index);
      currentStates.set(tabId, item === activeItem ? "active" : "inactive");
    });

    if (!previousRectsRef.current.size || reducedMotion) {
      previousRectsRef.current = currentRects;
      previousStatesRef.current = currentStates;
      return;
    }

    currentRects.forEach((currentRect, tabId) => {
      const previousRect = previousRectsRef.current.get(tabId);
      const previousState = previousStatesRef.current.get(tabId);
      const currentState = currentStates.get(tabId);
      const node = tabNodesRef.current.get(tabId);
      if (!previousRect || !node) return;

      const deltaX = previousRect.left - currentRect.left;
      const deltaY = previousRect.top - currentRect.top;
      const currentWidth = currentRect.width || 1;
      const currentHeight = currentRect.height || 1;
      const scaleX = previousRect.width / currentWidth;
      const scaleY = previousRect.height / currentHeight;
      const unchanged =
        Math.abs(deltaX) < 0.5 &&
        Math.abs(deltaY) < 0.5 &&
        Math.abs(scaleX - 1) < 0.01 &&
        Math.abs(scaleY - 1) < 0.01;

      if (unchanged) return;

      const becameActive = previousState === "inactive" && currentState === "active";
      const becameInactive = previousState === "active" && currentState === "inactive";
      const arcX = becameActive ? -44 : becameInactive ? 44 : deltaX * 0.2;
      const arcY = becameActive ? -6 : becameInactive ? -18 : deltaY * 0.12;
      const midScaleX = becameActive ? 1.04 : becameInactive ? 0.96 : 1;
      const midScaleY = becameActive ? 1.03 : becameInactive ? 0.97 : 1;

      const previousFlipAnimation = tabFlipAnimationsRef.current.get(tabId);
      previousFlipAnimation?.cancel();

      if (becameActive) {
        triggerCyberpinkTabOpen(node, tabId);
      }

      const flipAnimation = node.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
            transformOrigin: "center center",
            opacity: becameInactive ? 1 : 0.92,
          },
          {
            transform: `translate(${arcX}px, ${arcY}px) scale(${midScaleX}, ${midScaleY})`,
            transformOrigin: "center center",
            opacity: becameInactive ? 0.84 : 0.98,
          },
          {
            transform: "translate(0, 0) scale(1, 1)",
            transformOrigin: "center center",
            opacity: 1,
          },
        ],
        {
          duration: 460,
          easing: "cubic-bezier(0.2, 0.9, 0.22, 1)",
          fill: "both",
        }
      );
      tabFlipAnimationsRef.current.set(tabId, flipAnimation);
    });

    previousRectsRef.current = currentRects;
    previousStatesRef.current = currentStates;
  }, [navbarAnimationSignature, navbarCyberpinkEspecial]);

  useLayoutEffect(
    () => () => {
      tabFlipAnimationsRef.current.forEach((animation) => animation?.cancel());
      tabFlipAnimationsRef.current.clear();
      tabOpeningTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      tabOpeningTimersRef.current.clear();
    },
    []
  );

  const setTabNode = (tabId, node) => {
    if (node) {
      tabNodesRef.current.set(tabId, node);
      return;
    }
    tabNodesRef.current.delete(tabId);
  };

  const renderTab = (item, index, extraClassName = "", forceActive = false) => {
    const tabId = getTabId(item, index);
    const isActive =
      forceActive || item.rotaNormalizada === activePath || item.nomeNormalizado === activePage;
    const legacyClassName = navbarCyberpinkEspecial
      ? ""
      : isActive
        ? "optionsAbasFoco"
        : "optionsAbas";

    return (
      <Link
        key={tabId}
        ref={(node) => setTabNode(tabId, node)}
        data-navbar-tab-id={tabId}
        onClick={() => registrarTrocaEspaco(item)}
        className={
          isActive
            ? `navbar-tab navbar-tab--active ${legacyClassName} ${extraClassName}`.trim()
            : `navbar-tab ${legacyClassName} ${extraClassName}`.trim()
        }
        to={item.rota}
      >
        <span className="navbar-tab__content">
          {String(item.iconUrl || "").trim() ? (
            <img
              className="navbar-tab__icon"
              src={String(item.iconUrl || "").trim()}
              alt=""
              aria-hidden="true"
            />
          ) : null}
          <p>{item.nome}</p>
        </span>
      </Link>
    );
  };

  return (
    <div className={`menu-navbar${navbarCyberpinkEspecial ? " menu-navbar--cyberpink-split" : ""}`}>
      <div
        id="abas"
        className={`navbar-tabs${navbarCyberpinkEspecial ? " navbar-tabs--cyberpink" : ""}`}
      >
        {navbarCyberpinkEspecial ? (
          <>
            {!!inactiveItems.length && (
              <div className="navbar-tabs__other-row">
                {inactiveItems.map((item, index) =>
                  renderTab(item, index + 1, "navbar-tab--compact")
                )}
              </div>
            )}
            <div className="navbar-tabs__active-row">
              {renderTab(activeItem, 0, "navbar-tab--primary", true)}
            </div>
          </>
        ) : (
          menu.map((item, index) => renderTab(item, index))
        )}
      </div>
    </div>
  );
};

export default Navbar;
