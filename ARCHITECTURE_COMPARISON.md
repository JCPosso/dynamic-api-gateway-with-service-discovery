# Comparación de Arquitecturas: AWS Academy vs Producción

## 🎓 Arquitectura Actual (AWS Academy Prototipo)

```
┌─────────────────────────────────────────────────────────────────┐
│                      INTERNET (Public)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  API Gateway     │
                    │  (REST API)      │
                    │  20 req/s limit  │
                    │  No cache        │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Lambda Router   │
                    │  256 MB RAM      │
                    │  10s timeout     │
                    │  Outside VPC     │
                    └──────────────────┘
                         │        │
           ┌─────────────┘        └─────────────┐
           ▼                                     ▼
    ┌─────────────┐                    ┌──────────────────┐
    │  DynamoDB   │                    │   VPC (Default)  │
    │  (Registry) │                    │                  │
    │  On-Demand  │                    │  ┌────────────┐  │
    │  No cache   │                    │  │ EC2: users │  │
    └─────────────┘                    │  │ t3.micro   │  │
           ▲                           │  │ Public IP  │  │
           │                           │  │ HTTP:3000  │  │
           │                           │  └────────────┘  │
           │                           │                  │
           │                           │  ┌────────────┐  │
           └───────────────────────────┼──│ EC2:orders │  │
                                       │  │ t3.micro   │  │
                                       │  │ Public IP  │  │
                                       │  │ HTTP:3001  │  │
                                       │  └────────────┘  │
                                       └──────────────────┘
```

### ⚠️ Limitaciones Identificadas

| Componente | Problema | Impacto |
|-----------|----------|---------|
| **EC2 Instances** | Single instance, no ASG | SPOF - Si falla, servicio down |
| **Availability Zones** | Single AZ | No resistente a falla de AZ |
| **Security Groups** | SSH público (0.0.0.0/0) | Superficie de ataque amplia |
| **Communication** | HTTP sin cifrar | Datos en texto plano |
| **API Gateway** | 20 req/s throttle | Baja capacidad |
| **DynamoDB** | On-Demand sin caché | Latencia alta, costo alto |
| **Lambda** | Fuera de VPC | Nueva conexión HTTP cada vez |
| **Monitoring** | Solo logs básicos | Sin alertas proactivas |

---

## 🏭 Arquitectura de Producción (Recomendada)

