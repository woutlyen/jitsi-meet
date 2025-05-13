// annotator.tsx
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH: string;
  }
}

// Set the asset path before importing Excalidraw
//window.EXCALIDRAW_ASSET_PATH = 'https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/';
window.EXCALIDRAW_ASSET_PATH = '/libs/dev/'

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

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

  // append before sizing so it participates in layout if needed
  container.appendChild(overlay);
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // Function to size & position overlay to match video
  function updateOverlay() {
    const cRect = container.getBoundingClientRect();    // ← container, not video
    const vRect = videoEl.getBoundingClientRect();
    overlay.style.left   = `${vRect.left - cRect.left}px`;
    overlay.style.top    = `${vRect.top  - cRect.top }px`;
    overlay.style.width  = `${vRect.width}px`;
    overlay.style.height = `${vRect.height}px`;
  }

  // initial
  updateOverlay();

  // watch for resize
  const ro = new ResizeObserver(updateOverlay);
  ro.observe(videoEl);
  window.addEventListener('resize', updateOverlay);

  // close button
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
    //ro.disconnect();
    //window.removeEventListener('resize', updateOverlay);
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

  // render whiteboard
  waitForAppStore()
    .then(store => {
      ReactDOM.render(
        <Provider store={store}>
          <Excalidraw
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
          />
        </Provider>,
        wrapper
      );

      // === POST-RENDER FIX: hoist static canvas out of its wrapper ===
      // Observe changes in the wrapper DOM to catch when the canvas gets mounted
      const observer = new MutationObserver(() => {
        const canvasWrapper = wrapper.querySelector('.excalidraw__canvas-wrapper');
        const staticCanvas = canvasWrapper?.querySelector('canvas.excalidraw__canvas.static');

        if (canvasWrapper && staticCanvas && canvasWrapper.parentElement) {
          // Move static canvas out and remove wrapper
          canvasWrapper.parentElement.insertBefore(staticCanvas, canvasWrapper);
          canvasWrapper.remove();
          observer.disconnect(); // Stop observing once done
        }
      });

      // Start observing for DOM changes inside wrapper
      observer.observe(wrapper, {
        childList: true,
        subtree: true,
      });
    })
    .catch(err => console.error(err));
}
