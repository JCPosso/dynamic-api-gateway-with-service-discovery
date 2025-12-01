# API Gateway Auto-Configurable con Service Discovery (MVP)

Este proyecto implementa un prototipo funcional de un API Gateway auto-configurable con Service Discovery dinámico, usando:

- AWS CDK (TypeScript)
- API Gateway
- AWS Lambda (Router + Sync)
- ECS (EC2 mode)
- DynamoDB como Service Registry
- CloudWatch (logs, métricas, alarmas)

📌 Índice
1. Arquitectura
2. Requisitos
3. Estructura del repositorio
4. Implementación (paso a paso)
5. Pruebas
6. Monitoreo y operación
7. Seguridad y buenas prácticas
8. Runbooks
9. Anexos (comandos útiles)
10. Licencia

---

## 1. Arquitectura

Descripción:
- ECS Services (users, orders, payments, ...) se auto-registran en DynamoDB.
- API Gateway envía todo el tráfico al Lambda Router.
- Lambda Router consulta el ServiceRegistry, selecciona una instancia y proxy HTTP hacia el microservicio.
- Lambda Sync puede reconstruir registros o actualizar TTLs.
- CloudWatch para logs, métricas y alarmas.

---

## 2. Requisitos

Local (desarrollo)
- Node.js >= 18
- npm o yarn
- Docker (para build de imágenes)
- AWS CLI configurado
- AWS CDK v2 instalado globalmente

AWS
- Permisos para: EC2, AutoScaling, ECS (EC2), DynamoDB, API Gateway, Lambda, CloudWatch
- Limitado a 2 AZ

---

## 3. Estructura del repositorio (estado actual)

Raíz del repositorio (monorepo npm workspaces):

- `package.json`              : archivo raíz (workspaces: `infra`, `services/*`, `lambdas/*`)
- `tsconfig.json`             : configuración TypeScript a nivel de monorepo
- `README.md`
- `.gitignore`

- `infra/`                    : Infraestructura CDK (TypeScript)
  - `bin/infra.ts`
  - `lib/`                    : Stacks CDK (api-gateway, dynamodb, lambda-router, ...)
  - `package.json`            : scripts/deps local a la workspace `infra`
  - `tsconfig.json`

- `lambdas/`                  : Código TypeScript de las Lambdas (Router + Sync)
  - `lambda-router.ts`        : handler TypeScript del Lambda Router
  - `lambda-sync.ts`          : handler TypeScript del Lambda Sync
  - `package.json` (workspace)

- `router/`                   : implementación auxiliar/legacy del router (index.ts)
- `sync/`                     : implementación auxiliar/legacy del sync (index.js)

- `services/`                 : microservicios (ejemplos en Node/Express)
  - `users/`                  : `Dockerfile`, `app.js`, `package.json`
  - `orders/`                 : `Dockerfile`, `app.js`, `package.json`

- `docs/screenshots/`         : imágenes usadas en el README

Notas:
- El repositorio usa un `package-lock.json` raíz (reproducibilidad). Evitamos lockfiles por workspace — las dependencias se gestionan desde la raíz mediante npm workspaces.
- Algunos directorios (`router/`, `sync/`) contienen implementaciones auxiliares o históricas; las lambdas "productivas" están en `lambdas/`.

---

## 4. Implementación (Paso a Paso)

4.1 Preparación del entorno local
```bash
git clone <url-del-repo>
cd dynamic-api-gateway-with-service-discovery

# Instalar dependencias desde la raíz (npm workspaces). Esto genera un único lockfile en la raíz.
npm install

# Opciones de desarrollo

# - Ejecutar un microservicio de ejemplo (por ejemplo `users`):
cd services/users
npm start

# - Ejecutar una lambda en modo desarrollo (hot reload). Desde la raíz puedes invocar:
npm --workspace=lambdas run dev

# - Compilar la infra CDK (TypeScript) y sintetizar:
cd infra
npm run build
npx cdk synth
```
![](./docs/screenshots/01-install.png)

4.2 Construcción de imágenes Docker y push a ECR (opcional)
```bash
# local
docker build -t users ../services/users
docker build -t orders ../services/orders

# ECR (si está permitido)
aws ecr create-repository --repository-name users
$(aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com)
docker tag users:latest <account>.dkr.ecr.us-east-1.amazonaws.com/users:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/users:latest
```
![](./docs/screenshots/02-docker-build.png)

Mejoras recomendadas para Dockerfiles
- Use `npm ci --only=production` en la fase final de build para imágenes de producción.
- Etiqueta las imágenes con `:${GITHUB_SHA}` o `:v1.0.0` además de `:latest` para trazabilidad.

Ejemplo (comandos recomendados)
```bash
# construir con etiqueta semántica
docker build -t users:1.0.0 services/users

# etiquetar para ECR
docker tag users:1.0.0 <account>.dkr.ecr.us-east-1.amazonaws.com/users:1.0.0
docker tag users:1.0.0 <account>.dkr.ecr.us-east-1.amazonaws.com/users:latest

# login y push (ejemplo us-east-1)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/users:1.0.0
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/users:latest
```

