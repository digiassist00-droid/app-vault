// Unang tumatakbo. Hindi ito nag-i-import ng Firebase, kaya laging may makikita sa screen,
// kahit may problema sa config o sa pag-load ng Firebase.
import { isConfigured } from './config.js';

const root = document.getElementById('root');
const card = (title, html) => {
  root.innerHTML =
    '<div style="min-height:100vh;display:grid;place-items:center;padding:20px;background:#EDF0F5;font-family:Inter,system-ui,sans-serif;color:#0E1726">' +
    '<div style="max-width:560px;width:100%;background:#fff;border:1px solid #DFE5EE;border-radius:18px;padding:28px;box-shadow:0 10px 28px rgba(14,23,38,.08)">' +
    '<h1 style="margin:0 0 10px;font-size:22px">' + title + '</h1>' +
    '<div style="line-height:1.6;font-size:14.5px;color:#47546A">' + html + '</div></div></div>';
};
const code = (s) => '<code style="background:#F5F7FB;padding:1px 6px;border-radius:6px">' + s + '</code>';

if (location.protocol === 'file:') {
  card('Buksan sa pamamagitan ng web server',
    '<p>Hindi gumagana ang app kapag dinouble-click ang <b>index.html</b>, dahil hinaharang ng browser ang mga module sa <b>file://</b>.</p>' +
    '<p>Dalawang paraan:</p><ol><li>I-deploy sa Vercel (tingnan ang README), o</li>' +
    '<li>Sa folder na ito, patakbuhin ang ' + code('npx serve .') + ' o ' + code('python3 -m http.server 8000') + ', tapos buksan ang ' + code('http://localhost:8000') + '.</li></ol>' +
    '<p>Para sa localhost, idagdag ang <b>localhost</b> sa Firebase → Authentication → Settings → Authorized domains.</p>');
} else if (!isConfigured()) {
  card('Kulang pa ang Firebase config',
    '<p>Buksan ang ' + code('js/config.js') + ' at palitan ang lahat ng <b>PASTE_...</b> ng config ng Firebase web app mo.</p>' +
    '<p>Nasa Firebase Console → Project settings → Your apps → Web app → SDK setup and configuration. Pagkatapos, i-upload ulit sa GitHub at hintaying matapos ang Vercel deploy.</p>');
} else {
  card('Nilo-load…', '<p>Sandali lang.</p>');
  import('./main.js').catch((e) => {
    console.error(e);
    card('Hindi ma-load ang app',
      '<p>Hindi na-load ang Firebase o may error sa app. Tingnan ang koneksyon sa internet, ad-blocker, o firewall na humaharang sa <b>gstatic.com</b>.</p>' +
      '<p style="font-family:ui-monospace,monospace;font-size:12.5px;background:#F5F7FB;padding:10px;border-radius:10px;word-break:break-word">' +
      String((e && e.message) || e).replace(/</g, '&lt;') + '</p>');
  });
}
