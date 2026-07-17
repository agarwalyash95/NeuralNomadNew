# NeuralNomad frontend — Next.js, matches the existing `npm run build && npm start`
# flow documented in docs/SETUP.md (no `output: "standalone"` configured in
# next.config.js, so this keeps node_modules rather than assuming one).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked into the client bundle at build time — the browser (on the host)
# reaches the backend via its host-mapped port, same as local dev.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build
# This project has no public/ directory (no static assets committed there —
# favicon etc. are handled via src/app/ conventions instead). The runner
# stage below still COPYs --from=builder /app/public, so make sure it
# exists (even empty) rather than failing the build over an optional dir.
RUN mkdir -p public

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000
CMD ["npm", "start"]
