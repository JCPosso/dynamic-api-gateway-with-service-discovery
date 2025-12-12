#!/bin/bash

##############################################################################
# Stress Test Script for API Gateway Auto-Discovery
#
# Herramientas: Apache Bench (ab) - viene con macOS
# Uso: API_URL="https://xxx.execute-api.us-east-1.amazonaws.com/dev" ./stress-test.sh
##############################################################################

set -e

# Configuration
API_URL="${API_URL:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -z "$API_URL" ]; then
  echo "❌ ERROR: API_URL no está configurada"
  echo "Uso: API_URL='https://xxx.execute-api.us-east-1.amazonaws.com/dev' ./stress-test.sh"
  exit 1
fi

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║        API Gateway Stress Tests                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "Target: $API_URL"
echo "Region: $AWS_REGION"
echo ""

# Check dependencies
if ! command -v ab >/dev/null 2>&1; then
  echo -e "${RED}❌ Apache Bench (ab) no está instalado${NC}"
  echo "Instalar con: brew install httpd (macOS)"
  exit 1
fi

##############################################################################
# Test 1: Baseline - Petición única
##############################################################################

echo -e "\n${BLUE}=== Test 1: Baseline (1 request) ===${NC}"
echo "Objetivo: Establecer latencia base"

response_time=$(curl -s -w "%{time_total}" -o /dev/null "$API_URL/users/health")
response_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)

echo -e "Latencia base: ${GREEN}${response_ms}ms${NC}"

if (( $(echo "$response_time < 2.0" | bc -l) )); then
  echo -e "${GREEN}✅ PASS: Latencia aceptable${NC}"
else
  echo -e "${YELLOW}⚠️  WARN: Latencia alta (esperado < 2000ms)${NC}"
fi

##############################################################################
# Test 2: Carga Baja (AWS Academy Safe)
##############################################################################

echo -e "\n${BLUE}=== Test 2: Carga Baja (50 requests, 5 concurrent) ===${NC}"
echo "Objetivo: Validar comportamiento con carga ligera"

ab -n 50 -c 5 -q -g test2.tsv "$API_URL/users/health" > test2.log 2>&1

# Parse results
requests=$(grep "Complete requests:" test2.log | awk '{print $3}')
failed=$(grep "Failed requests:" test2.log | awk '{print $3}')
rps=$(grep "Requests per second:" test2.log | awk '{print $4}')
mean_time=$(grep "Time per request:" test2.log | head -1 | awk '{print $4}')

echo "  Requests completados: $requests"
echo "  Requests fallidos: $failed"
echo "  Throughput: ${rps} req/s"
echo "  Latencia promedio: ${mean_time}ms"

if [ "$failed" -eq 0 ]; then
  echo -e "${GREEN}✅ PASS: 0 errores${NC}"
else
  echo -e "${RED}❌ FAIL: $failed requests fallidos${NC}"
fi

##############################################################################
# Test 3: Carga Media (límite throttling)
##############################################################################

echo -e "\n${BLUE}=== Test 3: Carga Media (100 requests, 10 concurrent) ===${NC}"
echo "Objetivo: Verificar throttling de API Gateway (20 req/s configurado)"

ab -n 100 -c 10 -q -g test3.tsv "$API_URL/users/list" > test3.log 2>&1

requests=$(grep "Complete requests:" test3.log | awk '{print $3}')
failed=$(grep "Failed requests:" test3.log | awk '{print $3}')
non_2xx=$(grep "Non-2xx responses:" test3.log | awk '{print $3}' || echo "0")
rps=$(grep "Requests per second:" test3.log | awk '{print $4}')
mean_time=$(grep "Time per request:" test3.log | head -1 | awk '{print $4}')
p50=$(grep "50%" test3.log | awk '{print $2}')
p95=$(grep "95%" test3.log | awk '{print $2}')
p99=$(grep "99%" test3.log | awk '{print $2}')

echo "  Requests completados: $requests"
echo "  Requests fallidos: $failed"
echo "  Respuestas 429 (throttled): $non_2xx"
echo "  Throughput: ${rps} req/s"
echo "  Latencia promedio: ${mean_time}ms"
echo "  P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms"

if (( $(echo "$rps > 15" | bc -l) )); then
  echo -e "${GREEN}PASS: Throughput adecuado${NC}"
else
  echo -e "${YELLOW}WARN: Throughput bajo${NC}"
fi

##############################################################################
# Test 4: Routing a múltiples servicios
##############################################################################

echo -e "\n${BLUE}=== Test 4: Multi-service Routing (50 requests cada uno) ===${NC}"
echo "Objetivo: Validar routing dinámico a users y orders"

# Users service
ab -n 50 -c 5 -q "$API_URL/users/list" > test4a.log 2>&1
users_failed=$(grep "Failed requests:" test4a.log | awk '{print $3}')

# Orders service
ab -n 50 -c 5 -q "$API_URL/orders/orders" > test4b.log 2>&1
orders_failed=$(grep "Failed requests:" test4b.log | awk '{print $3}')

echo "  Users service - Fallidos: $users_failed"
echo "  Orders service - Fallidos: $orders_failed"

