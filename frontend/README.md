# GuardTraceAI frontend

The frontend is a React application built with Vite.

## Run locally

1. Start the FastAPI backend from `backend/` using the environment variables described in `backend/.env` (do not commit that file).
2. From this directory, install dependencies with `npm install`.
3. Start the frontend with `npm run dev`.

The API defaults to `http://127.0.0.1:8000`. Set `VITE_API_BASE_URL` in a frontend `.env` file to point at another backend URL, for example:

```env
VITE_API_BASE_URL=https://api.example.com
```

## Frontend structure

- `src/components/common/` contains shared branding, navigation, footer, and theme controls.
- `src/components/admin/` contains the admin dashboard panels and reusable data UI.
- `src/context/` contains the persisted light/dark theme provider and hook.
- `src/layouts/` contains the public and authenticated workspace shells.
- `src/pages/` contains route-level screens, including the public landing page and employee/admin workspaces.

The theme preference is stored in browser local storage and follows the operating-system preference until a user chooses a theme.

Useful commands:

- `npm run lint` checks the frontend source.
- `npm run build` creates the production bundle in `dist/`.
