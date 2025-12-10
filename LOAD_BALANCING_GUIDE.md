# 🎯 Guía de Implementación: Lambda Load Balancer con Round Robin

## ✅ Cambios Implementados

### 1. **DynamoDB Schema Actualizado**
- ✅ **Partition Key**: `serviceName` (ej: "users")
- ✅ **Sort Key**: `instanceId` (ej: "i-0abc123")
- ✅ **Soporte múltiples instancias** del mismo servicio
- ✅ **TTL**: Limpieza automática de registros obsoletos

### 2. **Lambda Router con Round Robin**
- ✅ **Obtiene TODAS las instancias** de un servicio desde DynamoDB
- ✅ **Algoritmo Round Robin** para distribuir tráfico
- ✅ **Tracking de conexiones activas** por instancia
- ✅ **Metadata en response** (instancia seleccionada, latencia, algoritmo)

### 3. **Registro de Servicios Mejorado**
- ✅ **Instance ID** automático (de EC2 metadata o fallback)
- ✅ **Soporte para múltiples instancias** con mismo serviceName
- ✅ **TTL de 24 horas** para auto-cleanup

---

## 🚀 Deployment

### Paso 1: Destruir Tabla DynamoDB Anterior (IMPORTANTE)

```bash
# ⚠️ La tabla existente NO tiene sort key, necesitamos recrearla
cd infra

# Destruir solo el stack de DynamoDB
npx cdk destroy ServiceRegistryStack

# Confirmar: yes
```

### Paso 2: Deploy Completo

```bash
# Build
npm run build

# Deploy todos los stacks
npx cdk deploy --all

# O deploy individual:
npx cdk deploy ServiceRegistryStack  # DynamoDB nueva
npx cdk deploy LambdaRouterStack     # Lambda con Round Robin
npx cdk deploy UsersEc2Stack         # Primera instancia users
npx cdk deploy OrdersEc2Stack        # Primera instancia orders
npx cdk deploy ApiGatewayStack       # API Gateway
```

**Tiempo estimado:** 8-10 minutos

### Paso 3: Lanzar Instancias Adicionales (Para Load Balancing)

Para probar Round Robin, necesitas **2+ instancias del mismo servicio**:

```bash
# Opción A: Crear stacks adicionales en infra/bin/infra.ts

new Ec2ServiceStack(app, "UsersEc2Stack2", {
  env,
  serviceName: "users",  // ← Mismo nombre
  serviceDirectory: "services/users",
  servicePort: 3000,
  dynamoDbTableName: dynamoTableName,
  gitRepoUrl: repoUrl,
});

new Ec2ServiceStack(app, "UsersEc2Stack3", {
  env,
  serviceName: "users",  // ← Mismo nombre
  serviceDirectory: "services/users",
  servicePort: 3000,
  dynamoDbTableName: dynamoTableName,
  gitRepoUrl: repoUrl,
});

# Luego deploy:
npx cdk deploy UsersEc2Stack2 UsersEc2Stack3
```

```bash
# Opción B: Lanzar manualmente desde AWS Console
# 1. EC2 → Launch Instance
# 2. Copiar User Data del stack existente
# 3. Launch
```

---

## 🧪 Testing

### Test 1: Verificar Registro en DynamoDB

```bash
# Listar todos los servicios registrados
aws dynamodb scan \
  --table-name ServiceRegistryStack-ServiceRegistryC10B6608-XXXXX \
  --region us-east-1

# Buscar instancias de "users"
aws dynamodb query \
  --table-name ServiceRegistryStack-ServiceRegistryC10B6608-XXXXX \
  --key-condition-expression "serviceName = :serviceName" \
  --expression-attribute-values '{":serviceName":{"S":"users"}}' \
  --region us-east-1
```

**Output esperado:**
```json
{
  "Items": [
    {
      "serviceName": {"S": "users"},
      "instanceId": {"S": "i-0abc123def456"},
      "host": {"S": "54.123.45.67"},
      "port": {"N": "3000"},
      "weight": {"N": "1"},
      "timestamp": {"S": "2024-12-09T10:30:00Z"},
      "ttl": {"N": "1733832600"}
    },
    {
      "serviceName": {"S": "users"},
      "instanceId": {"S": "i-0def456ghi789"},
      "host": {"S": "54.123.45.68"},
      "port": {"N": "3000"},
      "weight": {"N": "1"},
      "timestamp": {"S": "2024-12-09T10:32:00Z"},
      "ttl": {"N": "1733832720"}
    }
  ],
  "Count": 2
}
```

