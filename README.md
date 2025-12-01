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

## 3. Estructura del repositorio

/api-gateway-dynamic
- /infra                      # Infraestructura CDK (TypeScript)
  - bin/infra.ts
  - lib/
    - vpc-stack.ts
    - ecs-cluster-stack.ts
    - ecs-services-stack.ts
    - dynamodb-stack.ts
    - api-gateway-stack.ts
    - lambda-router-stack.ts
    - lambda-sync-stack.ts
- /services                   # Microservicios ECS (Node.js / Express)
  - /users
    - Dockerfile
    - app.js
  - /orders
    - Dockerfile
    - app.js
- /router                     # Lambda Router (JS/TS)
  - index.js
  - package.json
- /sync                       # Lambda Sync (JS/TS)
  - index.js
  - package.json
- /docs/screenshots           # Imágenes para README
- README.md

---

## 4. Implementación (Paso a Paso)

4.1 Preparación del entorno local
```bash
git clone <url-del-repo>
cd api-gateway-dynamic
# instalar dependencias
cd infra && npm install
cd ../router && npm install
cd ../sync && npm install
```
Pantallazo sugerido: `01-install.png`

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
Pantallazo: `02-docker-build.png`

4.3 Desplegar la infraestructura (CDK)
```bash
cd infra
npx cdk bootstrap
npx cdk synth
npx cdk deploy --all
```
Pantallazo: `03-cdk-deploy.png`

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
Pantallazo: `05-curl-health.png`

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

Pantallazo: `06-cloudwatch-dashboard.png`

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