4.3 Desplegar la infraestructura (CDK)
```bash
cd infra
npx cdk bootstrap
npx cdk synth
npx cdk deploy --all
```
![](./docs/screenshots/03-cdk-deploy.png)

Recursos creados (resumen):
- VPC, ECS cluster (EC2 mode), AutoScaling Group
- DynamoDB ServiceRegistry
- Lambdas Router + Sync
- API Gateway, Roles IAM, CloudWatch logs

4.4 Verificar auto-registro
```bash
aws dynamodb scan --table-name ServiceRegistry
```
Elemento esperado por servicio:
```json
{
  "serviceName": "users",
  "host": "10.0.5.23",
  "port": 3000,
  "ttl": 1738300000
}
```
Pantallazo: `04-dynamodb-registry.png`

4.5 Probar enrutamiento dinámico
```bash
curl -i https://<api-id>.execute-api.<region>.amazonaws.com/proxy/users/health
```
Respuesta esperada:
HTTP/1.1 200 OK
{"status":"ok","service":"users"}
![](./docs/screenshots/05-curl-health.png)

4.6 Pruebas locales y comprobaciones rápidas

- Probar microservicio `users` localmente (sin Docker):
```bash
cd services/users
npm install
npm start
# luego en otra terminal
curl -i http://localhost:3000/health
```

- Probar `orders` localmente igual que arriba (puerto 3000 por defecto).

- Probar Router (desplegado en API Gateway):
```bash
curl -i https://<api-id>.execute-api.<region>.amazonaws.com/svc/users/health 
```

- Prueba manual del Router en local (opcional/experimental):
  - Puedes ejecutar la lambda localmente con herramientas como AWS SAM CLI (`sam local invoke`) o `@aws-lambda-ric`/`aws-lambda-ric` para invocar el handler. Requiere empaquetar event JSON que simule la petición API Gateway.

Ejemplo mínimo de evento (guardar en `event.json`) para invocar la lambda del router desde SAM o `aws lambda invoke`:
```json
{
  "rawPath": "/svc/users/health",
  "requestContext": { "http": { "method": "GET" } },
  "headers": { "authorization": "Bearer <token>" }
}
```

Luego puedes ejecutar (si usas SAM):
```bash
sam local invoke LambdaRouter --event event.json
```

Nota: el router espera que el Service Registry (DynamoDB) ya tenga la entrada del servicio; para pruebas locales puedes saltarte la verificación modificando temporalmente el handler o inyectando una URL de destino conocida.

---

## 5. Pruebas

- Unitarias
  - Lambda Router: resolución de rutas, selección de instancia, manejo de errores
  - Microservicios ECS: endpoints básicos
  - CDK Assertions: validar recursos y permisos mínimos
- Integración
  - Llamadas reales al API Gateway
  - Verificar registros en DynamoDB
  - Simular caída de instancia y verificar recuperación
- E2E
  - Flujo completo: API Gateway → Router → ECS → Respuesta
  - Correlación en CloudWatch Logs

---

## 6. Monitoreo y Operación

Dashboards recomendados (CloudWatch):
- Latencia del API Gateway (p95/p99)
- 4xx y 5xx errors
- Lambda Router: invocations, duration, errors, throttles
- ECS: CPU y memory por servicio
- DynamoDB: consumed RCU/WCU, throttling

Alarmas sugeridas:
- Lambda Router errors > 1%
- ECS tasks < desiredCount
- Latencia p95 > 1s
- DynamoDB throttling

![](./docs/screenshots/06-cloudwatch-dashboard.png)

---

## 7. Seguridad y Buenas Prácticas

- IAM Least Privilege para Lambdas y ECS tasks.
- Secrets en Parameter Store o Secrets Manager.
- HTTPS obligatorio (API Gateway por defecto).
- Validación estricta de entradas en el Router.
- CORS restringido según origenes permitidos.
- Security Groups mínimos (solo puertos necesarios).
- Registrar eventos críticos en CloudWatch Logs.

---

## 8. Runbooks

Problema: servicio no aparece en DynamoDB
- Revisar logs del ECS task (CloudWatch).
- Confirmar que el service pudo llamar el endpoint /register.
- Revisar Security Groups o IAM.
- Registrar manualmente un item para pruebas.

Problema: alta latencia
- Revisar duración de Lambda Router.
- Ver congestión en ECS (CPU/memory).
- Confirmar cacheo de resoluciones en Router.
- Ajustar ASG / políticas de escalado.

Problema: API Gateway retorna 502
- Ver logs del Router en CloudWatch.
- Verificar backend (ECS task) está corriendo.
- Validar que la URL del servicio es alcanzable desde Lambda.
- Revisar TTL de registros en DynamoDB.

---

## 9. Anexos — Comandos útiles

Logs Lambda Router:
```bash
aws logs tail /aws/lambda/lambda-router --follow
```
Listar tasks ECS:
```bash
aws ecs list-tasks --cluster ApiGatewayCluster
```
Ver ASG:
```bash
aws autoscaling describe-auto-scaling-groups
```

---

## 10. Licencia

MIT
