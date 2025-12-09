# Guía Rápida: Uso del Proyecto

## 🚀 Inicio Rápido

### 1. Setup Inicial (una sola vez)
```bash
# Clonar repositorio
git clone <repo-url>
cd dynamic-api-gateway-with-service-discovery

# Instalar dependencias
npm install

# Configurar AWS CLI
aws configure

# Bootstrap CDK (una sola vez)
cd infra
npx cdk bootstrap
```

### 2. Desplegar Infraestructura
```bash
cd infra
npx cdk deploy --all
```

### 3. Verificar Deployment
```bash
# Revisar servicios registrados
aws dynamodb scan --table-name ServiceRegistry --region us-east-1

# Obtener API Gateway URL (outputs del deploy)
# Típicamente: https://<api-id>.execute-api.us-east-1.amazonaws.com/dev
```

### 4. Ejecutar Pruebas
```bash
# Desde raíz del repositorio
./test.sh
```

## 📚 Documentación Completa

Ver `README.md` para:
- ✅ Desafío técnico
- ✅ Arquitectura detallada
- ✅ Setup paso a paso
- ✅ Pruebas funcionales
- ✅ Monitoreo en CloudWatch
- ✅ Troubleshooting

## 🔧 Comandos Útiles

### Ver Logs
```bash
# Lambda Router
aws logs tail /aws/lambda/lambda-router --follow

# Services
aws logs tail /ecs/users-service --follow
aws logs tail /ecs/orders-service --follow
```

### Testear Endpoints
```bash
API_URL="https://ect71idvv2.execute-api.us-east-1.amazonaws.com/dev"

curl "$API_URL/users/health"
curl "$API_URL/users/list"
curl "$API_URL/orders/orders"
```

### Listar Recursos Desplegados
```bash
# ECS Tasks
aws ecs list-tasks --cluster ApiGatewayCluster

# Lambdas
aws lambda list-functions --region us-east-1 | grep -i router

# DynamoDB Items
aws dynamodb scan --table-name ServiceRegistry
```

## 📝 Referencias Rápidas

- **README.md** (701 líneas): Documentación completa
- **CLEANUP.md**: Qué se limpió y por qué
- **PROJECT_STRUCTURE.md**: Árbol del proyecto
- **test.sh**: Suite de pruebas automatizadas

## ⚠️ Limitaciones AWS Academy

El proyecto respeta las limitaciones de AWS Academy:
- ✅ Pruebas funcionales (sin load testing)
- ✅ Bajo consumo de RCU/WCU en DynamoDB
- ✅ Compatible con cuotas de recursos limitados
- ✅ Usa roles IAM existentes (LabRole)

## ✅ Checklist Pre-Entrega

- [ ] README.md revisado
- [ ] `./test.sh` ejecutado exitosamente
- [ ] Servicios registrados en DynamoDB
- [ ] API Gateway respondiendo (curl test)
- [ ] Logs visibles en CloudWatch
- [ ] CLEANUP.md y PROJECT_STRUCTURE.md para referencia

---

**Nota**: Para más detalles, ver README.md
