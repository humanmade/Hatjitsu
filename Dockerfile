# --- build ---
# Debian slim (glibc), not alpine: better-sqlite3 ships glibc prebuilt binaries,
# so no source compilation / build-tools are needed.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci
COPY . .
RUN npm run build

# --- runtime ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev --workspace @hmpp/server --workspace @hmpp/shared
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/client/dist apps/server/dist/public
# Run as uid/gid 33 (www-data) to match the tools.hmn.md EFS access point,
# which creates /data owned by 33:33 (mode 755). A different uid cannot write to it.
RUN mkdir -p /data && chown 33:33 /data
USER 33:33
VOLUME ["/data"]
ENV PORT=80
ENV DATA_DIR=/data
EXPOSE 80
CMD ["node", "apps/server/dist/index.js"]
