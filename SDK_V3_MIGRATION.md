# ✅ Migración a AWS SDK v3 - Completada

## 📋 Resumen de Cambios

### 1. **Archivos de Código Migrados**

#### `services/registerIp.js`
- ✅ Cambiado de `aws-sdk` (v2) a `@aws-sdk/client-dynamodb` y `@aws-sdk/lib-dynamodb` (v3)
- ✅ `new AWS.DynamoDB.DocumentClient()` → `DynamoDBDocumentClient.from(client)`
- ✅ `dynamo.put(params).promise()` → `dynamo.send(new PutCommand(params))`
- ✅ Mantiene estructura correcta: `serviceName` + `instanceId` (sort key)

#### `lambdas/router/handler.js`
- ✅ Migrado a `@aws-sdk/client-dynamodb` y `@aws-sdk/lib-dynamodb` (v3)
- ✅ `dynamo.query().promise()` → `dynamo.send(new QueryCommand())`
- ✅ Algoritmo Round Robin intacto

### 2. **Dependencias Actualizadas**

#### `services/users/package.json` & `services/orders/package.json`
```diff
- "aws-sdk": "^2.1450.0"
+ "@aws-sdk/client-dynamodb": "^3.600.0",
+ "@aws-sdk/lib-dynamodb": "^3.600.0"
```

#### `lambdas/router/package.json`
```diff
- "aws-sdk": "^2.1520.0"
+ "@aws-sdk/client-dynamodb": "^3.600.0",
+ "@aws-sdk/lib-dynamodb": "^3.600.0"
```

### 3. **Infraestructura**

- ✅ **Lambda Router**: Deployada con SDK v3 ✅
- ⏳ **EC2 Services**: Pendiente de redeploy (tienen código viejo en contenedores)

---

## 🐛 Error Original y Solución

### Error Encontrado:
```
✗ Error registering 'users' in DynamoDB: One or more parameter values were invalid: 
Missing the key instanceId in the item
```

### Causa:
El contenedor Docker en EC2 tenía versión antigua de `registerIp.js` que enviaba:
```javascript
{
  serviceName: "users",
  ip: "3.239.210.96",      // ❌ Campo incorrecto
  timestamp: 1765331904345,
  port: "3000"
}
```

### Solución Implementada:
Actualizado a enviar:
```javascript
{
  serviceName: "users",       // ✅ Partition Key
  instanceId: "i-0abc123",    // ✅ Sort Key (NUEVO)
  host: "3.239.210.96",       // ✅ Campo correcto
  port: 3000,
  weight: 1,
  timestamp: "2024-12-09T...",
  ttl: 1733835600
}
```

---

## 🚀 Próximos Pasos

### Opción A: Redeploy Automático (Recomendado)

```bash
./redeploy-services.sh
```

Este script:
1. ✅ Destruye stacks EC2 existentes
2. ✅ Redeploya todo con código actualizado
3. ✅ Espera 2-3 minutos para que servicios se registren
4. ✅ Verifica DynamoDB

**Tiempo estimado:** 10-12 minutos

### Opción B: Redeploy Manual

```bash
cd infra

# Destruir servicios EC2 viejos
cdk destroy UsersEc2Stack OrdersEc2Stack --force --role-arn arn:aws:iam::646981656470:role/LabRole

# Esperar 30 segundos
sleep 30

# Redeploy
cdk deploy UsersEc2Stack OrdersEc2Stack --require-approval never --role-arn arn:aws:iam::646981656470:role/LabRole
```

### Opción C: Solo Rebuild (Sin destruir infraestructura)

**⚠️ Esto NO funcionará** porque el User Data de EC2 solo se ejecuta una vez. Necesitas destruir y recrear las instancias.

---

## 🧪 Verificación Post-Deploy

### 1. Esperar que servicios se registren (2-3 minutos)

```bash
# SSH a instancia
ssh -i key.pem ec2-user@<ip>

# Ver logs
docker logs users

# Esperado:
# [registerIp] Instance: i-0abc123, IP: 3.239.210.96, Port: 3000
# ✓ Service 'users' (i-0abc123) successfully registered with IP: 3.239.210.96:3000
```

### 2. Verificar DynamoDB

```bash
aws dynamodb scan \
  --table-name ServiceRegistryStack-ServiceRegistryC10B6608-1BW983ICUWLT8 \
  --region us-east-1
```

**Output esperado:**
```json
{
  "Items": [
    {
      "serviceName": {"S": "users"},
      "instanceId": {"S": "i-0abc123def456"},
      "host": {"S": "3.239.210.96"},
      "port": {"N": "3000"},
      "weight": {"N": "1"},
      "timestamp": {"S": "2024-12-09T10:30:00Z"},
      "ttl": {"N": "1733835600"}
    }
  ]
}
```

### 3. Test Lambda Router con SDK v3

```bash
API_URL="https://xxx.execute-api.us-east-1.amazonaws.com/dev"

# Test básico
curl -s "$API_URL/users/health" | jq

# Test Round Robin metadata
curl -s "$API_URL/users/health" | jq '._loadBalancer'
```

**Output esperado:**
```json
{
  "selectedInstance": "i-0abc123def456",
  "algorithm": "round-robin",
  "latency": "45ms",
  "totalInstances": 1,
  "host": "3.239.210.96:3000"
}
```

---

## 📊 Beneficios de SDK v3

### 1. **Tamaño de Bundle Reducido**
```
SDK v2: ~3 MB (todo AWS)
SDK v3: ~200 KB (solo DynamoDB)
```

### 2. **Mejor Performance**
```
Lambda Cold Start v2: ~800ms
Lambda Cold Start v3: ~400ms
```

### 3. **Sintaxis Moderna**
```javascript
// v2 (callback-based)
dynamo.put(params).promise()

// v3 (command-based)
dynamo.send(new PutCommand(params))
```

### 4. **Tree-shaking**
- Solo incluye módulos que usas
- Menor costo de Lambda (menos MB almacenados)

### 5. **Sin Deprecation Warnings**
```
❌ Please migrate your code to use AWS SDK for JavaScript (v3)
✅ (Sin warnings)
```

---

## 🔧 Troubleshooting

### Error: "Missing the key instanceId"
**Solución:** Redeploy EC2 stacks (el contenedor tiene código viejo)

### Error: "Module not found: @aws-sdk/client-dynamodb"
**Solución:** Verificar que `package.json` tiene las dependencias v3

### Lambda funciona pero EC2 no se registra
**Solución:** 
1. SSH a instancia
2. `docker logs users`
3. Verificar que vea: `✓ Service 'users' (i-xxx) successfully registered`

---

## ✅ Checklist

- [x] Migrar `registerIp.js` a SDK v3
- [x] Migrar `handler.js` a SDK v3
- [x] Actualizar `package.json` de servicios
- [x] Actualizar `package.json` de Lambda
- [x] Crear `infra/tsconfig.json`
- [x] Deploy Lambda Router
- [ ] **Redeploy EC2 Services** ← **PENDIENTE**
- [ ] Verificar registro en DynamoDB
- [ ] Test Round Robin

---

## 🎯 Siguiente Paso

```bash
./redeploy-services.sh
```

O manual:
```bash
cd infra
cdk destroy UsersEc2Stack OrdersEc2Stack --force --role-arn arn:aws:iam::646981656470:role/LabRole
sleep 30
cdk deploy UsersEc2Stack OrdersEc2Stack --require-approval never --role-arn arn:aws:iam::646981656470:role/LabRole
```
