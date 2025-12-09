# API Gateway Auto-Configurable con Service Discovery

**Prototipo funcional de un API Gateway con descubrimiento dinámico de servicios en AWS**

## 📋 Tabla de Contenidos

1. [Desafío Técnico](#desafío-técnico)
2. [Arquitectura](#arquitectura)
3. [Requisitos](#requisitos)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Setup Inicial](#setup-inicial)
6. [Implementación](#implementación)
7. [Pruebas (Compatible AWS Academy)](#pruebas-compatible-aws-academy)
8. [Monitoreo](#monitoreo)
9. [Resolución de Problemas](#resolución-de-problemas)
10. [Anexos](#anexos)

---

## Desafío Técnico

### ❌ Problema: Configuración Estática

En arquitecturas de microservicios tradicionales:

- **API Gateway tiene rutas hardcodeadas**: `/users → 10.0.1.5:3000`
- **Escala manualmente**: Agregar servicio = reconfigurar gateway + redeploy
- **Frágil a cambios**: Si IP de servicio cambia (fallo, actualización), rutas quedan inválidas
- **Acoplamiento fuerte**: Gateway conoce topología específica de servicios

```
┌─────────────────────────────┐
│   API Gateway               │
│  /users → 10.0.1.5:3000    │ ← Hardcoded
│  /orders → 10.0.2.3:3001   │ ← Manual
│  /payments → 10.0.3.1:3002 │ ← Requiere redeploy
└─────────────────────────────┘
```

### ✅ Solución: Service Discovery Dinámico

**El API Gateway descubre servicios en tiempo de ejecución**, sin configuración estática:

```
┌──────────────────────────┐
│   API Gateway            │
│  /{serviceName}/*        │ ← Ruta genérica
└──────────────────────────┘
           ↓
┌──────────────────────────────────┐
│  Lambda Router (Dinámico)        │
│  1. Extraer: serviceName=users   │
│  2. Consultar DynamoDB           │
│  3. Proxy HTTP → 10.0.1.5:3000   │
└──────────────────────────────────┘
           ↓
┌──────────────────────────────────┐
│  ServiceRegistry (DynamoDB)      │
│  {                               │
│    serviceName: "users",         │
│    host: "10.0.1.5",            │
│    port: 3000,                  │
│    ttl: 1738300000              │
│  }                               │
└──────────────────────────────────┘
```

**Ventajas:**
- ✅ **Agnóstico**: Gateway no conoce servicios específicos
- ✅ **Auto-escalable**: Nuevos servicios se registran automáticamente
- ✅ **Resiliente**: TTL en DynamoDB limpia registros obsoletos
- ✅ **Agnóstico de IP**: Soporta cambios de infraestructura
- ✅ **Sin redeploy**: Agregar servicio no requiere cambiar gateway

---

## Arquitectura

### Diagrama de Flujo

```
Client
  ↓
GET /dev/users/list
  ↓
API Gateway (HTTP API)
  ↓
Lambda Router Handler (proxy)
  │
  ├─ 1. Parsear path: /dev/users/list → serviceName="users"
  │
  ├─ 2. Consultar DynamoDB ServiceRegistry
  │     Query: serviceName="users" → host="10.0.1.5", port=3000
  │
  ├─ 3. Proxy HTTP: GET http://10.0.1.5:3000/list
  │
  └─ 4. Return response al cliente
```

### Componentes

| Componente | Descripción | Estado |
|-----------|-----------|--------|
| **API Gateway** | Endpoint público que enruta todo a Lambda | ✅ Funcional |
| **Lambda Router** | Node.js handler que consulta registry y hace proxy HTTP | ✅ Funcional |
| **DynamoDB ServiceRegistry** | Tabla con servicios activos y sus endpoints | ✅ Funcional |
| **EC2 Services** | 2 microservicios: users:3000, orders:3001 | ✅ Funcional |
| **CloudWatch** | Logs y métricas | ✅ Configurado |

---

## Requisitos

### Local (Desarrollo)

- **Node.js** >= 18
- **npm** o yarn
- **Docker** (para build de imágenes)
- **AWS CLI** v2 configurado con credenciales
- **AWS CDK** v2 (`npm install -g aws-cdk`)

### AWS (AWS Academy o Producción)

- **Permisos IAM**: EC2, DynamoDB, Lambda, API Gateway, CloudWatch, AutoScaling (LabRole funciona en AWS Academy)
- **Recursos**: Limitados en AWS Academy (1-2 AZ, cuotas reducidas)
- **VPC**: VPC por defecto habilitada

---

## Estructura del Proyecto

```
.
├── README.md                           ← Este archivo
├── package.json                        ← Workspace root (npm)
├── tsconfig.json                       ← TypeScript config
├── cdk.json                           ← CDK context
├── bootstrap-template.yaml            ← CloudFormation template
│
├── infra/                             ← AWS CDK (TypeScript)
│   ├── bin/
│   │   └── infra.ts                   ← Entry point CDK
│   └── lib/
│       ├── api-gateway-stack.ts       ← API Gateway + Lambda Router
│       ├── dynamodb-stack.ts          ← DynamoDB ServiceRegistry
│       ├── ec2-service-stack.ts       ← EC2 microservicios (users, orders)
│       └── lambda-router-stack.ts     ← Lambda Router deployment
│
├── lambdas/                           ← Lambda handlers (Node.js)
│   └── router/
│       └── handler.js                 ← Router proxy logic
│
├── services/                          ← Microservicios (Node.js + Express)
│   ├── users/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── index.js                   ← Express app
│   └── orders/
│       ├── Dockerfile
│       ├── package.json
│       └── index.js                   ← Express app
│
├── docs/
│   └── screenshots/                   ← Imágenes para documentación
│
```

---

## Setup Inicial

### 1. Clonar y dependencias

```bash
git clone <repo-url>
cd dynamic-api-gateway-with-service-discovery

# Instalar desde raíz (npm workspaces)
npm install
```

### 2. Configurar AWS CLI

```bash
aws configure
# Ingresar: Access Key ID, Secret Access Key, región (us-east-1), output format (json)

# Verificar credenciales
aws sts get-caller-identity
```

### 3. Bootstrap CDK (una sola vez)

```bash
cd infra
npx cdk bootstrap
# Crea bucket S3 y rol IAM necesarios para CDK en tu cuenta
```

### 4. Desplegar infraestructura

```bash
# Desde raíz del repo
cd infra
npx cdk synth          # Genera CloudFormation template
npx cdk deploy --all   # Despliega todos los stacks

# O para ver cambios antes de deploying:
npx cdk diff
```

**Salida esperada:**
- `ServiceRegistryStack` → tabla DynamoDB (nombre se muestra en outputs)
- `UsersEc2Stack` y `OrdersEc2Stack` → instancias EC2 con servicios en 3000/3001
- `LambdaRouterStack` → Lambda Router con `SERVICE_REGISTRY_TABLE`
- `ApiGatewayStack` → URL del API Gateway (stage `dev`), usarla como `API_URL`

Variables útiles:
- `SERVICE_GIT_REPO`: repo que clonan las instancias EC2 (por defecto este repo)
- `DEPLOY_ONLY_EC2=true DYNAMODB_TABLE=<tabla>`: despliega solo EC2 usando una tabla existente (no crea DynamoDB, Lambda ni API Gateway)
- `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION`: sobreescribir cuenta/región (por defecto 646981656470 / us-east-1)

---

## Implementación

### Paso 1: Verify DynamoDB Registry

```bash
aws dynamodb scan --table-name <tabla ServiceRegistry> --region us-east-1
```

**Salida esperada** (2 items):
```json
{
  "Items": [
    {
      "serviceName": {"S": "users"},
      "host": {"S": "10.0.5.23"},
      "port": {"N": "3000"},
      "ttl": {"N": "1738300000"}
    },
    {
      "serviceName": {"S": "orders"},
      "host": {"S": "10.0.6.15"},
      "port": {"N": "3001"},
      "ttl": {"N": "1738300000"}
    }
  ]
}
```

### Paso 2: Probar routing básico

```bash
# Usar tu API Gateway URL (de outputs de cdk deploy)
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev"

# Probar users service
curl -i "$API_URL/users/health"
# Esperado: 200 OK, JSON response

# Probar orders service
curl -i "$API_URL/orders/orders"
# Esperado: 200 OK, JSON response
```

### Paso 3: Verificar logs (CloudWatch)

```bash
# Lambda Router logs
aws logs tail /aws/lambda/lambda-router --follow --region us-east-1

# EC2 services: los contenedores escriben a docker logs en la instancia.
# Si necesitas verlos, conéctate por SSH y ejecuta:
#   docker logs users
#   docker logs orders
```

---

## Pruebas (Compatible AWS Academy)

**Nota**: AWS Academy tiene limitaciones de recursos (compute, networking, API calls). Las pruebas están diseñadas para ser **ligeras y funcionales**, no de carga/stress.

### Pruebas Funcionales (Manual)

Estas pruebas verifican que el sistema funciona correctamente sin sobrecargar AWS Academy.

#### 1. Test de Descubrimiento de Servicios

```bash
# Nombre de tabla desde outputs de CDK
TABLE_NAME="<ServiceRegistryStack tabla>"   # ej: ServiceRegistryStack-ServiceRegistryC10B6608-D2AX099FCN8Y

# Verificar que servicios están registrados en DynamoDB
aws dynamodb scan --table-name "$TABLE_NAME" --region us-east-1 --output table

# Esperado: 2 items (users, orders)
```

**Validación**: ✅ Ambos servicios listados

#### 2. Test de Routing Dinámico

```bash
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev"  # output de ApiGatewayStack

# Test 1: GET /users/health
echo "=== Test 1: Users Health ==="
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL/users/health"
# Esperado: 200, respuesta JSON

# Test 2: GET /users/list
echo -e "\n=== Test 2: Users List ==="
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL/users/list"
# Esperado: 200, array de usuarios

# Test 3: GET /orders/orders
echo -e "\n=== Test 3: Orders List ==="
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL/orders/orders"
# Esperado: 200, array de órdenes
```

**Validación**: ✅ Los 3 tests retornan 200 OK

#### 3. Test de Error Handling

```bash
# Test 4: Servicio no existente
echo -e "\n=== Test 4: Non-existent Service ==="
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL/unknown/path"
# Esperado: 404 o 502 (servicio no existe)

# Test 5: Path inválido
echo -e "\n=== Test 5: Invalid Path ==="
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL"
# Esperado: 404
```

**Validación**: ✅ Errores manejados correctamente

#### 4. Test de Monitoreo (CloudWatch)

```bash
# Ver últimos 10 logs del Router
aws logs get-log-events \
  --log-group-name /aws/lambda/lambda-router \
  --log-stream-name <STREAM_NAME> \
  --limit 10 \
  --region us-east-1

# Verificar métricas
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=lambda-router \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --region us-east-1
```

**Validación**: ✅ Logs muestran invocaciones exitosas

### Script de Pruebas Automatizadas (Bash)

Ejecuta el script `test.sh` (ya incluido en el repo). Flags opcionales para entornos restringidos (AWS Academy):

- `SKIP_LOGS=true` omite verificación de CloudWatch
- `SKIP_PERF=true` omite medición de latencia
- `SKIP_API=true` omite pruebas que requieren API Gateway (útil si usaste `DEPLOY_ONLY_EC2=true`)

Ejemplo:

```bash
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev" \  # requerido para pruebas de API
DYNAMODB_TABLE="<tabla ServiceRegistry>" \                              # opcional, por defecto usa la de infra.ts
SKIP_LOGS=true \                                                         # opcional
./test.sh
```

**Ejecutar**:
```bash
chmod +x test.sh
./test.sh
```

### Matriz de Pruebas

| Prueba | Descripción | Comando | Esperado |
|--------|-----------|---------|----------|
| **Descubrimiento** | Servicios en DynamoDB | `aws dynamodb scan --table-name <tabla ServiceRegistry>` | 2 items |
| **Health Check** | Endpoint de usuarios | `curl /dev/users/health` | 200 OK |
| **List Users** | Obtener usuarios | `curl /dev/users/list` | 200 OK + JSON |
| **List Orders** | Obtener órdenes | `curl /dev/orders/orders` | 200 OK + JSON |
| **Error 404** | Servicio inexistente | `curl /dev/unknown/path` | 404 |
| **Logs Lambda** | Verificar router logs | `aws logs tail /aws/lambda/lambda-router` | Invocaciones visibles |

---

## Monitoreo

### CloudWatch Dashboard (Manual)

1. **AWS Console** → CloudWatch → Dashboards
2. **Crear Dashboard** con:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Router Invocations"}],
          ["AWS/Lambda", "Duration", {"stat": "Average", "label": "Router Duration"}],
          ["AWS/Lambda", "Errors", {"stat": "Sum", "label": "Router Errors"}],
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", {"stat": "Sum"}],
          ["AWS/ECS", "CPUUtilization", {"stat": "Average"}],
          ["AWS/ECS", "MemoryUtilization", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1"
      }
    }
  ]
}
```

### Métricas Clave

```bash
# Invocaciones Lambda
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=lambda-router \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Errores Lambda
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=lambda-router \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## Resolución de Problemas

### Problema: Servicio no aparece en DynamoDB

**Síntomas**: `aws dynamodb scan --table-name ServiceRegistry` retorna 0 items

**Causas**:
1. ECS Task no completó startup
2. Task no pudo conectar a DynamoDB
3. Security Group restringe conexión

**Solución**:
```bash
# 1. Identificar la instancia EC2
aws ec2 describe-instances \
  --filters "Name=tag:aws:cloudformation:stack-name,Values=UsersEc2Stack" \
  --query "Reservations[].Instances[].InstanceId" --output text

# 2. Conectarse por SSH (clave del laboratorio) y revisar el contenedor
# ssh -i <key.pem> ec2-user@<public-ip>
# docker ps
# docker logs users

# 3. Validar que la variable DYNAMODB_TABLE esté correcta dentro del contenedor

# 4. Esperar 30-60 segundos y verificar nuevamente
aws dynamodb scan --table-name <tabla ServiceRegistry> --region us-east-1
```

### Problema: API Gateway retorna 502

**Síntomas**: `curl /dev/users/health` → HTTP 502

**Causas**:
1. Lambda Router no puede alcanzar el servicio
2. Servicio está down
3. Security Group restringe tráfico

**Solución**:
```bash
# 1. Ver logs del router
aws logs tail /aws/lambda/lambda-router --follow --region us-east-1

# 2. Verificar que el servicio está corriendo en su instancia EC2
aws ec2 describe-instances \
  --filters "Name=tag:aws:cloudformation:stack-name,Values=UsersEc2Stack" \
  --query "Reservations[].Instances[].PublicIpAddress" --output text
# ssh -i <key.pem> ec2-user@<ip>
# docker ps
# docker logs users

# 3. Verificar IP del servicio en DynamoDB
aws dynamodb get-item --table-name <tabla ServiceRegistry> \
  --key '{"serviceName":{"S":"users"}}' --region us-east-1

# 4. Probar conectividad desde Lambda (si es posible)
# Intentar manual desde el host del servicio:
# ssh -i <key> ec2-user@<instance-ip>
# curl http://10.0.x.x:3000/health
```

### Problema: Alta latencia

**Síntomas**: Requests toman > 1 segundo

**Causas**:
1. DynamoDB está throttleado (cuota AWS Academy)
2. CPU/memoria de la instancia EC2 saturada
3. Network latency

**Solución**:
```bash
# Ver duración Lambda
aws logs insights --log-group-name /aws/lambda/lambda-router \
  --query-string 'fields @duration | stats avg(@duration) as avg_duration'

# Ver CPU de instancia EC2 (cambia INSTANCE_ID por el valor del stack)
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=<INSTANCE_ID> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Average --region us-east-1

# Ver throttling DynamoDB
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ReadThrottleEvents \
  --dimensions Name=TableName,Value=ServiceRegistry \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Problema: CDK Deploy Falla

**Síntomas**: `cdk deploy --all` → exit code 1

**Causas comunes en AWS Academy**:
1. Cuota IAM insuficiente
2. Región no permitida
3. Permisos faltantes

**Solución**:
```bash
# Ver error detallado
npx cdk deploy --all --verbose

# Probar deploy individual por stack
npx cdk deploy ServiceRegistryStack
npx cdk deploy UsersEc2Stack
npx cdk deploy OrdersEc2Stack
npx cdk deploy LambdaRouterStack
npx cdk deploy ApiGatewayStack

# Si falla, revisar IAM
aws iam get-user
aws iam list-roles

# Si necesita usar un rol específico
npx cdk deploy --role-arn arn:aws:iam::<ACCOUNT>:role/<ROLE_NAME>
```

---

## Anexos

### Comandos Útiles

#### Logs
```bash
# Tail logs Lambda Router en vivo
aws logs tail /aws/lambda/lambda-router --follow --region us-east-1

# Últimos 20 logs
aws logs tail /aws/lambda/lambda-router --max-items 20 --region us-east-1

# Logs de servicios EC2: acceder por SSH a la instancia y usar docker logs
# ssh -i <key.pem> ec2-user@<ip>
# docker logs users
# docker logs orders
```

#### DynamoDB
```bash
# Listar todos los servicios registrados
aws dynamodb scan --table-name <tabla ServiceRegistry> --region us-east-1

# Buscar servicio específico
aws dynamodb get-item \
  --table-name <tabla ServiceRegistry> \
  --key '{"serviceName":{"S":"users"}}' \
  --region us-east-1

# Eliminar registro manual (si es necesario)
aws dynamodb delete-item \
  --table-name <tabla ServiceRegistry> \
  --key '{"serviceName":{"S":"orders"}}' \
  --region us-east-1
```

#### CloudWatch Metrics
```bash
# Ver invocaciones Lambda último 1 hora
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=lambda-router \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Variables de Entorno

```bash
# En ~/.zshrc o ~/.bashrc
export AWS_REGION=us-east-1
export API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev"   # output de ApiGatewayStack
export DYNAMODB_TABLE="ServiceRegistryStack-ServiceRegistryC10B6608-D2AX099FCN8Y" # o el valor real del deploy

# Ejecutar pruebas (omitir logs si tienes permisos limitados)
SKIP_LOGS=true SKIP_API=true ./test.sh
```

### Estructura de DynamoDB Item

```json
{
  "serviceName": "users",
  "host": "10.0.5.23",
  "port": 3000,
  "ttl": 1738300000,
  "timestamp": "2024-01-15T10:30:45Z",
  "version": "1.0.0"
}
```

---

## Licencia

MIT

---

**Última actualización**: Enero 2024

Para preguntas o issues, revisar la documentación de AWS CDK: https://docs.aws.amazon.com/cdk/
