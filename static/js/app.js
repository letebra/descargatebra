// Entry point: shell + the module for this page (lobby, tool or content page).
import {PAGE} from './core.js';
import {initShell} from './shell.js';

initShell();
const app = document.getElementById('app');
const load = {lobby: () => import('./lobby.js'), tool: () => import('./tool-page.js'), page: () => import('./pages.js')};
(load[PAGE.page] || load.page)()
  .then(m => { app.classList.add('page-in'); return m.render(app, PAGE); })
  .catch(e => { console.error(e); app.innerHTML = '<div class="wrap ssr"><h1>Ups</h1><p>No se pudo cargar esta página. Recarga para intentarlo de nuevo.</p></div>'; });
