# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Deploy de Firestore Rules (portavel)

Este repositorio inclui:

1. Script portavel: `scripts/deploy-firestore-rules.js`
2. Comando npm: `npm run firestore:rules:deploy:portable`
3. Workflow GitHub Actions: `.github/workflows/deploy-firestore-rules.yml`

Variaveis aceitas pelo script:

1. `FIREBASE_SERVICE_ACCOUNT`
   - JSON da Service Account (texto puro ou base64).
2. `FIREBASE_RULES_PROJECTS`
   - Lista de projetos separada por virgula.
3. `FIREBASE_TOKEN`
   - Alternativa de autenticacao (quando nao usar Service Account).
4. `FIREBASE_TOOLS_VERSION`
   - Opcional, default: `13.35.1`.

Uso local/manual:

1. (Opcional) se nao usar Service Account/Token no ambiente local:
   - `npx firebase-tools login`
2. Execute via npm:
   - `npm run firestore:rules:deploy:portable -- --project aly-onepages-runtime`
   - `npm run firestore:rules:deploy:portable -- --projects teste-aa015,aly-onepages-runtime`
   - `npm run firestore:rules:deploy:portable -- --project-file ./projects.txt`
3. Ou execute direto:
   - `node scripts/deploy-firestore-rules.js --project aly-onepages-runtime`

GitHub Actions:

1. Configure em `Settings > Secrets and variables > Actions`:
   - Secret `FIREBASE_SERVICE_ACCOUNT`
   - Variable `FIREBASE_RULES_PROJECTS`
2. O workflow roda automaticamente no push da `main` quando `firestore.rules` muda.
3. Tambem pode rodar manualmente em Actions > `Deploy Firestore Rules`.

Outros provedores de CI:

1. Configure as mesmas variaveis no provedor.
2. Execute:
   - `node scripts/deploy-firestore-rules.js`
   - ou `npm run firestore:rules:deploy:portable`
