import {
  Stack,
  StackProps,
  aws_ec2 as ec2,
  aws_iam as iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Ec2ServiceStackProps extends StackProps {
  serviceName: string;
  serviceDirectory: string;
  servicePort: number;
  dynamoDbTableName: string;
  gitRepoUrl: string;
}

export class Ec2ServiceStack extends Stack {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: Ec2ServiceStackProps) {
    super(scope, id, props);

    // VPC por defecto
    const vpc = ec2.Vpc.fromLookup(this, `${props.serviceName}Vpc`, {
      isDefault: true,
    });

    const securityGroup = new ec2.SecurityGroup(this, `${props.serviceName}SG`, {
      vpc,
      description: `Security group for ${props.serviceName} service`,
      allowAllOutbound: true,
    });

    // Security: Solo permitir tráfico desde la VPC (Lambda está en la VPC)
    // No exponer directamente a Internet (ANY IPv4)
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),  // Solo desde VPC interna
      ec2.Port.tcp(props.servicePort),
      `Allow port ${props.servicePort} from VPC only`
    );

    // Opcional: Permitir SSH solo para debugging (comentar en producción)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "SSH for debugging (remove in production)"
    );

    // Rol proporcionado por AWS Academy
    const role = iam.Role.fromRoleArn(
      this,
      `${props.serviceName}InstanceRole`,
      "arn:aws:iam::646981656470:role/LabRole"
    );

    // AMAZON LINUX 2023 🚀
    const ami = ec2.MachineImage.latestAmazonLinux2023();

    this.instance = new ec2.Instance(this, `${props.serviceName}Instance`, {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ami,
      role,
      securityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      associatePublicIpAddress: true,
    });

    // ================================
    // USER DATA PARA AL2023 (CORRECTO)
    // Update timestamp to force instance replacement on each deploy
    const deploymentId = Date.now() + Math.random();
    // ================================
    this.instance.addUserData(
      `#!/bin/bash
      set -ex
      LOG=/var/log/user-data.log
      exec > >(tee -a $LOG | logger -t user-data -s 2>/dev/console) 2>&1
      
      # Force update: ${deploymentId}
      echo "Deployment ID: ${deploymentId}"

      # Update base system
      dnf update -y

      # Install git, docker and nodejs (Node 18 by default in AL2023)
      dnf install -y git docker nodejs

      # Enable Docker
      systemctl enable --now docker
      usermod -aG docker ec2-user

      # Prepare workspace
      cd /home/ec2-user
      rm -rf repo
      git clone --depth 1 ${props.gitRepoUrl} repo
      cd repo/services

      npm install --production

      # Clean ALL Docker artifacts to ensure fresh build
      docker stop ${props.serviceName} || true
      docker rm ${props.serviceName} || true
      docker rmi ${props.serviceName}:latest || true
      docker rmi ${props.serviceName} || true
      # Remove dangling images and prune build cache
      docker image prune -af
      docker builder prune -af

      # Build and run Docker container from services directory with --no-cache
      # serviceDirectory is "${props.serviceDirectory}" so we extract just "orders" or "users"
      docker build --no-cache -t ${props.serviceName}:latest -f ${props.serviceName}/Dockerfile .
      docker run -d --restart unless-stopped --name ${props.serviceName} \
        -p ${props.servicePort}:${props.servicePort} \
        -e DYNAMODB_TABLE=${props.dynamoDbTableName} \
        -e AWS_DEFAULT_REGION=${this.region} \
        -e PORT=${props.servicePort} \
        ${props.serviceName}:latest

      sleep 3
      echo "Service ${props.serviceName} deployed successfully"
      docker logs ${props.serviceName} | head -30
`
    );
  }
}
