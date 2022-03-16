FROM node:alpine
CMD ["npm install"]
COPY src /src
CMD ["node","/src/server.js"]
EXPOSE 80
