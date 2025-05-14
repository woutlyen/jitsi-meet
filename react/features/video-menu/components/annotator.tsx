// annotator.tsx
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH: string;
    APP: any;
  }
}

const clientId = crypto.randomUUID();
const socket = new WebSocket('ws://localhost:1234'); // change if hosted

// Set the asset path before importing Excalidraw
window.EXCALIDRAW_ASSET_PATH = '/libs/dev/';

import React, { useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Excalidraw } from '@excalidraw/excalidraw';
import { WHITEBOARD_UI_OPTIONS } from '../../whiteboard/constants';

function waitForAppStore(timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      const store = window.APP?.store;
      if (store) {
        resolve(store);
      } else if (Date.now() - start > timeout) {
        reject(new Error('Timed out waiting for APP.store'));
      } else {
        requestAnimationFrame(check);
      }
    })();
  });
}

function WhiteboardCollaborator({ store }: { store: any }) {
  const excalRef = useRef<any>(null);
  const elementMapRef = useRef<Map<string, any>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [, forceUpdate] = React.useState({});

  //const userName = "User-" + clientId.slice(0, 4); // Customize naming if needed

  const getUserName = () => {
    const el = document.getElementById('localDisplayName');
    if (el && el.textContent?.trim()) {
      if (el.textContent.trim() !== "me") {
        return el.textContent.trim();
      }
    }
    return `User-${clientId.slice(0, 4)}`;
  };

  const cursorsRef = useRef<Map<string, { x: number, y: number, name: string, color: string }>>(new Map());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const userColorsRef = useRef<Map<string, string>>(new Map());

  const getRandomColor = () => {
    const colors = ['#c8a094', '#91dc90', '#b5c3fa', '#a190ff', '#e2c0ff', '#a6eccd', '#fd8794', '#f7cf83', '#ff88c6', '#908793', '#f1e983', '#9cb2dd'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const renderRemoteCursors = () => {
    return Array.from(cursorsRef.current.entries()).map(([id, cursor]) => (
      <div
        key={id}
        style={{
          position: 'absolute',
          left: cursor.x,
          top: cursor.y,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          background: cursor.color,
          color: '#000',
          padding: '2px 6px',
          fontSize: '12px',
          borderRadius: '4px',
          zIndex: 9999,
          boxShadow: '0 0 4px rgba(0, 0, 0, 0.3)',
          whiteSpace: 'nowrap',
        }}
      >
        {cursor.name}
      </div>
    ));
  };

  const broadcastElements = useCallback((newElements: readonly any[]) => {
    for (const el of newElements) {
      elementMapRef.current.set(el.id, el);
    }

    const payload = {
      type: 'sync',
      clientId,
      elements: Array.from(elementMapRef.current.values())
    };

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  const broadcastCursor = useCallback((x: number, y: number) => {
    const payload = {
      type: 'cursor',
      clientId,
      name: getUserName(),
      x,
      y,
    };
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      broadcastCursor(x, y);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [broadcastCursor]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'cursor' && data.clientId !== clientId) {
          const { x, y, name, clientId: senderId } = data;

          if (!userColorsRef.current.has(senderId)) {
            userColorsRef.current.set(senderId, getRandomColor());
          }

          cursorsRef.current.set(senderId, {
            x,
            y,
            name,
            color: userColorsRef.current.get(senderId)!
          });

          if (timeoutsRef.current.has(senderId)) {
            clearTimeout(timeoutsRef.current.get(senderId)!);
          }

          timeoutsRef.current.set(senderId, setTimeout(() => {
            cursorsRef.current.delete(senderId);
            forceUpdate({});
          }, 3000));

          forceUpdate({});
          return;
        }

        if (data.type === 'init') {
          for (const el of data.elements) {
            elementMapRef.current.set(el.id, el);
          }

          excalRef.current?.updateScene({
            elements: data.elements,
          });
        }

        if (data.type === 'sync' && data.clientId !== clientId) {
          for (const incomingEl of data.elements) {
            const existing = elementMapRef.current.get(incomingEl.id);

            if (!existing || incomingEl.version > existing.version) {
              elementMapRef.current.set(incomingEl.id, incomingEl);
            }
          }

          const mergedElements = Array.from(elementMapRef.current.values());
          excalRef.current?.updateScene({ elements: mergedElements });

          for (const el of mergedElements) {
            if (el.isDeleted) {
              elementMapRef.current.delete(el.id);
            }
          }
        }
      } catch (e) {
        console.warn('Invalid WS message', e);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const elements = excalRef.current?.getSceneElements() || [];
      broadcastElements(elements);
    }, 1000);
    return () => clearTimeout(timeout);
  }, []);

  const broadcastInterval = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = () => {
    if (broadcastInterval.current) return;
    broadcastInterval.current = setInterval(() => {
      const elements = excalRef.current?.getSceneElements() || [];
      broadcastElements(elements);
    }, 100);
  };

  const handlePointerUp = () => {
    if (broadcastInterval.current) {
      clearInterval(broadcastInterval.current);
      broadcastInterval.current = null;
    }

    const elements = excalRef.current?.getSceneElements() || [];
    broadcastElements(elements);
  };

  return (
    <Provider store={store}>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            excalRef.current = api;
          }}
          isCollaborating={true}
          theme="light"
          initialData={{
            elements: [],
            appState: {
              viewBackgroundColor: 'transparent',
              offsetLeft: 0,
              offsetTop: 0,
              zoom: { value: 1 } as any,
            },
          }}
          UIOptions={WHITEBOARD_UI_OPTIONS}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPaste={(data, event) => {
            requestAnimationFrame(() => {
              const elements = excalRef.current?.getSceneElements() || [];
              broadcastElements(elements);
            });
            return true;
          }}
        />
        {renderRemoteCursors()}
      </div>
    </Provider>
  );
}

