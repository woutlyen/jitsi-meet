// annotator.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
//import store from './store'; // <-- adjust this path as needed
import { APP } from '../../../index.web'; // adjust path
import Whiteboard from '../../whiteboard/components/web/Whiteboard';

const store = APP.store;

export function openAnnotator(containerOrId: HTMLElement | string) {
  const container =
    typeof containerOrId === 'string'
      ? document.getElementById(`participant_${containerOrId}`)
      : containerOrId;

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
    pointerEvents: 'auto'
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
  ReactDOM.render(
    <Provider store={store}>
      <Whiteboard />
    </Provider>,
    overlay
  );
}
