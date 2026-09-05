# Scents by Ahmed — Free Render Deployment

## What this package is ready for
- Node.js + Express
- SQLite database
- Admin panel at `/admin.html`
- Product image uploads
- Render-compatible `render.yaml`

## Deploy
1. Create a GitHub account and a new repository.
2. Upload the contents of this folder to the repository.
3. On Render, create a **New Web Service** and connect the GitHub repository.
4. Render will use `render.yaml` settings automatically (or use: Build `npm install`, Start `npm start`).
5. Add environment variable `ADMIN_PASSWORD` with your own strong password.
6. Deploy.
7. Your free URL will look like `https://scents-by-ahmed.onrender.com` (the exact URL depends on availability).
8. Open `/admin.html` for the admin panel.

## Important free-hosting limitation
The current app uses SQLite and stores uploaded images on the server filesystem. On free/ephemeral hosting, data/files can be lost after a service restart, redeploy, or instance replacement. This is fine for testing, but **not suitable for production orders**.

For a real store, use a persistent PostgreSQL database and cloud image storage (or paid persistent disk). The front-end API structure can remain almost the same.

## Local run
```bash
npm install
npm start
```
Then open `http://localhost:3000`.