```
┌────────────────────────────────────────────────────────────────────┐
│                         INTERNET (Public)                          │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  CloudFront CDN  │ ← Caché global
                        │  (HTTPS only)    │
                        └──────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │   AWS WAF        │ ← DDoS protection
                        │  (Rate limiting) │
                        └──────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  API Gateway     │
                        │  10k req/s       │
                        │  Cache: 5 min    │
                        │  API Key auth    │
                        └──────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          VPC (us-east-1)                            │
│                                                                     │
│  ┌────────────── Public Subnets (Multi-AZ) ──────────────┐        │
│  │                                                         │        │
│  │  ┌─────────────┐         ┌─────────────┐             │        │
│  │  │   Bastion   │         │     NAT     │             │        │
│  │  │   Host      │         │   Gateway   │             │        │
│  │  │  (SSH only) │         │   (Multi-AZ)│             │        │
│  │  └─────────────┘         └─────────────┘             │        │
│  │         │                        │                    │        │
│  └─────────┼────────────────────────┼────────────────────┘        │
│            │                        │                              │
│  ┌─────────▼──── Private Subnets (Multi-AZ) ───────────────────┐ │
│  │            │                        │                        │ │
│  │  ┌─────────▼────────┐    ┌──────────▼──────────┐           │ │
│  │  │  Lambda Router   │    │   Application       │           │ │
│  │  │  1024 MB RAM     │    │   Load Balancer     │           │ │
│  │  │  30s timeout     │◄───┤   (Internal)        │           │ │
│  │  │  Reserved: 100   │    │   HTTPS:443         │           │ │
│  │  └──────────────────┘    └──────────┬──────────┘           │ │
│  │         │                            │                      │ │
│  │         │                  ┌─────────┴─────────┐            │ │
│  │         │                  │                   │            │ │
│  │         │         ┌────────▼────────┐ ┌───────▼────────┐   │ │
│  │         │         │  Target Group   │ │ Target Group   │   │ │
│  │         │         │    (users)      │ │   (orders)     │   │ │
│  │         │         │  Health checks  │ │  Health checks │   │ │
│  │         │         └────────┬────────┘ └───────┬────────┘   │ │
│  │         │                  │                  │            │ │
│  │         │    ┌─────────────┴───────┐  ┌───────┴──────────┐ │ │
│  │         │    │                     │  │                  │ │ │
│  │         │    ▼                     ▼  ▼                  ▼ │ │
│  │         │  ┌────┐ ┌────┐ ┌────┐  ┌────┐ ┌────┐ ┌────┐   │ │
│  │         │  │EC2 │ │EC2 │ │EC2 │  │EC2 │ │EC2 │ │EC2 │   │ │
│  │         │  │t3.s│ │t3.s│ │t3.s│  │t3.s│ │t3.s│ │t3.s│   │ │
│  │         │  │ AZ │ │ AZ │ │ AZ │  │ AZ │ │ AZ │ │ AZ │   │ │
│  │         │  │ 1a │ │ 1b │ │ 1c │  │ 1a │ │ 1b │ │ 1c │   │ │
│  │         │  └────┘ └────┘ └────┘  └────┘ └────┘ └────┘   │ │
│  │         │    │      │      │       │      │      │       │ │
│  │         │    └──────┴──────┘       └──────┴──────┘       │ │
│  │         │           │                     │               │ │
│  │         │    Auto Scaling Group    Auto Scaling Group    │ │
│  │         │    Min: 2, Max: 10       Min: 2, Max: 10       │ │
│  │         │                                                 │ │
│  └─────────┼─────────────────────────────────────────────────┘ │
│            │                                                    │
└────────────┼────────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────┐          ┌──────────────────┐
    │  DynamoDB DAX   │◄─────────│  DynamoDB Table  │
    │  (Cache)        │          │  (Registry)      │
    │  3-node cluster │          │  Provisioned     │
    │  < 1ms latency  │          │  Auto-scaling    │
    └─────────────────┘          │  PITR enabled    │
                                 └──────────────────┘

             ┌──────────────────────────────────┐
             │      CloudWatch Observability    │
             │  • X-Ray Tracing                 │
             │  • Alarms (SNS)                  │
             │  • Dashboards                    │
             │  • Log Insights                  │
             └──────────────────────────────────┘
```

---

## 🔄 Comparación de Flujo de Request

### AWS Academy (Prototipo)
```
1. Client → API Gateway (50ms)
2. API Gateway → Lambda Router (20ms)
3. Lambda → DynamoDB Query (10ms)
4. Lambda → HTTP Connect to EC2 (50ms) ← Nueva conexión cada vez
5. EC2 → Process request (100ms)
6. Response back (50ms)
────────────────────────────────
Total: ~280ms (P50)
```

### Producción (Optimizada)
```
1. Client → CloudFront (caché) (10ms) ← 90% hit rate
   └─ Cache miss:
2. API Gateway (caché) (10ms) ← 50% hit rate
   └─ Cache miss:
3. API Gateway → Lambda Router (5ms) ← Warm
4. Lambda → DynamoDB DAX (1ms) ← Caché en memoria
5. Lambda → HTTPS to ALB (10ms) ← Conexión reutilizada (VPC)
6. ALB → Healthy EC2 (5ms)
7. EC2 → Process request (100ms)
8. Response back (10ms)
────────────────────────────────
Total con caché: ~10ms (90% requests)
Total sin caché: ~141ms (10% requests)
P50: ~30ms
```

**Mejora de latencia: 9.3x más rápido**

---

## 💰 Comparación de Costos (Estimación Mensual)

