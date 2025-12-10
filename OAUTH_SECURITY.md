# 🔐 Implementación de OAuth 2.0 en API Gateway

**Guía completa para agregar autenticación y autorización al prototipo**

## 📋 Tabla de Contenidos

1. [Panorama General](#panorama-general)
2. [Arquitectura con OAuth](#arquitectura-con-oauth)
3. [Opción 1: Cognito + Cliente JavaScript](#opción-1-cognito--cliente-javascript)
4. [Opción 2: Auth0 + Cliente JavaScript](#opción-2-auth0--cliente-javascript)
5. [Implementación Paso a Paso](#implementación-paso-a-paso)
6. [Cliente JavaScript (React)](#cliente-javascript-react)
7. [Testing con Postman](#testing-con-postman)
8. [Compatibilidad AWS Academy](#compatibilidad-aws-academy)
9. [Trade-offs de Seguridad](#trade-offs-de-seguridad)

---

## Panorama General

### ¿Por qué OAuth 2.0?

**Problema actual:**
```bash
# Cualquiera puede llamar tu API
curl https://xxx.execute-api.us-east-1.amazonaws.com/dev/users/health
# ✅ 200 OK - Sin autenticación
```

**Con OAuth 2.0:**
```bash
# Sin token: BLOQUEADO
curl https://xxx.execute-api.us-east-1.amazonaws.com/dev/users/health
# ❌ 401 Unauthorized

# Con token válido: PERMITIDO
curl -H "Authorization: Bearer eyJhbGc..." \
  https://xxx.execute-api.us-east-1.amazonaws.com/dev/users/health
# ✅ 200 OK
```

### Flujos OAuth Soportados

| Flujo | Caso de Uso | Recomendado |
|-------|-------------|-------------|
| **Authorization Code + PKCE** | SPA (React, Vue, Angular) | ✅ Sí |
| **Client Credentials** | Servicio a servicio (backend) | ✅ Sí |
| **Implicit** | SPAs (legacy) | ❌ Inseguro |
| **Resource Owner Password** | Apps nativas (legacy) | ❌ No recomendado |

---

## Arquitectura con OAuth

### Flujo Completo (Authorization Code + PKCE)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    1. Usuario accede a app                          │
│                    https://myapp.com                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  React App (Cliente SPA)                                            │
│  - Detecta: no hay token                                            │
│  - Genera: code_verifier (random)                                   │
│  - Calcula: code_challenge = SHA256(code_verifier)                  │
│  - Redirect a Cognito/Auth0                                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AWS Cognito / Auth0 (Identity Provider)                            │
│                                                                     │
│  2. Usuario ingresa credenciales                                    │
│     - Email: user@example.com                                       │
│     - Password: ********                                            │
│                                                                     │
│  3. Cognito valida credenciales                                     │
│     ✅ Correcto → Genera authorization_code                         │
│     ❌ Incorrecto → 401 Error                                       │
│                                                                     │
│  4. Redirect de vuelta a app                                        │
│     https://myapp.com/callback?code=ABC123...                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  React App (Callback Handler)                                       │
│                                                                     │
│  5. Extrae authorization_code de URL                                │
│  6. Envía a Cognito:                                                │
│     POST /oauth2/token                                              │
│     {                                                               │
│       code: "ABC123...",                                            │
│       code_verifier: "original_random_string",                      │
│       client_id: "xxx",                                             │
│       grant_type: "authorization_code"                              │
│     }                                                               │
│                                                                     │
│  7. Cognito valida:                                                 │
│     - code_challenge == SHA256(code_verifier) ✅                    │
│     - authorization_code es válido ✅                               │
│                                                                     │
│  8. Cognito retorna tokens:                                         │
│     {                                                               │
│       "access_token": "eyJhbGc...",      ← Para API calls           │
│       "id_token": "eyJhbGc...",          ← Info del usuario         │
│       "refresh_token": "xxx...",         ← Renovar sin login        │
│       "expires_in": 3600                 ← 1 hora                   │
│     }                                                               │
│                                                                     │
│  9. Guarda tokens en localStorage                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  React App hace request a API                                       │
│                                                                     │
│  GET /dev/users/list                                                │
│  Headers:                                                           │
│    Authorization: Bearer eyJhbGc...                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API Gateway (Authorizer)                                           │
│                                                                     │
│  10. Extrae Bearer token del header                                 │
│  11. Valida JWT:                                                    │
│      - Signature (verifica con public key de Cognito)               │
│      - Expiration (exp < now)                                       │
│      - Issuer (iss == cognito URL)                                  │
│      - Audience (aud == client_id)                                  │
│                                                                     │
│  ✅ Token válido → Continúa a Lambda                                │
│  ❌ Token inválido → 401 Unauthorized                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Lambda Router                                                      │
│  - Recibe request con contexto de usuario                           │
│  - event.requestContext.authorizer.claims = {                       │
│      sub: "user-123",                                               │
│      email: "user@example.com",                                     │
│      cognito:groups: ["admins"]                                     │
│    }                                                                │
│  - Puede hacer autorización granular (RBAC)                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Servicio backend (users/orders)
```

---

## Opción 1: Cognito + Cliente JavaScript

### ✅ **Ventajas**
- ✅ **Nativo de AWS**: Integración directa con API Gateway
- ✅ **Sin servidor externo**: Todo en AWS
- ✅ **Gratis en AWS Academy**: Incluido en cuota educativa
- ✅ **Escalable**: Millones de usuarios

### ⚠️ **Desventajas**
- ⚠️ UI básica (página de login de AWS)
- ⚠️ Menos flexible que Auth0
- ⚠️ Curva de aprendizaje AWS-specific

---

### Paso 1: Crear Cognito User Pool (CDK)

Crea un nuevo archivo `infra/lib/cognito-stack.ts`:

```typescript
import { Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";

export class CognitoStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // User Pool: almacena usuarios
    this.userPool = new cognito.UserPool(this, "ServiceDiscoveryUserPool", {
      userPoolName: "service-discovery-users",
      selfSignUpEnabled: true, // Permitir registro sin admin
      signInAliases: {
        email: true, // Login con email
        username: true,
      },
      autoVerify: {
        email: true, // Verificar email automáticamente
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY, // Para desarrollo
    });

    // App Client: configuración para SPA
    this.userPoolClient = new cognito.UserPoolClient(
      this,
      "ServiceDiscoveryAppClient",
      {
        userPool: this.userPool,
        userPoolClientName: "react-spa-client",
        authFlows: {
          userPassword: true,
          userSrp: true, // Secure Remote Password
        },
        oAuth: {
          flows: {
            authorizationCodeGrant: true, // Authorization Code + PKCE
          },
          scopes: [
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.PROFILE,
          ],
          callbackUrls: [
            "http://localhost:3000/callback", // Desarrollo
            "https://myapp.com/callback", // Producción
          ],
          logoutUrls: [
            "http://localhost:3000",
            "https://myapp.com",
          ],
        },
        preventUserExistenceErrors: true,
      }
    );

    // Hosted UI Domain (para login page de AWS)
    const domain = this.userPool.addDomain("CognitoDomain", {
      cognitoDomain: {
        domainPrefix: `service-discovery-${this.account}`, // Único globalmente
      },
    });

    // Outputs para usar en React
    new CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
      exportName: "CognitoUserPoolId",
    });

    new CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito App Client ID",
      exportName: "CognitoClientId",
    });

    new CfnOutput(this, "CognitoDomain", {
      value: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: "Cognito Hosted UI URL",
      exportName: "CognitoHostedUI",
    });
  }
}
```

---

### Paso 2: Agregar Authorizer a API Gateway

Modifica `infra/lib/api-gateway-stack.ts`:

```typescript
import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";

interface ApiGatewayStackProps extends StackProps {
  routerLambda: lambda.Function;
  userPool: cognito.UserPool; // ← NUEVO
}

export class ApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { routerLambda, userPool } = props;

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        cognitoUserPools: [userPool],
        authorizerName: "cognito-authorizer",
        identitySource: "method.request.header.Authorization",
      }
    );

    const api = new apigateway.LambdaRestApi(this, "ApiGateway", {
      restApiName: "AutoConfigurableGateway",
      handler: routerLambda,
      proxy: true,
      deployOptions: {
        stageName: "dev",
        throttlingRateLimit: 20,
        throttlingBurstLimit: 40,
      },
      defaultMethodOptions: {
        authorizer, // ← Aplicar a todas las rutas
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
      // CORS para SPA
      defaultCorsPreflightOptions: {
        allowOrigins: ["http://localhost:3000", "https://myapp.com"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Api-Key",
        ],
        allowCredentials: true,
      },
    });
  }
}
```

---

### Paso 3: Actualizar `infra/bin/infra.ts`

```typescript
import * as cdk from "aws-cdk-lib";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { CognitoStack } from "../lib/cognito-stack"; // ← NUEVO
import { ApiGatewayStack } from "../lib/api-gateway-stack";
import { LambdaRouterStack } from "../lib/lambda-router-stack";
import { Ec2ServiceStack } from "../lib/ec2-service-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || "646981656470",
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

const dynamo = new DynamoDbStack(app, "ServiceRegistryStack", { env });
const cognito = new CognitoStack(app, "CognitoStack", { env }); // ← NUEVO

const router = new LambdaRouterStack(app, "LambdaRouterStack", {
  env,
  serviceRegistryTableName: dynamo.serviceRegistry.tableName,
});

new ApiGatewayStack(app, "ApiGatewayStack", {
  env,
  routerLambda: router.routerLambda,
  userPool: cognito.userPool, // ← NUEVO
});

// ... EC2 stacks
```

---

### Paso 4: Deploy

```bash
cd infra
npm install
npx cdk deploy CognitoStack ApiGatewayStack --all

# Guarda los outputs:
# - CognitoUserPoolId: us-east-1_XXXXX
# - CognitoClientId: 1234567890abcdef
# - CognitoHostedUI: https://service-discovery-XXX.auth.us-east-1.amazoncognito.com
```

---

## Cliente JavaScript (React)

### Setup

```bash
npx create-react-app my-app
cd my-app
npm install amazon-cognito-identity-js axios
```

### `src/config.js`

```javascript
export const cognitoConfig = {
  region: "us-east-1",
  userPoolId: "us-east-1_XXXXX", // ← De CDK output
  userPoolWebClientId: "1234567890abcdef", // ← De CDK output
  oauth: {
    domain: "service-discovery-646981656470.auth.us-east-1.amazoncognito.com",
    redirectSignIn: "http://localhost:3000/callback",
    redirectSignOut: "http://localhost:3000",
    responseType: "code", // Authorization Code
    scope: ["email", "openid", "profile"],
  },
};

export const apiConfig = {
  baseURL: "https://xxx.execute-api.us-east-1.amazonaws.com/dev",
};
```

### `src/auth/AuthService.js`

```javascript
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";
import { cognitoConfig } from "../config";

class AuthService {
  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.userPoolWebClientId,
    });
  }

  // Sign Up
  signUp(email, password) {
    return new Promise((resolve, reject) => {
      this.userPool.signUp(
        email,
        password,
        [{ Name: "email", Value: email }],
        null,
        (err, result) => {
          if (err) reject(err);
          else resolve(result.user);
        }
      );
    });
  }

  // Confirm Sign Up (código de email)
  confirmSignUp(email, code) {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  // Sign In
  signIn(email, password) {
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          const accessToken = session.getAccessToken().getJwtToken();
          const idToken = session.getIdToken().getJwtToken();
          const refreshToken = session.getRefreshToken().getToken();

          // Guardar en localStorage
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("idToken", idToken);
          localStorage.setItem("refreshToken", refreshToken);

          resolve(session);
        },
        onFailure: (err) => reject(err),
      });
    });
  }

  // Get Current User
  getCurrentUser() {
    return this.userPool.getCurrentUser();
  }

  // Get Session (con refresh automático)
  getSession() {
    const cognitoUser = this.getCurrentUser();
    if (!cognitoUser) return Promise.reject("No user");

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err, session) => {
        if (err) reject(err);
        else resolve(session);
      });
    });
  }

  // Get Access Token
  async getAccessToken() {
    try {
      const session = await this.getSession();
      return session.getAccessToken().getJwtToken();
    } catch (err) {
      return null;
    }
  }

  // Sign Out
  signOut() {
    const cognitoUser = this.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut();
    localStorage.clear();
  }
}

