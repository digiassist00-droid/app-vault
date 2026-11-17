# App Vault

Control center para sa lahat ng web app na ginawa mo: hosting, accounts, logins, API keys, .env, files, bayarin (may yellow at red na reminder), clients, renewals (domain/SSL/hosting) at update history.

- **Database:** Firebase Firestore (realtime)
- **Login:** Firebase Auth (email + password) + Google Authenticator (TOTP)
- **Roles:** Admin (ikaw) at Developer. Developer ay walang access sa Payments at Clients.
- **Deploy:** Vercel (static site, walang build step)
- **Secrets:** Ang password, API key, .env at files ay **naka-encrypt sa browser** (AES-256-GCM) gamit ang team passphrase. Ciphertext lang ang nakikita ng Firebase.

---

## 1. Firebase setup (mga 10 minuto)

1. Pumunta sa <https://console.firebase.google.com> → **Add project** (puwedeng i-off ang Analytics).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Google Authenticator (2FA).** Dalawang bahagi ito, at ayon sa opisyal na docs ng Firebase (<https://firebase.google.com/docs/auth/web/totp-mfa>), hindi ito simpleng toggle:
   1. Sa **Authentication**, i-**upgrade sa Identity Platform**. Maaaring humingi ito ng billing account, kaya tingnan muna ang presyo bago mag-confirm.
   2. **I-enable ang TOTP** gamit ang REST call. Buksan ang <https://console.cloud.google.com>, piliin ang parehong project, pindutin ang **Activate Cloud Shell** (kanang itaas), at i-paste ito. Palitan ang **dalawang** `PROJECT_ID` ng Project ID mo (nasa Firebase → Project settings):

```
curl -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/PROJECT_ID/config?updateMask=mfa" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: PROJECT_ID" \
  -d '{"mfa":{"providerConfigs":[{"state":"ENABLED","totpProviderConfig":{"adjacentIntervals":5}}]}}'
```

   Kapag may lumabas na `"state": "ENABLED"` sa sagot, tapos na. Kung may error, ipadala ang buong mensahe.
4. **Build → Firestore Database → Create database** (production mode, piliin ang pinakamalapit na region).
5. Sa Firestore, buksan ang **Rules** tab, i-paste ang buong laman ng `firestore.rules` mula sa folder na ito, at i-**Publish**.
6. **Project settings (gear) → Your apps → Web (`</>`)** → i-register ang app. Kopyahin ang `firebaseConfig`.
7. Buksan ang `js/config.js` at palitan ang mga `PASTE_...` ng nakuha mong config. Hindi ito sikreto. Ang rules ang nagbabantay ng data.

## 2. I-upload sa GitHub

1. Gumawa ng bagong **private** repo sa GitHub (halimbawa `app-vault`).
2. I-upload ang **laman** ng folder na ito (hindi ang zip mismo, at hindi ang mga folder ng CHANGELOG at reports na nasa labas ng `app-vault/`): `index.html`, `css/`, `js/`, `assets/`, `firestore.rules`, `vercel.json`, `package.json`, `README.md`, `tests/`.
   - Sa GitHub: **Add file → Upload files**, i-drag lahat, tapos **Commit changes**.

## 3. I-deploy sa Vercel

1. <https://vercel.com/new> → i-import ang repo.
2. **Framework Preset: Other.** Walang Build Command at walang Output Directory (iwanang blangko).
3. **Deploy.** Kunin ang URL (halimbawa `app-vault.vercel.app`).
4. Bumalik sa Firebase: **Authentication → Settings → Authorized domains → Add domain** at ilagay ang Vercel domain mo (at ang custom domain kung meron).

## 4. Unang gamit

