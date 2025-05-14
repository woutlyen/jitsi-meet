// annotator.tsx
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH: string;
  }
}

const clientId = crypto.randomUUID();
const socket = new WebSocket('ws://localhost:1234');

window.EXCALIDRAW_ASSET_PATH = '/libs/dev/';

import React, { useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import throttle from 'lodash.throttle'; // ✅ Throttle broadcast to avoid spamming

import Whiteboard from '../../whiteboard/components/web/Whiteboard';
import { Excalidraw } from '@excalidraw/excalidraw';
import { WHITEBOARD_UI_OPTIONS } from '../../whiteboard/constants';

declare global {
  interface Window { APP: any; }
}

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

  // ✅ Broadcast safely and throttled
  const broadcastElements = useCallback(throttle((elements: readonly any[]) => {
    const clonedElements = elements.map(el => ({ ...el })); // ✅ Clone to avoid readonly issues

    console.log('[SEND]', clientId, clonedElements); // ✅ Logging

    const payload = {
      type: 'sync',
      clientId,
      elements: clonedElements
    };

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, 100), []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'sync' && data.clientId !== clientId) {
          console.log('[RECV]', clientId, '<--', data.clientId, data.elements); // ✅ Logging

          if (excalRef.current) {
            excalRef.current.updateScene({
              elements: data.elements.map(el => ({ ...el })) // ✅ Defensive clone
            });
          }
        }
      } catch (e) {
        console.warn('Invalid WS message', e);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, []);

  return (
    <Provider store={store}>
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
            zoom: { value: 1 } as any
          }
        }}
        UIOptions={WHITEBOARD_UI_OPTIONS}
        onChange={(elements) => {
          broadcastElements(elements);
        }}
      />
    </Provider>
  );
}

export function openAnnotator(containerOrId: HTMLElement | string) {
  const container = typeof containerOrId === 'string'
    ? document.getElementById(`largeVideoWrapper`)
    : containerOrId;

  if (!container || (container as any)._annotatorMounted) return;
  (container as any)._annotatorMounted = true;

  const videoEl = container.querySelector('video');
  if (!videoEl) {
    console.warn('No <video> found inside container');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.pointerEvents = 'auto';
  overlay.style.backgroundColor = 'transparent';
  overlay.style.zIndex = '9999';
  overlay.style.overflow = 'visible';

  container.appendChild(overlay);
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  function updateOverlay() {
    const cRect = container.getBoundingClientRect();
    const vRect = videoEl.getBoundingClientRect();
    overlay.style.left = `${vRect.left - cRect.left}px`;
    overlay.style.top = `${vRect.top - cRect.top}px`;
    overlay.style.width = `${vRect.width}px`;
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
