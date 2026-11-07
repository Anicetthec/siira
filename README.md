# Siira

Plateforme de gestion des transports au Burkina Faso.

## Structure

- `apps/api` : API NestJS + Prisma ;
- `apps/client` : site voyageurs responsive ;
- `apps/societe` : espace société React et application Windows Electron.

Les deux interfaces utilisent la même API et la même base PostgreSQL.

## Développement local

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Applications :

- société : `http://localhost:5173` ;
- client : `http://localhost:5174` ;
- API : `http://localhost:3000/api/health`.

## Base de données

Configurez `apps/api/.env` avec Neon ou PostgreSQL local :

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
PORT=3000
```

Ne commitez jamais `apps/api/.env`.

## Authentification

- société : email + mot de passe ;
- client : téléphone + mot de passe ;
- inscription client : `POST /api/auth/client/register` ;
- connexion client : `POST /api/auth/client/login` ;
- connexion société : `POST /api/auth/societe/login`.

## Déploiement

La même repository peut être déployée séparément :

- API sur Render ou Railway :
  - build : `npm run build --workspace apps/api` ;
  - démarrage : `npm run start:prod --workspace apps/api` ;
  - variable : `DATABASE_URL` Neon ;
- client sur Vercel ou Netlify :
  - dossier : `apps/client` ;
  - build : `npm run build` ;
  - sortie : `dist` ;
- société Windows :

```bash
npm run dist:win --workspace apps/societe
```

Avant le déploiement, remplacez `http://localhost:3000` dans les interfaces par l’URL publique de l’API.

## Mode hors ligne

Les réservations client, les opérations de bagage société et les mises à jour de statut sont mises en file localement lorsque le réseau est indisponible. Elles sont synchronisées automatiquement au retour du réseau. Les conflits de sièges sont tranchés par le serveur afin d’éviter les doubles réservations.
