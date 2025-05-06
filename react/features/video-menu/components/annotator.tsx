import React from 'react';
import ReactDOM from 'react-dom';
import Whiteboard from '../../whiteboard/components/web/Whiteboard';

/**
 * Overlay a transparent whiteboard on the given video tile.
 * @param {HTMLElement|string} containerOrId  Video DOM node or participantID
 */
export function openAnnotator(containerOrId: HTMLElement | string) {
  const container =
    typeof containerOrId === 'string'
      ? document.getElementById(`participant_${containerOrId}`)
      : containerOrId;

  if (!container || (container as any)._annotatorMounted) return;
  (container as any)._annotatorMounted = true;

  // 1) Create overlay div
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute',
    top:      '0',
    left:     '0',
    width:    '100%',
    height:   '100%',
    zIndex:   '9999',
    pointerEvents: 'auto'
  });

  // 2) Add a close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top:      '4px',
    right:    '4px',
    zIndex:   '10000'
  });
  closeBtn.onclick = () => {
    ReactDOM.unmountComponentAtNode(overlay);
    overlay.remove();
    (container as any)._annotatorMounted = false;
  };
  overlay.appendChild(closeBtn);

  // 3) Ensure the video tile is positioned relative
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // 4) Mount overlay & render Whiteboard
  container.appendChild(overlay);
  ReactDOM.render(<Whiteboard />, overlay);
}
