#!/bin/bash

# Script para forzar rebuild y redeploy de servicios EC2 con SDK v3

echo "🚀 Redeploying services with AWS SDK v3..."

cd infra

# Rebuild CDK
echo "📦 Building CDK..."
npm run build

# Forzar recreación de stacks EC2 (esto triggereará rebuild de Docker images)
echo "🔄 Destroying EC2 stacks..."
npx cdk destroy UsersEc2Stack OrdersEc2Stack --force --role-arn arn:aws:iam::646981656470:role/LabRole

echo "⏳ Waiting 30 seconds for cleanup..."
sleep 30

# Redeploy everything
echo "🚢 Deploying all stacks..."
npx cdk deploy --all --require-approval never --role-arn arn:aws:iam::646981656470:role/LabRole

echo "✅ Deployment complete!"
echo ""
echo "📊 Next steps:"
echo "1. Wait 2-3 minutes for services to register"
echo "2. Check DynamoDB for service registration:"
echo "   aws dynamodb scan --table-name <TABLE_NAME> --region us-east-1"
echo "3. Test Round Robin:"
echo "   for i in {1..10}; do curl -s \"\$API_URL/users/health\" | jq '._loadBalancer.selectedInstance'; done"