export default new AuthService();
```

### `src/components/Login.jsx`

```jsx
import React, { useState } from "react";
import AuthService from "../auth/AuthService";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await AuthService.signIn(email, password);
      window.location.href = "/dashboard"; // Redirect
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign In</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default Login;
```

### `src/api/apiClient.js`

```javascript
import axios from "axios";
import AuthService from "../auth/AuthService";
import { apiConfig } from "../config";

const apiClient = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: 10000,
});

// Interceptor: agregar Authorization header
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AuthService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: manejar 401 (refresh token)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado: intentar refresh
      try {
        await AuthService.getSession(); // Refresh automático
        // Reintentar request original
        return apiClient.request(error.config);
      } catch (err) {
        // Refresh falló: logout
        AuthService.signOut();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### `src/components/Dashboard.jsx`

```jsx
import React, { useEffect, useState } from "react";
import apiClient from "../api/apiClient";
import AuthService from "../auth/AuthService";

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get("/users/list");
      setUsers(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    AuthService.signOut();
    window.location.href = "/login";
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h2>Dashboard</h2>
      <button onClick={handleLogout}>Logout</button>
      <ul>
        {users.map((user, idx) => (
          <li key={idx}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;
```

---

## Opción 2: Auth0 + Cliente JavaScript

### ✅ **Ventajas**
- ✅ **UI moderna**: Login page personalizable
- ✅ **Social login**: Google, Facebook, GitHub
- ✅ **Más features**: MFA, passwordless, reglas avanzadas
- ✅ **Dashboard intuitivo**: Gestión visual de usuarios

### ⚠️ **Desventajas**
- ⚠️ **Servicio externo**: Dependencia de Auth0
- ⚠️ **Costo**: Gratis hasta 7,000 usuarios activos/mes
- ⚠️ **Integración API Gateway**: Requiere custom authorizer

---

### Paso 1: Configurar Auth0

1. Crear cuenta en [auth0.com](https://auth0.com)
2. Crear "Application" → Single Page Application
3. Configurar:
   - **Allowed Callback URLs**: `http://localhost:3000/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`

### Paso 2: Custom Authorizer Lambda

Crea `lambdas/authorizer/handler.js`:

```javascript
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN; // tenant.auth0.com
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE; // API identifier

const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) callback(err);
    else callback(null, key.publicKey || key.rsaPublicKey);
  });
}

exports.handler = async (event) => {
  const token = event.authorizationToken.replace("Bearer ", "");

  try {
    // Decode sin verificar (para obtener header)
    const decoded = jwt.decode(token, { complete: true });

    // Obtener public key de Auth0
    const signingKey = await new Promise((resolve, reject) => {
      getKey(decoded.header, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    // Verificar token
    const verified = jwt.verify(token, signingKey, {
      audience: AUTH0_AUDIENCE,
      issuer: `https://${AUTH0_DOMAIN}/`,
      algorithms: ["RS256"],
    });

    // Generar IAM policy
    return generatePolicy(verified.sub, "Allow", event.methodArn, verified);
  } catch (err) {
    console.error("Auth error:", err);
    throw new Error("Unauthorized");
  }
};

