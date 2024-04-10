# NL APIs

## Installation

```bash
$ npm i
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Contributions Guide

- Clone and set up the repo. Please use `node-16` as your node version. Check out [nvm](https://github.com/nvm-sh/nvm) to manage node versions.
- Create a `.env` file and copy the env vars from this [doc](https://docs.google.com/document/d/1UnGuDeAhWLgxmOu9im9lvAb7cgOVMsuhJ15luaRrh1s/edit). We have set up a staging environment to start with the project quickly.
- Run `npm run start:dev` and contribute!


### Notes:

- Our branching strategy has a `development` branch that is used as the base branch for all PRs.  Periodically features that are tested by QA and merged to development are moved to `master` branch and a release is created. 
- Please follow this [commit guidelines](https://www.conventionalcommits.org/en/v1.0.0/)
- All PRs should be made to the `development` branch instead of the default `master` branch. 

