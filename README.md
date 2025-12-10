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
10. [Trade-offs: AWS Academy vs Producción](#trade-offs-aws-academy-vs-producción)
11. [Anexos](#anexos)

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
### Stress Tests

El proyecto incluye stress tests completos para validar rendimiento bajo carga:

```bash
chmod +x stress-test.sh
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev" ./stress-test.sh
```

**Tests incluidos:**
1. ✅ Baseline (latencia individual)
2. ✅ Carga baja (50 requests, 5 concurrent)
3. ✅ Carga media (100 requests, 10 concurrent)
4. ✅ Multi-service routing (users + orders)
5. ✅ Sustained load (200 requests sostenidos)
6. ✅ DynamoDB query performance

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

## Trade-offs: AWS Academy vs Producción

### 🎓 Limitaciones del Prototipo (AWS Academy)

Este prototipo está **optimizado para AWS Academy**, que tiene restricciones de recursos, permisos y costos. A continuación se documentan las decisiones de diseño y cómo se implementarían en un entorno de producción real.

---

### 1️⃣ **Availability & Reliability**

#### ❌ **Prototipo AWS Academy**
```typescript
// ec2-service-stack.ts
this.instance = new ec2.Instance(this, `${props.serviceName}Instance`, {
  vpc,
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
});
```

**Limitaciones:**
- ⚠️ **Single Point of Failure (SPOF)**: 1 instancia EC2 por servicio
- ⚠️ **No Multi-AZ**: Todas las instancias en una sola Availability Zone
- ⚠️ **Sin redundancia**: Si la instancia falla, el servicio está down hasta que se recupere
- ⚠️ **Health checks manuales**: Dependemos de TTL en DynamoDB para limpiar servicios caídos

**Razón:** AWS Academy limita:
- Número de instancias EC2 simultáneas
- Uso de Auto Scaling Groups
- Despliegue en múltiples AZs

#### ✅ **Arquitectura de Producción**

```typescript
// production-service-stack.ts (conceptual)
const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ServiceTG', {
  vpc,
  port: props.servicePort,
  protocol: elbv2.ApplicationProtocol.HTTP,
  healthCheck: {
    path: '/health',
    interval: Duration.seconds(30),
    timeout: Duration.seconds(5),
    healthyThresholdCount: 2,
    unhealthyThresholdCount: 3,
  },
});

const asg = new autoscaling.AutoScalingGroup(this, 'ServiceASG', {
  vpc,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
  machineImage: ami,
  minCapacity: 2,    // Mínimo 2 instancias
  maxCapacity: 10,   // Escalado hasta 10
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'], // Multi-AZ
  },
  healthCheck: autoscaling.HealthCheck.elb({ grace: Duration.seconds(60) }),
});

asg.scaleOnCpuUtilization('CpuScaling', {
  targetUtilizationPercent: 70,
});

const alb = new elbv2.ApplicationLoadBalancer(this, 'ServiceALB', {
  vpc,
  internetFacing: false,  // Interno (VPC privado)
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
});

alb.addListener('HttpListener', {
  port: 80,
  defaultTargetGroups: [targetGroup],
});

targetGroup.addTarget(asg);
```

**Mejoras en Producción:**
- ✅ **Application Load Balancer**: Distribuye tráfico entre instancias sanas
- ✅ **Auto Scaling Group**: Escala automáticamente de 2 a 10 instancias según CPU
- ✅ **Multi-AZ**: Instancias distribuidas en 3 Availability Zones
- ✅ **Health Checks**: ELB retira automáticamente instancias no saludables
- ✅ **Private Subnets**: Instancias no expuestas directamente a Internet

---

### 2️⃣ **Security**

#### ❌ **Prototipo AWS Academy**
```typescript
// ec2-service-stack.ts
securityGroup.addIngressRule(
  ec2.Peer.ipv4(vpc.vpcCidrBlock),  // Solo VPC
  ec2.Port.tcp(props.servicePort),
  `Allow port ${props.servicePort} from VPC only`
);

// SSH abierto (debugging)
securityGroup.addIngressRule(
  ec2.Peer.anyIpv4(),  // ⚠️ 0.0.0.0/0
  ec2.Port.tcp(22),
  "SSH for debugging (remove in production)"
);

// Usa LabRole existente
const role = iam.Role.fromRoleArn(
  this,
  `${props.serviceName}InstanceRole`,
  "arn:aws:iam::646981656470:role/LabRole"
);
```

**Vulnerabilidades:**
- ⚠️ **SSH abierto a Internet** (0.0.0.0/0): Expuesto a ataques de fuerza bruta
- ⚠️ **HTTP sin cifrar**: Comunicación interna en texto plano
- ⚠️ **LabRole con permisos amplios**: Principio de menor privilegio no aplicado
- ⚠️ **Sin API Key en API Gateway**: Cualquiera puede invocar el endpoint público
- ⚠️ **Sin WAF**: No hay protección contra DDoS, SQL injection, etc.

**Razón:** AWS Academy:
- No permite crear roles IAM personalizados
- No permite AWS WAF
- Acceso SSH necesario para debugging sin VPN

#### ✅ **Arquitectura de Producción**

```typescript
// production-service-stack.ts (conceptual)

// 1. Bastion Host en subnet pública (único punto de acceso SSH)
const bastionSG = new ec2.SecurityGroup(this, 'BastionSG', {
  vpc,
  description: 'Bastion Host SSH access',
});
bastionSG.addIngressRule(
  ec2.Peer.ipv4('203.0.113.0/24'),  // Solo IP corporativa
  ec2.Port.tcp(22),
  'SSH from corporate network only'
);

// 2. Instancias de servicio: NO exponen SSH directamente
const serviceSG = new ec2.SecurityGroup(this, 'ServiceSG', {
  vpc,
});
serviceSG.addIngressRule(
  ec2.Peer.securityGroupId(albSG.securityGroupId),  // Solo ALB
  ec2.Port.tcp(props.servicePort),
  'Allow HTTPS from ALB only'
);
serviceSG.addIngressRule(
  ec2.Peer.securityGroupId(bastionSG.securityGroupId),  // Solo Bastion
  ec2.Port.tcp(22),
  'SSH from Bastion only'
);

// 3. Rol IAM con permisos mínimos
const serviceRole = new iam.Role(this, 'ServiceRole', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
  ],
});

serviceRole.addToPolicy(new iam.PolicyStatement({
  actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
  resources: [props.dynamoDbTableArn],
  conditions: {
    'ForAllValues:StringEquals': {
      'dynamodb:LeadingKeys': [props.serviceName],  // Solo su propio registro
    },
  },
}));

// 4. HTTPS interno (ALB → Instances)
const certificate = new acm.Certificate(this, 'Certificate', {
  domainName: '*.internal.company.com',
  validation: acm.CertificateValidation.fromDns(),
});

alb.addListener('HttpsListener', {
  port: 443,
  protocol: elbv2.ApplicationProtocol.HTTPS,
  certificates: [certificate],
  defaultTargetGroups: [targetGroup],
});

// 5. API Gateway con autenticación
const apiKey = new apigateway.ApiKey(this, 'ApiKey', {
  description: 'API key for external clients',
});

const usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
  throttle: { rateLimit: 1000, burstLimit: 2000 },
  quota: { limit: 1000000, period: apigateway.Period.MONTH },
});
usagePlan.addApiKey(apiKey);

// 6. WAF para protección DDoS
const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
  scope: 'REGIONAL',
  defaultAction: { allow: {} },
  rules: [
    {
      name: 'RateLimitRule',
      priority: 1,
      statement: {
        rateBasedStatement: {
          limit: 2000,
          aggregateKeyType: 'IP',
        },
      },
      action: { block: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitRule',
      },
    },
  ],
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'WebAcl',
  },
});
```

**Mejoras en Producción:**
- ✅ **Bastion Host**: Único punto de acceso SSH desde red corporativa
- ✅ **HTTPS end-to-end**: ALB → Instances cifrado con TLS 1.3
- ✅ **IAM Least Privilege**: Rol con permisos específicos por servicio
- ✅ **API Key + Usage Plans**: Control de acceso y rate limiting por cliente
- ✅ **AWS WAF**: Protección contra DDoS, bots, SQL injection
- ✅ **Private Subnets**: Instancias sin IP pública

---

### 3️⃣ **Performance & Scalability**

#### ❌ **Prototipo AWS Academy**
```typescript
// api-gateway-stack.ts
deployOptions: {
  stageName: "dev",
  throttlingRateLimit: 20,      // ⚠️ Solo 20 req/s
  throttlingBurstLimit: 40,     // ⚠️ Solo 40 burst
}

// lambda-router-stack.ts
this.routerLambda = new lambda.Function(this, "RouterLambda", {
  runtime: lambda.Runtime.NODEJS_18_X,
  timeout: Duration.seconds(10),
  memorySize: 256,               // ⚠️ Bajo para producción
  // Sin VPC: cold start rápido pero sin caché de conexiones
});

// dynamodb-stack.ts
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // ⚠️ Sin capacity planning
```

**Limitaciones:**
- ⚠️ **Throttling bajo**: 20 req/s vs 10,000 req/s en producción
- ⚠️ **Sin caché**: Cada request consulta DynamoDB (latencia adicional)
- ⚠️ **Lambda fuera de VPC**: No puede reutilizar conexiones HTTP (conexión nueva cada vez)
- ⚠️ **DynamoDB On-Demand**: Más caro y menos predecible que provisioned capacity
- ⚠️ **Sin CDN**: Todo el tráfico va directo al API Gateway

**Razón:** AWS Academy:
- Límites de throughput
- Costos ($$$)
- Simplicidad de configuración

#### ✅ **Arquitectura de Producción**

```typescript
// production-api-gateway-stack.ts
const api = new apigateway.RestApi(this, 'Api', {
  deployOptions: {
    stageName: 'prod',
    throttlingRateLimit: 10000,   // 10k req/s
    throttlingBurstLimit: 20000,  // 20k burst
    cachingEnabled: true,
    cacheClusterEnabled: true,
    cacheClusterSize: '1.6',      // 1.6 GB caché
    cacheTtl: Duration.minutes(5),
  },
});

// Lambda en VPC con conexiones reutilizables
const routerLambda = new lambda.Function(this, 'RouterLambda', {
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  memorySize: 1024,               // Más memoria = más CPU
  timeout: Duration.seconds(30),
  reservedConcurrentExecutions: 100,  // Garantiza capacidad
  environment: {
    DYNAMODB_ENDPOINT: `https://dynamodb.${this.region}.amazonaws.com`,
    NODE_OPTIONS: '--enable-source-maps --max-old-space-size=900',
  },
});