1. Buksan ang site → **Join** → gamitin ang email mo. **Ang unang mag-join ang magiging Admin.** Public ang site, kaya **mag-Join ka agad pagka-deploy**, bago mo ibigay ang link kaninuman.
2. I-verify ang email (may dadating na link), tapos i-scan ang QR gamit ang **Google Authenticator** at ilagay ang 6-digit code. Mag-sign in ulit kapag hiningi.
3. Gumawa ng **team passphrase** (lalabas agad pagka-login ng admin). **Isulat ito at itago.** Hindi ito mababawi ng kahit sino, kasama ang Firebase at ako. Kapag nawala, hindi na mababasa ang mga naka-encrypt.
4. **Settings → Team** → i-invite ang email ng developer. Mag-Join siya gamit ang parehong email, mag-setup ng Authenticator, at ibigay mo sa kanya ang passphrase (hindi sa chat na may ibang tao).
5. Settings: ilagay ang pangalan ng negosyo, currency, at ang mga message template na gusto mo.

## Kapag blangko o may error na mensahe

- **Huwag i-double-click ang `index.html`.** Hindi ito gumagana sa `file://`. Gamitin ang Vercel URL, o sa folder ay `npx serve .` tapos buksan ang `http://localhost:3000` (idagdag ang `localhost` sa Firebase Authorized domains).
- **"This is not switched on in Firebase yet" (auth/operation-not-allowed) sa setup ng Authenticator:** hindi pa na-enable ang Email/Password (hakbang 2) o ang TOTP (hakbang 3).
- **"Kulang pa ang Firebase config":** hindi pa napapalitan ang `PASTE_...` sa `js/config.js`, o hindi pa na-upload ang bagong bersyon sa GitHub.
- **"Hindi ma-load ang app":** may humaharang sa `gstatic.com` (ad-blocker o firewall), o may error na ipinapakita sa ibaba ng mensahe.

## Mga feature

Dashboard at cash-flow chart · Apps (info, features, tags, archive) · GitHub, deployment at ibang accounts · Logins at API keys · .env at files (≤ 600 KB bawat isa) · Payments (subscription/one-time, partial, discount, late fee, history) · Resibo at invoice (Print / Save as PDF) · Billing message na isang pindot na kopya para sa Messenger/Viber · Clients · Domain / SSL / hosting renewals · Update log · Search (pindutin ang `/`) · CSV export · Full backup at Restore (admin) · Activity log (admin) · Clipboard na nabubura pagkalipas ng 30 segundo · Idle lock at auto sign-out · Dark mode.

## Backup at Restore (Settings → Export)

- **Full backup (JSON)** ay nagda-download ng lahat. Naka-encrypt pa rin ang password, key, .env at file. Plain text ang pangalan ng client, bayarin at petsa, kaya ingatan ang file.
- **Restore from backup** ay nagdadagdag lang ng mga item na **wala pa**. Hindi nito pinapalitan o binubura ang nandoon na, kaya hindi nito maibabalik ang mga pagbabago, mga nawalang item lang. Ang mga naibalik ay minarkahang gawa ng admin na nag-restore, at nasa loob ng item ang orihinal na gumawa.
- Hindi ito tatanggap ng backup na gawa sa **ibang passphrase** (halimbawa bago ka nagpalit ng passphrase), dahil hindi na mababasa ang mga secret. Hihinto ito at walang mababago.
- Kung bagong blangkong Firebase project, ibabalik din nito ang record ng team passphrase mula sa backup. Gamitin ang parehong passphrase ng backup.
- Kapag naputol sa gitna, patakbuhin ulit ang Restore. Idadagdag lang nito ang kulang.

## Activity log (Settings, admin lang)

Nakalista ang huling 100 na gawain: unlock, reveal at copy ng secret, download ng file, palit ng role, invite, remove access, palit ng passphrase, backup at restore. Hindi isinusulat dito ang mismong secret. **Hindi ito tamper-proof:** ang app sa browser ng bawat tao ang nagsusulat nito, kaya ang taong gumagamit ng binagong app ay maaaring hindi mailista. Gamitin ito para sa pananagutan, hindi bilang ebidensya sa korte. Hindi mababago o mabubura ang mga entry ng developer ayon sa rules.

## Kung mawala ang phone ng Authenticator