### Test 2: Verificar Round Robin

```bash
API_URL="https://xxx.execute-api.us-east-1.amazonaws.com/dev"

# Hacer 10 requests y observar rotación
for i in {1..10}; do
  echo "Request $i:"
  curl -s "$API_URL/users/health" | jq '._loadBalancer'
done
```

**Output esperado (con 3 instancias):**
```json
// Request 1
{
  "selectedInstance": "i-0abc123def456",
  "algorithm": "round-robin",
  "latency": "45ms",
  "totalInstances": 3,
  "host": "54.123.45.67:3000"
}

// Request 2
{
  "selectedInstance": "i-0def456ghi789",
  "algorithm": "round-robin",
  "latency": "38ms",
  "totalInstances": 3,
  "host": "54.123.45.68:3000"
}

// Request 3
{
  "selectedInstance": "i-0ghi789jkl012",
  "algorithm": "round-robin",
  "latency": "42ms",
  "totalInstances": 3,
  "host": "54.123.45.69:3000"
}

// Request 4 (vuelve al inicio)
{
  "selectedInstance": "i-0abc123def456",
  "algorithm": "round-robin",
  "latency": "40ms",
  "totalInstances": 3,
  "host": "54.123.45.67:3000"
}
```

### Test 3: Headers de Load Balancer

```bash
curl -I "$API_URL/users/health"

# Headers esperados:
# X-Selected-Instance: i-0abc123def456
# X-Load-Balancer: lambda-round-robin
# X-Total-Instances: 3
```

### Test 4: Distribución Uniforme (Stress Test)

```bash
# Hacer 100 requests y contar distribución
for i in {1..100}; do
  curl -s "$API_URL/users/health" | jq -r '._loadBalancer.selectedInstance'
done | sort | uniq -c

# Output esperado (con 3 instancias):
#   33 i-0abc123def456
#   33 i-0def456ghi789
#   34 i-0ghi789jkl012
# ← Distribución uniforme ~33% cada una
```

### Test 5: CloudWatch Logs

```bash
# Ver logs del Lambda Router
aws logs tail /aws/lambda/LambdaRouterStack-RouterLambda --follow --region us-east-1

# Buscar líneas de Round Robin:
# [Round Robin] Service: users, Selected: i-0abc123def456 (54.123.45.67:3000), Counter: 0
# [Round Robin] Service: users, Selected: i-0def456ghi789 (54.123.45.68:3000), Counter: 1
# [Round Robin] Service: users, Selected: i-0ghi789jkl012 (54.123.45.69:3000), Counter: 2
```

---

## 📊 Comparación: Antes vs Después

### **Antes (Sin Round Robin)**

```
Lambda → DynamoDB get(serviceName="users")
       → Retorna: { ip: "54.123.45.67" }
       → HTTP request SIEMPRE a 54.123.45.67

❌ Single Point of Failure
❌ No load balancing
❌ Una instancia saturada = alta latencia
```

### **Después (Con Round Robin)**

```
Lambda → DynamoDB query(serviceName="users")
       → Retorna: [
           { instanceId: "i-abc", ip: "54.123.45.67" },
           { instanceId: "i-def", ip: "54.123.45.68" },
           { instanceId: "i-ghi", ip: "54.123.45.69" }
         ]
       → Round Robin selecciona: "i-abc" (counter=0)
       → HTTP request a 54.123.45.67
       
       → Siguiente request: "i-def" (counter=1)
       → Siguiente request: "i-ghi" (counter=2)
       → Siguiente request: "i-abc" (counter=3, vuelve al inicio)

✅ Alta disponibilidad (3 instancias)
✅ Load balancing automático
✅ Distribución uniforme de tráfico
✅ Resiliente a fallos (si 1 cae, quedan 2)
```

---

## 💡 Ventajas de Esta Implementación

### 1. **Costo $0** (vs $22.77/mes del ALB)
```
ALB: $22.77/mes
Lambda LB: $0 (free tier)
Ahorro anual: $273.24
```

### 2. **Educativo**
- ✅ Código visible y modificable
- ✅ Logs detallados de cada decisión
- ✅ Entiendes cómo funciona internamente
- ✅ Fácil agregar otros algoritmos (Least Connections, Weighted, etc.)

### 3. **Flexible**
```javascript
// Cambiar a Least Connections:
const selectedInstance = selectInstanceLeastConnections(serviceName, instances);

// Cambiar a Weighted Round Robin:
const selectedInstance = selectInstanceWeightedRoundRobin(serviceName, instances);

// Cambiar a Health-Aware:
const selectedInstance = await selectInstanceHealthAware(serviceName, instances);
```