// DynamoDB con DAX (caché)
const daxCluster = new dax.CfnCluster(this, 'DaxCluster', {
  iamRoleArn: daxRole.roleArn,
  nodeType: 'dax.t3.small',
  replicationFactor: 3,           // 3 nodos para HA
  subnetGroupName: daxSubnetGroup.ref,
});

// DynamoDB con provisioned capacity
const table = new dynamodb.Table(this, 'ServiceRegistry', {
  partitionKey: { name: 'serviceName', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PROVISIONED,
  readCapacity: 100,              // 100 RCU baseline
  writeCapacity: 10,              // 10 WCU baseline
  pointInTimeRecovery: true,
});

table.autoScaleReadCapacity({ minCapacity: 100, maxCapacity: 1000 })
  .scaleOnUtilization({ targetUtilizationPercent: 70 });

// CloudFront CDN (opcional para APIs públicas)
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.RestApiOrigin(api),
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
  },
  priceClass: cloudfront.PriceClass.PRICE_CLASS_100,  // USA, Europa
});
```

**Mejoras en Producción:**
- ✅ **API Gateway Cache**: Reduce latencia (5 min TTL) y costo de Lambda
- ✅ **DynamoDB DAX**: Caché en memoria (microsegundos vs milisegundos)
- ✅ **Lambda en VPC**: Reutiliza conexiones HTTP (connection pooling)
- ✅ **Reserved Concurrency**: Garantiza capacidad durante picos
- ✅ **Provisioned Capacity + Auto Scaling**: DynamoDB predecible y económico
- ✅ **CloudFront CDN**: Cachea respuestas en edge locations globales

**Comparación de latencia:**

| Componente | AWS Academy | Producción | Mejora |
|-----------|-------------|------------|--------|
| API Gateway | ~50ms | ~10ms (caché) | **5x** |
| Lambda Cold Start | ~300ms | ~150ms (VPC optimizado) | **2x** |
| DynamoDB | ~10ms | ~1ms (DAX) | **10x** |
| **Total (P50)** | **~360ms** | **~160ms** | **2.2x** |

---

### 4️⃣ **Observability & Monitoring**

#### ❌ **Prototipo AWS Academy**
```typescript
// Sin configuración explícita de métricas/alarmas
// Solo logs básicos en CloudWatch
```

**Limitaciones:**
- ⚠️ **Sin alarmas**: No hay notificaciones de errores o latencia alta
- ⚠️ **Sin tracing distribuido**: Difícil debuggear requests multi-servicio
- ⚠️ **Sin métricas custom**: Solo métricas básicas de AWS
- ⚠️ **Logs sin estructura**: Difícil de analizar (no JSON)

#### ✅ **Arquitectura de Producción**

```typescript
// X-Ray tracing
const routerLambda = new lambda.Function(this, 'RouterLambda', {
  tracing: lambda.Tracing.ACTIVE,  // X-Ray habilitado
});

