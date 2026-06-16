FROM node:22.15 AS build_stage
  ARG SSH_PRIVATE_KEY

  # Set up SSH for private repository access
  RUN mkdir -p ~/.ssh
  RUN echo "${SSH_PRIVATE_KEY}" > ~/.ssh/id_rsa
  RUN chmod 600 ~/.ssh/id_rsa
  RUN ssh-keyscan github.com >> ~/.ssh/known_hosts

  # Set up the working directory and install dependencies
  RUN mkdir -p /workdir
  WORKDIR /workdir
  COPY package*.json ./
  COPY src ./src
  COPY config ./config
  RUN npm ci

  COPY bin ./bin

FROM node:22.15-alpine AS finished_build  
   # Set up the working directory
  RUN mkdir -p /app
  WORKDIR /app

  # Copy the built files and dependencies
  COPY --from=build_stage /workdir /app

  ENTRYPOINT ["node"]
  # CMD ["bin/sri2db.js", "--config", "../config/config.js"]
  CMD ["-e", "console.log('Default CMD: Please override this CMD when running the container.')"]