### 4. **Sin Límites AWS Academy**
- ALB: Límite de 2-3 ALBs
- Lambda LB: Ilimitado

### 5. **Metadata Rica**
```json
{
  "selectedInstance": "i-0abc123",
  "algorithm": "round-robin",
  "latency": "42ms",
  "totalInstances": 3,
  "host": "54.123.45.67:3000"
}
```

---

## 🔧 Troubleshooting

### Problema 1: "Service not found"

**Causa:** Instancias no se registraron en DynamoDB

**Solución:**
```bash
# 1. SSH a la instancia
ssh -i key.pem ec2-user@<ip>

# 2. Ver logs del contenedor
docker logs users

# Esperado:
# ✓ Service 'users' (i-0abc123) successfully registered with IP: 54.123.45.67:3000

# 3. Si no aparece, verificar variables de entorno
docker inspect users | grep -A 10 Env
# Debe tener: DYNAMODB_TABLE=ServiceRegistryStack-...
```

### Problema 2: Siempre selecciona la misma instancia

**Causa:** Solo hay 1 instancia registrada

**Solución:**
```bash
# Verificar cuántas instancias hay
aws dynamodb query \
  --table-name ServiceRegistryStack-ServiceRegistryC10B6608-XXXXX \
  --key-condition-expression "serviceName = :serviceName" \
  --expression-attribute-values '{":serviceName":{"S":"users"}}' \
  --region us-east-1 \
  --query 'Count'

# Si Count = 1, lanzar más instancias
```

### Problema 3: Contador no persiste entre requests

**Causa:** Lambda cold start (nueva instancia)

**Solución:** Esto es normal. El contador persiste en invocaciones **warm** (mismo contenedor). Para persistencia completa:

```javascript
// Usar DynamoDB para guardar estado (opcional)
async function getCounter(serviceName) {
  const result = await dynamo.get({
    TableName: "LoadBalancerState",
    Key: { serviceName },
  }).promise();
  return result.Item?.counter || 0;
}
```

### Problema 4: Error "Cannot read property 'length' of undefined"

**Causa:** DynamoDB query no retorna Items

**Solución:**
```javascript
// El código ya maneja esto:
if (!result.Items || result.Items.length === 0) {
  throw new Error(`Service ${serviceName} not found in registry`);
}
```

Verificar que las instancias estén registradas correctamente.

---

## 📈 Próximos Pasos (Opcionales)

### 1. Agregar Health Checks

```javascript
async function getHealthyInstances(instances) {
  const healthChecks = await Promise.all(
    instances.map(async (instance) => {
      try {
        const response = await axios.get(
          `http://${instance.host}:${instance.port}/health`,
          { timeout: 2000 }
        );
        return { instance, healthy: response.status === 200 };
      } catch {
        return { instance, healthy: false };
      }
    })
  );
  
  return healthChecks
    .filter(({ healthy }) => healthy)
    .map(({ instance }) => instance);
}

// Usar en selectInstanceRoundRobin:
const healthyInstances = await getHealthyInstances(instances);
return selectInstanceRoundRobin(serviceName, healthyInstances);
```

### 2. Métricas en CloudWatch

```javascript
const cloudwatch = new AWS.CloudWatch();

await cloudwatch.putMetricData({
  Namespace: "CustomLoadBalancer",
  MetricData: [{
    MetricName: "RequestsPerInstance",
    Dimensions: [{ Name: "InstanceId", Value: selectedInstance.instanceId }],
    Value: 1,
    Unit: "Count",
  }],
}).promise();
```

### 3. Algoritmos Adicionales

Ver documento completo: **[LOAD_BALANCING_WITHOUT_ALB.md](./LOAD_BALANCING_WITHOUT_ALB.md)**

- Least Connections
- Weighted Round Robin
- Health-Aware Routing
- Circuit Breaker

---

## 🎯 Resumen

✅ **Lambda Load Balancer con Round Robin implementado**
✅ **DynamoDB con soporte para múltiples instancias**
✅ **Registro automático con instanceId**
✅ **Metadata rica en responses**
✅ **Costo: $0 (free tier)**
✅ **Sin límites de AWS Academy**

**Siguiente:** Deploy y test! 🚀

```bash
cd infra
npx cdk destroy ServiceRegistryStack  # Recrear tabla
npx cdk deploy --all                   # Deploy completo
# Luego seguir Tests arriba
```