// CloudWatch Logs Insights
const logGroup = new logs.LogGroup(this, 'RouterLogs', {
  retention: logs.RetentionDays.ONE_MONTH,
});

// Alarmas SNS
const alarmTopic = new sns.Topic(this, 'AlarmTopic');
alarmTopic.addSubscription(new subscriptions.EmailSubscription('ops@company.com'));

// Alarma: Errores Lambda > 5%
new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
  metric: routerLambda.metricErrors({ statistic: 'avg', period: Duration.minutes(5) }),
  threshold: 5,
  evaluationPeriods: 2,
  alarmDescription: 'Lambda error rate > 5%',
  actionsEnabled: true,
});
alarmTopic.addSubscription(new cloudwatch_actions.SnsAction(alarmTopic));

// Alarma: Latencia P99 > 1s
new cloudwatch.Alarm(this, 'LatencyAlarm', {
  metric: routerLambda.metricDuration({ statistic: 'p99', period: Duration.minutes(5) }),
  threshold: 1000,
  evaluationPeriods: 2,
});

// Dashboard
const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
  dashboardName: 'ServiceDiscoveryMetrics',
});
dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'Lambda Invocations',
    left: [routerLambda.metricInvocations()],
  }),
  new cloudwatch.GraphWidget({
    title: 'DynamoDB Throttles',
    left: [table.metricUserErrors()],
  }),
);
```

**Mejoras en Producción:**
- ✅ **AWS X-Ray**: Tracing distribuido (Lambda → DynamoDB → EC2)
- ✅ **CloudWatch Alarms**: Notificaciones automáticas por SNS/email/Slack
- ✅ **Structured Logging**: JSON logs para Logs Insights queries
- ✅ **Custom Metrics**: Métricas de negocio (ej: servicios registrados/activos)
- ✅ **Dashboards**: Visualización en tiempo real de SLIs/SLOs

---

### 5️⃣ **Cost Optimization**

#### ❌ **Prototipo AWS Academy**
- ✅ **T3.micro (free tier)**: Costo mínimo
- ⚠️ **DynamoDB On-Demand**: Más caro que provisioned
- ⚠️ **Instancias corriendo 24/7**: No hay shutdown automático

#### ✅ **Arquitectura de Producción**
```typescript
// Spot Instances para desarrollo
const asg = new autoscaling.AutoScalingGroup(this, 'ServiceASG', {
  spotPrice: '0.01',  // Hasta 90% descuento
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
});

