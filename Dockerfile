FROM node:16-bullseye

RUN apt-get -q update

WORKDIR /app

COPY . .

RUN yarn install

RUN yarn prisma generate

RUN yarn build

ENTRYPOINT [ "yarn", "start:prod" ]
