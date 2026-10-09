import './pixel-ui.css';
const dock=document.querySelector('.ui-dock'),toggle=document.querySelector('.ui-menu-toggle');
const compact=matchMedia('(max-width:700px), (max-height:660px)');
let opened=!compact.matches;
function render(){dock.dataset.open=String(opened);toggle.setAttribute('aria-expanded',String(opened));toggle.querySelector('[data-menu-symbol]').textContent=opened?'−':'+';}
function click(){opened=!opened;render();}
toggle.addEventListener('click',click);render();
if(import.meta.hot)import.meta.hot.dispose(()=>toggle.removeEventListener('click',click));
