import { app, initializeServer } from '../server';

export default async (req: any, res: any) => {
  // On Vercel, we need to ensure the middlewares (including Vite in dev or static in prod) are set up
  // However, initializeServer() sets up the routing.
  // For Vercel production, we want the API routes to work.
  // The static files are handled by the 'public' or 'dist' directory via vercel.json.
  
  // We don't want to call app.listen recursively.
  // We just ensure the routes are registered.
  // Since server.ts runs top-level code to register routes, they are already there.
  
  return app(req, res);
};