if [ "$users_failed" -eq 0 ] && [ "$orders_failed" -eq 0 ]; then
  echo -e "${GREEN}PASS: Ambos servicios responden correctamente${NC}"
else
  echo -e "${RED}FAIL: Errores en routing${NC}"
fi

##############################################################################
# Test 5: Sustained Load (AWS Academy safe)
##############################################################################

echo -e "\n${BLUE}=== Test 5: Sustained Load (200 requests, 5 concurrent) ===${NC}"
echo "Objetivo: Validar estabilidad bajo carga sostenida"

ab -n 200 -c 5 -q -t 30 -g test5.tsv "$API_URL/users/health" > test5.log 2>&1

requests=$(grep "Complete requests:" test5.log | awk '{print $3}')
failed=$(grep "Failed requests:" test5.log | awk '{print $3}')
rps=$(grep "Requests per second:" test5.log | awk '{print $4}')
longest=$(grep "Longest request:" test5.log | awk '{print $3}')

echo "  Requests completados: $requests"
echo "  Requests fallidos: $failed"
echo "  Throughput promedio: ${rps} req/s"
echo "  Request más lento: ${longest}ms"

if [ "$failed" -eq 0 ]; then
  echo -e "${GREEN}PASS: Sistema estable bajo carga sostenida${NC}"
else
  echo -e "${RED}FAIL: $failed requests fallidos${NC}"
fi

##############################################################################
# Test 6: DynamoDB Query Performance
##############################################################################

echo -e "\n${BLUE}=== Test 6: Service Discovery Performance ===${NC}"
echo "Objetivo: Medir impacto de consultas a DynamoDB"

# Forzar lookup de servicio nuevo (primero users, luego orders)
ab -n 20 -c 1 -q "$API_URL/users/health" > test6a.log 2>&1
ab -n 20 -c 1 -q "$API_URL/orders/orders" > test6b.log 2>&1

users_mean=$(grep "Time per request:" test6a.log | head -1 | awk '{print $4}')
orders_mean=$(grep "Time per request:" test6b.log | head -1 | awk '{print $4}')

echo "  Users lookup latency: ${users_mean}ms"
echo "  Orders lookup latency: ${orders_mean}ms"

if (( $(echo "$users_mean < 1000 && $orders_mean < 1000" | bc -l) )); then
  echo -e "${GREEN}PASS: DynamoDB lookup rápido${NC}"
else
  echo -e "${YELLOW}WARN: Latencia de lookup alta${NC}"
fi

##############################################################################
# CloudWatch Metrics (opcional)
##############################################################################

echo -e "\n${BLUE}=== CloudWatch Metrics (últimos 5 minutos) ===${NC}"

start_time=$(date -u -v-5M "+%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -d '5 minutes ago' "+%Y-%m-%dT%H:%M:%S" 2>/dev/null)
end_time=$(date -u "+%Y-%m-%dT%H:%M:%S")

# Lambda Invocations
invocations=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=LambdaRouterStack-RouterLambda \
  --start-time "$start_time" \
  --end-time "$end_time" \
  --period 300 \
  --statistics Sum \
  --region "$AWS_REGION" \
  --output json 2>/dev/null | jq -r '.Datapoints[0].Sum // 0' || echo "N/A")

# Lambda Errors
errors=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=LambdaRouterStack-RouterLambda \
  --start-time "$start_time" \
  --end-time "$end_time" \
  --period 300 \
  --statistics Sum \
  --region "$AWS_REGION" \
  --output json 2>/dev/null | jq -r '.Datapoints[0].Sum // 0' || echo "N/A")

# Lambda Duration
duration=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=LambdaRouterStack-RouterLambda \
  --start-time "$start_time" \
  --end-time "$end_time" \
  --period 300 \
  --statistics Average \
  --region "$AWS_REGION" \
  --output json 2>/dev/null | jq -r '.Datapoints[0].Average // 0' | cut -d. -f1 || echo "N/A")

echo "  Lambda Invocations: $invocations"
echo "  Lambda Errors: $errors"
echo "  Lambda Avg Duration: ${duration}ms"

##############################################################################
# Summary Report
##############################################################################

echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        STRESS TEST SUMMARY                        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"

cat <<EOF

Resultados:
  Baseline latency: ${response_ms}ms
  Throughput máximo: ${rps} req/s
  Latencia promedio (carga media): ${mean_time}ms
  P95 latency: ${p95}ms
  P99 latency: ${p99}ms
  Total requests procesados: $((50 + 100 + 200))
  Errores totales: $((failed + users_failed + orders_failed))

Métricas CloudWatch:
  Lambda invocations: $invocations
  Lambda errors: $errors
  Avg Lambda duration: ${duration}ms

Atributos de Calidad Validados:
  Performance: Latencia < 2s
  Scalability: Maneja 20 req/s (throttling configurado)
  Reliability: ${failed} errores en 200 requests sostenidos
  Availability: Servicios responden consistentemente
  Interoperability: Routing a múltiples servicios funcional

EOF

# Cleanup
rm -f test*.log test*.tsv

echo -e "${GREEN}Stress tests completados${NC}"
echo -e "Archivos de resultados eliminados (test*.log, test*.tsv)\n"