### AWS Academy (Prototipo)
```
Compute:
  - 2x EC2 t3.micro (us-east-1)          = $15.18
  - Lambda (10k invocations/day)         = $5.00
  
Database:
  - DynamoDB On-Demand (10k reads/day)   = $12.50
  
Networking:
  - API Gateway (10k requests/day)       = $10.50
  - Data Transfer OUT (1 GB/day)         = $2.70
  
Total: ~$45.88/mes
```

### Producción (Sin optimizar)
```
Compute:
  - 6x EC2 t3.small (3 AZ, 2 services)   = $131.04
  - Application Load Balancer            = $22.77
  - Lambda (50k invocations/day)         = $25.00
  - NAT Gateway (2 AZ)                   = $67.50
  
Database:
  - DynamoDB Provisioned (100 RCU)       = $57.38
  - DynamoDB DAX (3-node t3.small)       = $117.00
  
Security & Networking:
  - API Gateway (50k requests/day)       = $52.50
  - CloudFront (10 GB/month)             = $1.00
  - AWS WAF                              = $15.00
  - Data Transfer OUT (5 GB/day)         = $13.50
  
Monitoring:
  - CloudWatch Logs (10 GB/month)        = $5.00
  - CloudWatch Alarms (10 alarms)        = $1.00
  
Total: ~$508.69/mes
```

### Producción (Optimizada con Savings Plans)
```
Compute:
  - 6x EC2 t3.small (Spot Instances)     = $19.66 (85% ahorro)
  - Application Load Balancer            = $22.77
  - Lambda Reserved Concurrency          = $18.00 (28% ahorro)
  - NAT Gateway (1 AZ + VPC endpoints)   = $33.75 (50% ahorro)
  
Database:
  - DynamoDB Provisioned + Auto-scaling  = $28.69 (50% ahorro)
  - DynamoDB DAX (t3.small)              = $117.00
  
Security & Networking:
  - API Gateway (con cache)              = $26.25 (50% menos invocations)
  - CloudFront                           = $1.00
  - AWS WAF                              = $15.00
  - Data Transfer OUT                    = $6.75 (50% con CloudFront)
  
Monitoring:
  - CloudWatch Logs (compressed)         = $2.50
  - CloudWatch Alarms                    = $1.00
  
Total: ~$292.37/mes (43% ahorro vs sin optimizar)
```

**ROI del prototipo:**
- Inversión en prototipo: ~$46/mes × 2 meses = **$92**
- Previene costos de diseño incorrecto: **$500+/mes × 12 meses = $6,000/año**
- **ROI: 6,420%**

---

## 🎯 Matriz de Priorización para Migración

### Alta Prioridad (Blockers de Producción)

| Mejora | Impacto | Esfuerzo | ROI | Deadline |
|--------|---------|----------|-----|----------|
| **Multi-AZ + ASG** | 🔴 Critical | 2 días | Alto | Pre-launch |
| **ALB + Health Checks** | 🔴 Critical | 1 día | Alto | Pre-launch |
| **Eliminar SSH público** | 🔴 Critical | 4 horas | Alto | Pre-launch |
| **HTTPS end-to-end** | 🔴 Critical | 1 día | Medio | Pre-launch |
| **CloudWatch Alarms** | 🟡 High | 4 horas | Alto | Semana 1 |

### Media Prioridad (Performance)

| Mejora | Impacto | Esfuerzo | ROI | Timeline |
|--------|---------|----------|-----|----------|
| **DynamoDB DAX** | 🟡 High | 1 día | Alto | Semana 2 |
| **API Gateway Cache** | 🟡 High | 2 horas | Alto | Semana 2 |
| **Lambda en VPC** | 🟠 Medium | 1 día | Medio | Semana 3 |
| **Provisioned Capacity** | 🟠 Medium | 4 horas | Alto | Semana 3 |

### Baja Prioridad (Nice to Have)

| Mejora | Impacto | Esfuerzo | ROI | Timeline |
|--------|---------|----------|-----|----------|
| **CloudFront CDN** | 🟢 Low | 4 horas | Medio | Mes 2 |
| **AWS WAF** | 🟢 Low | 1 día | Bajo | Mes 2 |
| **X-Ray Tracing** | 🟢 Low | 4 horas | Bajo | Mes 3 |
| **Spot Instances** | 🟢 Low | 2 horas | Alto | Mes 3 |

