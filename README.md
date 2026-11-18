# Aequi landing page (joinaequi.com)

Static site, no build step. Pages: `/`, `/team`, `/partners`, `/blog`, `/privacy`, `/terms`.

## 1. Add your two integrations
Open `config.js` and fill in the two marked lines:

```js
formspree: '',   // 1) PASTE FORMSPREE ENDPOINT HERE
gaId: ''         // 2) PASTE GOOGLE ANALYTICS ID HERE
```

- Formspree: create a form at formspree.io and paste its endpoint (looks like `https://formspree.io/f/abcdwxyz`). In Formspree's form settings, add `joinaequi.com` as an allowed domain.
- Google Analytics: paste the Measurement ID (looks like `G-XXXXXXXXXX`). It only loads after a visitor clicks Accept on the cookie banner.

Until the Formspree line is filled in, the demo form skips the send and goes straight to the booking calendar.

## 2. Deploy on Vercel
1. Push this folder to a GitHub repository.
2. In Vercel: Add New > Project > import the repo. Framework Preset: **Other**. Leave Build Command and Output Directory empty. Deploy.
3. Project > Settings > Domains: add `joinaequi.com` and `www.joinaequi.com`, then set the DNS records Vercel shows at your domain registrar. The old landing page is replaced once the domain points to this project.

## 3. After launch, check
- Book a demo form sends, and the Formspree submission arrives.
- Calendar booking loads on the live domain.
- Share the link in Slack or iMessage to see the link preview (title, description, `assets/share.png`).

## Files
- `index.html`, `team/`, `partners/`, `blog/`, `privacy/`, `terms/`: one page file per route (each has its own title and description)
- `runtime.js`: page logic loader. `config.js`: your two settings. `vercel.json`: clean URLs and caching
- `assets/`: photos, signatures, logo, share image. Favicons are in the root.
