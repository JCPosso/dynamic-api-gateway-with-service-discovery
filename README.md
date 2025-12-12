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
9. [Autor](#autor)

---

## Desafío Técnico

### Configuración Estática

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

### Solución: Service Discovery Dinámico

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
- **Agnóstico**: Gateway no conoce servicios específicos
- **Auto-escalable**: Nuevos servicios se registran automáticamente
- **Resiliente**: TTL en DynamoDB limpia registros obsoletos
- **Agnóstico de IP**: Soporta cambios de infraestructura
- **Sin redeploy**: Agregar servicio no requiere cambiar gateway

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

| Componente | Descripción |
|-----------|-----------|
| **API Gateway** | Endpoint público que enruta todo a Lambda |
| **Lambda Router** | Node.js handler que consulta registry y hace proxy HTTP |
| **DynamoDB ServiceRegistry** | Tabla con servicios activos y sus endpoints |
| **EC2 Services** | 2 microservicios: users:3000, orders:3001 |
| **CloudWatch** | Logs y métricas |

---

## Requisitos

### Local (Desarrollo)

- **Node.js** >= 18
- **npm** o yarn
- **Docker** (para build de imágenes)
- **AWS CLI** v2 configurado con credenciales
- **AWS CDK** v2 (`npm install -g aws-cdk`)
---
### 1. Clonar y dependencias

```bash
git clone <repo-url>
cd dynamic-api-gateway-with-service-discovery

# Instalar desde raíz
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
# Crea bucket S3 y rol IAM necesarios para CDK
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

## Pruebas
### Pruebas Funcionales

#### 1. Test de Descubrimiento de Servicios

```bash
# Nombre de tabla desde outputs de CDK
TABLE_NAME="<ServiceRegistryStack tabla>"   # ej: ServiceRegistryStack-ServiceRegistryC10B6608-D2AX099FCN8Y

# Verificar que servicios están registrados en DynamoDB
aws dynamodb scan --table-name "$TABLE_NAME" --region us-east-1 --output table

# Esperado: 2 items (users, orders)
```

**Validación**: Ambos servicios listados

#### 2. Test de Routing Dinámico

```bash
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev"  # output de ApiGatewayStack

# Test 1: GET /users/health
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL/users/health"
# Esperado: 200, respuesta JSON

# Test 2: GET /users/list
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL/users/list"
# Esperado: 200, array de usuarios

# Test 3: GET /orders/orders
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL/orders/orders"
# Esperado: 200, array de órdenes
```

**Validación**: Los 3 tests retornan 200 OK

#### 3. Test de Error Handling

```bash
# Test 4: Servicio no existente
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL/unknown/path"
# Esperado: 404 o 502 (servicio no existe)

# Test 5: Path inválido
curl -w "\nHTTP Status: %{http_code}\n" "$API_URL"
# Esperado: 404
```

**Validación**:

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

**Validación**: Logs muestran invocaciones exitosas

### Script de Pruebas Automatizadas

Ejecutar el script `test.sh`:

- `SKIP_LOGS=true` omite verificación de CloudWatch
- `SKIP_PERF=true` omite medición de latencia
- `SKIP_API=true` omite pruebas que requieren API Gateway

Ejemplo:

```bash
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev" \
# requerido para pruebas de API
DYNAMODB_TABLE="<tabla ServiceRegistry>" \  # opcional
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
### Stress Tests

El proyecto incluye stress tests completos para validar rendimiento bajo carga:

```bash
chmod +x stress-test.sh
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev" ./stress-test.sh
```

**Tests incluidos:**
1. Baseline (latencia individual)
2. Carga baja (50 requests, 5 concurrent)
3. Carga media (100 requests, 10 concurrent)
4. Multi-service routing (users + orders)
5. Sustained load (200 requests sostenidos)
6. DynamoDB query performance

**Requisitos:**
- Apache Bench (`ab`) - incluido en macOS, o instalar con `brew install httpd`
- AWS CLI configurado
- API URL del deployment

**Métricas validadas:**
- Performance: Latencia P50, P95, P99
- Scalability: Throughput (req/s)
- Reliability: Error rate
- Availability: Uptime durante carga

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


## Autor

**Juan Camilo Posso**

- GitHub: [@JCPosso](https://github.com/JCPosso)
- Proyecto académico para AYGO (Arquitectura y Gestión de Operaciones)
---

## Licencia

MIT

---