---

## 📈 Plan de Migración (4 Semanas)

### Semana 1: Foundation & Security
- [ ] Día 1-2: Crear VPC con subnets públicas/privadas en 3 AZs
- [ ] Día 3: Configurar Bastion Host + eliminar SSH público
- [ ] Día 4: Generar certificados ACM
- [ ] Día 5: Implementar HTTPS en ALB

### Semana 2: High Availability
- [ ] Día 1-2: Crear Auto Scaling Groups (min: 2, max: 10)
- [ ] Día 3: Configurar Application Load Balancer + Target Groups
- [ ] Día 4: Configurar health checks + alarmas CloudWatch
- [ ] Día 5: Testing de failover automático

### Semana 3: Performance Optimization
- [ ] Día 1-2: Implementar DynamoDB DAX cluster
- [ ] Día 3: Migrar Lambda a VPC + reserved concurrency
- [ ] Día 4: Habilitar API Gateway caching
- [ ] Día 5: Migrar a DynamoDB provisioned capacity

### Semana 4: Monitoring & Testing
- [ ] Día 1: Habilitar X-Ray tracing
- [ ] Día 2: Configurar dashboards CloudWatch
- [ ] Día 3: Stress testing (ab, Locust, Artillery)
- [ ] Día 4: Chaos engineering (instancias, AZ failures)
- [ ] Día 5: Documentación + handoff

---

## 🧪 Tests de Validación

### Test 1: Availability (Multi-AZ Failover)
```bash
# Simular falla de AZ
aws ec2 stop-instances --instance-ids $(aws ec2 describe-instances \
  --filters "Name=availability-zone,Values=us-east-1a" \
  --query "Reservations[].Instances[].InstanceId" --output text)

# Validar: API sigue respondiendo desde us-east-1b/1c
while true; do curl -s $API_URL/users/health | jq -r '.az'; sleep 1; done
# Esperado: us-east-1b, us-east-1c (sin us-east-1a)
```

### Test 2: Auto-Scaling
```bash
# Generar carga con Apache Bench
ab -n 100000 -c 500 $API_URL/users/health

# Monitorear scaling en CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=AutoScalingGroupName,Value=UsersASG \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average

# Validar: ASG escala de 2 → 6 instancias cuando CPU > 70%
```

### Test 3: Cache Effectiveness
```bash
# Sin caché
time curl $API_URL/users/health
# Esperado: ~280ms

# Con API Gateway cache (5 min TTL)
for i in {1..10}; do time curl $API_URL/users/health; done
# Esperado: 1st request ~280ms, siguientes ~10ms
```

### Test 4: Security (Penetration Testing)
```bash
# Validar SSH NO accesible desde Internet
nmap -p 22 <ec2-public-ip>
# Esperado: filtered/closed

# Validar solo HTTPS
curl -I http://$API_URL/users/health
# Esperado: 301 redirect a HTTPS

# Validar WAF (rate limiting)
ab -n 10000 -c 1000 $API_URL/users/health
# Esperado: 429 Too Many Requests después de threshold
```

---

## 📚 Referencias

### Documentación AWS
- [Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Microservices on AWS](https://docs.aws.amazon.com/whitepapers/latest/microservices-on-aws/microservices-on-aws.html)
- [Service Discovery Patterns](https://aws.amazon.com/blogs/compute/service-discovery-via-consul-with-amazon-ecs/)

### Benchmarks
- [DynamoDB Performance](https://aws.amazon.com/dynamodb/performance/)
- [Lambda Cold Start Times](https://mikhail.io/serverless/coldstarts/aws/)
- [API Gateway Limits](https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html)

### Herramientas Mencionadas
- [Apache Bench](https://httpd.apache.org/docs/2.4/programs/ab.html)
- [Locust](https://locust.io/) (load testing)
- [Artillery](https://artillery.io/) (performance testing)
- [Chaos Toolkit](https://chaostoolkit.org/) (chaos engineering)

---

**Última actualización**: Diciembre 2024