export function openAnnotator(containerOrId: HTMLElement | string) {
  const container = typeof containerOrId === 'string'
    ? document.getElementById(`largeVideoWrapper`)
    : containerOrId;

  if (!container || (container as any)._annotatorMounted) return;
  (container as any)._annotatorMounted = true;

  // find the <video> inside
  const videoEl = container.querySelector('video');
  if (!videoEl) {
    console.warn('No <video> found inside container');
    return;
  }

  // create overlay
  const overlay = document.createElement('div');
  overlay.style.position       = 'absolute';
  overlay.style.pointerEvents  = 'auto';
  overlay.style.backgroundColor= 'transparent';
  overlay.style.zIndex         = '9999';
  overlay.style.overflow       = 'visible';

  container.appendChild(overlay);
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  function updateOverlay() {
    const cRect = container.getBoundingClientRect();
    const vRect = videoEl.getBoundingClientRect();
    overlay.style.left   = `${vRect.left - cRect.left}px`;
    overlay.style.top    = `${vRect.top  - cRect.top }px`;
    overlay.style.width  = `${vRect.width}px`;
    overlay.style.height = `${vRect.height}px`;
  }

  updateOverlay();
  const ro = new ResizeObserver(updateOverlay);
  ro.observe(videoEl);
  window.addEventListener('resize', updateOverlay);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '4px',
    right: '4px',
    zIndex: '10000'
  });
  closeBtn.onclick = () => {
    ReactDOM.unmountComponentAtNode(overlay);
    overlay.remove();
    (container as any)._annotatorMounted = false;
  };
  overlay.appendChild(closeBtn);

  const style = document.createElement('style');
  style.textContent = `
    .excalidraw .layer-ui__wrapper {
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: 100% !important;
      max-width: 100vw !important;
      height: 100% !important;
      max-height: 100vh !important;
    }`;
  document.head.appendChild(style);

  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    width: '100%',
    height: '100%',
    position: 'relative'
  });
  overlay.appendChild(wrapper);

  waitForAppStore()
    .then(store => {
      ReactDOM.render(
        <WhiteboardCollaborator store={store} />,
        wrapper
      );

      const observer = new MutationObserver(() => {
        const canvasWrapper = wrapper.querySelector('.excalidraw__canvas-wrapper');
        const staticCanvas = canvasWrapper?.querySelector('canvas.excalidraw__canvas.static');

        if (canvasWrapper && staticCanvas && canvasWrapper.parentElement) {
          canvasWrapper.parentElement.insertBefore(staticCanvas, canvasWrapper);
          canvasWrapper.remove();
          observer.disconnect();
        }
      });

      observer.observe(wrapper, {
        childList: true,
        subtree: true,
      });
    })
    .catch(err => console.error(err));
}
