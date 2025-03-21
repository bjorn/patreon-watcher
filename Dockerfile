FROM denoland/deno:latest

WORKDIR /app

COPY . .

RUN deno cache server.ts

EXPOSE 80

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "server.ts"]
