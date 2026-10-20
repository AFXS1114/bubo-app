FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts --no-audit

FROM dependencies AS builder
COPY . .
RUN npx tsc --noEmit

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .
CMD ["npm", "run", "start", "--", "--offline"]