// Lambda SnapStart (Java/Python)
const lambda = new lambda.Function(this, 'Router', {
  snapStart: lambda.SnapStartConf.ON_PUBLISHED_VERSIONS,  // Reduce cold starts
});

// S3 Intelligent-Tiering para logs
const logsBucket = new s3.Bucket(this, 'LogsBucket', {
  lifecycleRules: [
    {
      transitions: [
        { storageClass: s3.StorageClass.INTELLIGENT_TIERING, transitionAfter: Duration.days(30) },
        { storageClass: s3.StorageClass.GLACIER, transitionAfter: Duration.days(90) },
      ],
    },
  ],
});

// Compute Savings Plans
// (Requiere compromiso de 1-3 años, hasta 72% descuento)
```

**Ahorro estimado mensual (producción pequeña):**
- DynamoDB: PAY_PER_REQUEST ($125) → Provisioned ($25) = **$100**
- EC2: On-Demand ($73) → Spot ($7) = **$66**
- Lambda: Sin optimización ($50) → Provisioned Concurrency ($30) = **$20**
- **Total ahorro: ~$186/mes (~60%)**

---

### 📊 Resumen Comparativo

| Aspecto | AWS Academy (Prototipo) | Producción Real |
|---------|------------------------|-----------------|
| **Availability** | Single instance, Single AZ | Multi-AZ, ALB, ASG (min 2) |
| **Scalability** | Manual (1 instancia fija) | Auto Scaling (2-10 instancias) |
| **Throughput** | 20 req/s | 10,000 req/s |
| **Latency (P99)** | ~500ms | ~200ms (con caché/DAX) |
| **Security** | SSH público, HTTP, LabRole | Bastion, HTTPS, IAM granular, WAF |
| **Monitoring** | Logs básicos | X-Ray, Alarmas, Dashboards |
| **Cost/mes** | ~$50 | ~$200 (con optimizaciones) |
| **Recovery Time** | Manual (~10 min) | Automático (~2 min con ASG) |

---

### 🎯 Recomendaciones para Migración a Producción

**Prioridad Alta (Bloqueante para prod):**
1. ✅ Implementar Application Load Balancer + Auto Scaling Groups
2. ✅ Eliminar SSH público (usar Bastion o AWS Systems Manager Session Manager)
3. ✅ Agregar HTTPS end-to-end (ACM certificates)
4. ✅ Configurar CloudWatch Alarms para errores/latencia
5. ✅ Implementar Multi-AZ deployment

**Prioridad Media (Performance):**
6. ✅ Agregar DynamoDB DAX para caché
7. ✅ Habilitar API Gateway caching
8. ✅ Configurar Lambda reserved concurrency
9. ✅ Migrar a DynamoDB provisioned capacity

**Prioridad Baja (Nice to have):**
10. ✅ Implementar CloudFront CDN
11. ✅ Agregar AWS WAF rules
12. ✅ Habilitar AWS X-Ray tracing
13. ✅ Implementar Spot Instances para dev/staging

---

## Licencia

MIT

---

**Última actualización**: Diciembre 2024

Para preguntas o issues, revisar la documentación de AWS CDK: https://docs.aws.amazon.com/cdk/