function generatePolicy(principalId, effect, resource, claims) {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context: {
      sub: claims.sub,
      email: claims.email || "",
      scope: claims.scope || "",
    },
  };
}
```

### Paso 3: Deploy Custom Authorizer

Modifica `infra/lib/api-gateway-stack.ts`:

```typescript
// Custom Authorizer Lambda
const authorizerLambda = new lambda.Function(this, "Auth0Authorizer", {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: "handler.handler",
  code: lambda.Code.fromAsset(path.join(__dirname, "../../lambdas/authorizer")),
  environment: {
    AUTH0_DOMAIN: "your-tenant.auth0.com",
    AUTH0_AUDIENCE: "https://api.yourdomain.com",
  },
});

const authorizer = new apigateway.TokenAuthorizer(this, "Auth0Authorizer", {
  handler: authorizerLambda,
  identitySource: "method.request.header.Authorization",
  resultsCacheTtl: Duration.minutes(5),
});

// Aplicar a API Gateway
const api = new apigateway.LambdaRestApi(this, "ApiGateway", {
  handler: routerLambda,
  defaultMethodOptions: {
    authorizer,
    authorizationType: apigateway.AuthorizationType.CUSTOM,
  },
});
```

### Paso 4: Cliente React con Auth0

```bash
npm install @auth0/auth0-react
```

```jsx
// src/index.js
import { Auth0Provider } from "@auth0/auth0-react";

