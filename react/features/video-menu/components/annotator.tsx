// annotator.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import Whiteboard from '../../whiteboard/components/web/Whiteboard';
import { ExcalidrawApp } from '@jitsi/excalidraw';
import { WHITEBOARD_UI_OPTIONS } from '../../whiteboard/constants';

//import '../../whiteboard/reducer';
//import '../../base/participants/reducer';

//import store from './store'; // <-- adjust this path as needed

function waitForAppStore(timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const store = window.APP?.store;
      if (store) {
        resolve(store);
      } else if (Date.now() - start > timeout) {
        reject(new Error('Timed out waiting for APP.store'));
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

export function openAnnotator(containerOrId: HTMLElement | string) {
  //const container =
  //  typeof containerOrId === 'string'
  //    ? document.getElementById(`participant_${containerOrId}`)
  //    : containerOrId;

  const container = document.getElementById(`largeVideoWrapper`);


  if (!container || (container as any)._annotatorMounted) return;
  (container as any)._annotatorMounted = true;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '9999',
    pointerEvents: 'auto',
    display: 'block',
    opacity: '50%',
    backgroundColor: 'transparent'
  });

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

  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  container.appendChild(overlay);
/*
  waitForAppStore().then(store => {
    ReactDOM.render(
      <Provider store={store}>
        <Whiteboard />
      </Provider>,
      overlay
    );
  }).catch(err => {
    console.error('Failed to load APP.store:', err);
  });
}
*/

  const style = document.createElement('style');
  style.textContent = 
    `.excalidraw,
    .excalidraw-wrapper,
    .excalidraw .excalidraw-canvas,
    .excalidraw-container,
    .excalidraw .layer-ui__wrapper,
    .excalidraw .scroll-container {
      background-color: transparent !important;
    }

    .excalidraw .layer-ui__wrapper {
      position: absolute !important;
      top: 0 !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 100vw !important;
      height: 100% !important;
    }`;
  document.head.appendChild(style);


  waitForAppStore().then(store => {
    ReactDOM.render(
      <Provider store={store}>
        <ExcalidrawApp
          collabDetails={undefined} // or skip this entirely
          collabServerUrl={undefined}
          excalidraw={{
            isCollaborating: false, // disable collaboration
            theme: 'light',
            UIOptions: WHITEBOARD_UI_OPTIONS,
            initialData: {
              appState: {
                viewBackgroundColor: 'transparent'
              }
            }
          }}
        />
      </Provider>,
      overlay
    );
  }).catch(err => {
    console.error('Failed to load APP.store:', err);
  });
} 