Walang backup codes ang app na ito, dahil ang totoong backup codes ay kailangang may server na magtatago at magche-check nito, at wala nito ang app na ito. Ang pinakamabisang proteksyon: **i-scan ang QR sa dalawang phone** sa unang setup. Kung mawala ang lahat ng device, ang pag-reset ng 2FA ay kailangang gawin sa Firebase mismo, at hindi ito magagawa ng app. Hindi ko pa na-verify ang eksaktong hakbang doon, kaya alamin ito sa Firebase documentation bago mo kailanganin.

## Kapag may umalis sa team

1. **Settings → Team →** pindutin ang trash icon sa tao. Natatanggal ang access niya at ang invite niya.
2. **Settings → Secrets vault → Change passphrase.** Ilagay ang luma at bagong passphrase. Lahat ng password, key, .env at file ay dine-decrypt at ine-encrypt ulit sa isang hakbang (all-or-nothing, hindi mag-iiwan ng kalahati).
3. Sabihan ang team na huminto muna sa pag-edit habang gumagana ito. Pagkatapos, kailangan nilang i-unlock gamit ang bagong passphrase.
4. Hanggang 499 na naka-encrypt na item (login, key, .env, file) ang kaya sa isang palit. Kung lagpas, hihinto ito at walang mababago.
5. Ang taong umalis ay maaaring may kopya pa ng mga password na nakita na niya. Palitan din ang mga totoong password at API key sa mga serbisyo mismo.

## Mga setting sa `js/config.js`

| Option | Default | Ibig sabihin |
| --- | --- | --- |
| `require2FA` | `true` | Kailangan ng Google Authenticator |
| `idleKeyLockMinutes` | `10` | Nagla-lock ang secrets kapag walang galaw |
| `idleSignOutMinutes` | `30` | Auto sign out (`0` = huwag) |
| `clipboardClearSeconds` | `30` | Bura ng nakopyang password |
| `maxFileKB` | `600` | Max na laki ng file |

**Para i-off ang 2FA:** gawing `require2FA: false` sa `js/config.js` at palitan ang `mfa()` sa `firestore.rules` ng `return true;`. Hindi ito inirerekomenda.

## Security header (CSP)

May `Content-Security-Policy` sa `vercel.json` na limitado sa Firebase, Google Fonts at jsDelivr (para sa QR code). Kung blangko ang app o may error na "Refused to load..." sa browser console pagkatapos ng deploy, palitan pansamantala ang `"Content-Security-Policy"` ng `"Content-Security-Policy-Report-Only"` sa `vercel.json`, i-deploy, at ipadala ang mensahe ng console. Hindi pa ito nasubukan sa totoong browser.

## Test

```
npm test
```

Tinitingnan nito ang billing math (partial, discount, late fee), encryption, pagpapalit ng passphrase, mga screen sa bawat role, at kung may handler ang bawat button. Binabasa rin nito ang `firestore.rules` at `vercel.json` bilang teksto lang. Hindi nito kinokonekta ang Firebase at hindi nito pinatatakbo ang rules.

## Mga dapat tandaan

- Ang mga file ay naka-store sa Firestore (hindi sa Storage), kaya maliliit lang (kontrata, screenshot, .env). Para sa malalaki, ilagay sa Drive at i-link.
- Ang pangalan ng app, client, tag at petsa ay **hindi** naka-encrypt (para gumana ang search at reminders). Ang password, key, .env at files ay naka-encrypt.
- Ang developer ay puwedeng mag-edit ng mga app, login, key, .env, file, renewal at update log ng team (kahit hindi siya ang gumawa), pero hindi niya mababago kung sino ang gumawa. Puwede lang siyang mag-delete ng sarili niyang ginawa. Admin lang ang makakapag-delete ng app at makakakita ng Payments at Clients.
- Ang Firebase free (Spark) plan ay sapat sa personal na gamit. Tingnan ang kasalukuyang quota sa Firebase pricing page.
- Hindi pa ito nasubukan sa tunay na Firebase project mo (kasama ang pagpapalit ng passphrase at ang bagong rules). Kapag may error sa unang login, buksan ang browser console at ipadala sa akin ang mensahe.