ReactDOM.render(
  <Auth0Provider
    domain="your-tenant.auth0.com"
    clientId="YOUR_CLIENT_ID"
    redirectUri={window.location.origin}
    audience="https://api.yourdomain.com"
    scope="openid profile email"
  >
    <App />
  </Auth0Provider>,
  document.getElementById("root")
);

// src/components/LoginButton.jsx
import { useAuth0 } from "@auth0/auth0-react";

function LoginButton() {
  const { loginWithRedirect, logout, isAuthenticated } = useAuth0();

  return isAuthenticated ? (
    <button onClick={() => logout()}>Logout</button>
  ) : (
    <button onClick={() => loginWithRedirect()}>Login</button>
  );
}

// src/api/apiClient.js
import { useAuth0 } from "@auth0/auth0-react";

apiClient.interceptors.request.use(async (config) => {
  const { getAccessTokenSilently } = useAuth0();
  const token = await getAccessTokenSilently();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

## Testing con Postman

### 1. Obtener Token (Cognito)

```bash
# Obtener authorization code (manual en browser)
https://service-discovery-XXX.auth.us-east-1.amazoncognito.com/login?client_id=XXX&response_type=code&scope=email+openid+profile&redirect_uri=http://localhost:3000/callback

# Después del login, Cognito redirige a:
http://localhost:3000/callback?code=ABC123...

# Intercambiar code por token
curl -X POST \
  https://service-discovery-XXX.auth.us-east-1.amazoncognito.com/oauth2/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=authorization_code' \
  -d 'client_id=YOUR_CLIENT_ID' \
  -d 'code=ABC123...' \
  -d 'redirect_uri=http://localhost:3000/callback'

# Response:
{
  "access_token": "eyJhbGc...",
  "id_token": "eyJhbGc...",
  "refresh_token": "xxx...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### 2. Usar Token en Postman

```
GET https://xxx.execute-api.us-east-1.amazonaws.com/dev/users/health
Headers:
  Authorization: Bearer eyJhbGc...
```

**Sin token:**
```json
{
  "message": "Unauthorized"
}
```

**Con token válido:**
```json
{
  "status": "healthy",
  "service": "users"
}
```

---

## Compatibilidad AWS Academy

### ✅ **Funciona en AWS Academy**

- ✅ Cognito User Pool (incluido en free tier)
- ✅ Lambda Authorizer (mínimo costo)
- ✅ API Gateway con authorizer (sin costo extra)

### 📊 **Costos Estimados**

| Servicio | AWS Academy | Producción |
|----------|-------------|------------|
| Cognito (50k MAU) | $0 (free tier) | $275/mes |
| Lambda Authorizer | ~$0.20 | ~$2.00 |
| API Gateway | $10.50 | $52.50 |
| **Total** | **~$10.70/mes** | **~$329.50/mes** |

MAU = Monthly Active Users

---

## Trade-offs de Seguridad

### Comparación de Opciones

| Aspecto | Sin Auth | API Key | Cognito OAuth | Auth0 |
|---------|----------|---------|---------------|-------|
| **Seguridad** | ❌ None | ⚠️ Básica | ✅ Alta | ✅ Muy Alta |
| **User Management** | ❌ N/A | ❌ Manual | ✅ Cognito | ✅ Dashboard |
| **Social Login** | ❌ N/A | ❌ N/A | ⚠️ Limitado | ✅ Full |
| **Costo (50k users)** | $0 | $0 | $0 (free tier) | $240/mes |
| **Setup Time** | 0 min | 5 min | 2 horas | 1 hora |
| **AWS Integration** | N/A | Nativa | Nativa | Custom |
| **Token Refresh** | ❌ N/A | ❌ N/A | ✅ Automático | ✅ Automático |
| **MFA** | ❌ N/A | ❌ N/A | ✅ SMS/TOTP | ✅ SMS/TOTP/Push |

---

## Recomendación Final

### Para AWS Academy (Prototipo)

**Recomiendo: Cognito OAuth**

**Razones:**
1. ✅ **Gratis**: Incluido en AWS Academy
2. ✅ **Integración nativa**: Sin custom authorizer
3. ✅ **Producible**: Mismo código para prod
4. ✅ **Aprendizaje AWS**: Skill valioso

**Implementación mínima:**
```bash
# 1. Deploy Cognito
cd infra
npx cdk deploy CognitoStack

# 2. Actualizar API Gateway
npx cdk deploy ApiGatewayStack

# 3. Cliente React
npx create-react-app client
cd client
npm install amazon-cognito-identity-js axios
# (Copiar código de arriba)

# Total time: 2-3 horas
```

### Para Producción

**Considera: Auth0**

Si necesitas:
- Social login (Google, Facebook, GitHub)
- UI personalizable
- Reglas avanzadas de autorización
- Soporte empresarial

---

## Recursos

### Documentación
- [Cognito Developer Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/)
- [API Gateway Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)

### Herramientas
- [JWT.io](https://jwt.io/) - Debugger de tokens
- [OAuth Debugger](https://oauthdebugger.com/) - Probar flujos
- [Postman](https://www.postman.com/) - Testing de APIs

### Ejemplos
- [AWS Cognito Examples](https://github.com/aws-samples/aws-cognito-apigw-angular-auth)
- [Auth0 React Quickstart](https://auth0.com/docs/quickstart/spa/react)

---

**Última actualización**: Diciembre 2024

**Siguiente paso**: Implementa Cognito en tu prototipo y protege tu API! 🔐
