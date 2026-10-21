# Graphia

Graphia is a client-side scientific writing app. Its current document library, editor content, and preferences live in the browser on the device where they were created.

## Run locally

```sh
npm ci
npm run dev
```

## Deploy to GitHub Pages

The included GitHub Actions workflow builds and deploys the site whenever `main` is updated. It sets the Vite base path to `/Graphia/` for a project repository named `Graphia`.

1. Push this project to a GitHub repository named `Graphia` on the `main` branch. If you use a different repository name, change `VITE_BASE_PATH` in `.github/workflows/deploy.yml` to `/<repository-name>/`.
2. In the GitHub repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Push to `main`, or run **Deploy Graphia to GitHub Pages** from the **Actions** tab. GitHub will show the published URL in the workflow run and Pages settings.

For a user or organization site at `<username>.github.io`, set the workflow's `VITE_BASE_PATH` to `/`.

## Deploy to Cloudflare Pages

The default Vite base path is `/`, which is appropriate for Cloudflare Pages. You can connect the Git repository for automatic deployments or deploy the static build manually.

### Connect a Git repository

1. In the Cloudflare dashboard, open **Workers & Pages → Create → Pages → Connect to Git** and select this repository.
2. Set the production branch to `main`, the build command to `npm run build`, and the build output directory to `dist`.
3. Leave the root directory at the repository root and do not set `VITE_BASE_PATH` for the standard `*.pages.dev` domain or a custom domain.
4. Save and deploy. Future pushes to `main` will trigger a new deployment.

### Deploy manually

Run `npm ci` and `npm run build`, then deploy the generated `dist` directory using Cloudflare's Wrangler CLI or the Pages dashboard upload flow.

For a deployment hosted under a URL subpath rather than the domain root, set `VITE_BASE_PATH` to that subpath, including the leading and trailing slashes, before building.

### Data and browser support

GitHub Pages serves the app but does not store user documents. Documents are kept in IndexedDB and preferences in local storage, so they do not sync between browsers or devices. Users should export `.graphia.json` files for backup. The app requires a modern browser with IndexedDB support.
