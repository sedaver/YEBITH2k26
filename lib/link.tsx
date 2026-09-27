import React from 'react';
export function navigate(path:string){if(window.location.pathname+window.location.search!==path){window.history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));window.scrollTo(0,0);}}
export default function Link({onClick,href,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}){return <a {...props} href={href} onClick={e=>{onClick?.(e);if(!e.defaultPrevented&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&(!props.target||props.target==='_self')&&href.startsWith('/')&&!href.startsWith('//')){e.preventDefault();navigate(href);}}}/>;}

