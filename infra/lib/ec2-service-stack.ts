import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface Ec2ServiceStackProps extends StackProps {
  serviceName: string;
  serviceDirectory: string;
  servicePort: number;
  serviceRegistryTable: dynamodb.Table;
  gitRepoUrl: string;
}

export class Ec2ServiceStack extends Stack {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: Ec2ServiceStackProps) {
    super(scope, id, props);

    // Usar la VPC por defecto en lugar de crear una nueva
    const vpc = ec2.Vpc.fromLookup(this, `${props.serviceName}Vpc`, {
      isDefault: true,
    });

    const securityGroup = new ec2.SecurityGroup(this, `${props.serviceName}SG`, {
      vpc,
      description: `Security group for ${props.serviceName} service`,
      allowAllOutbound: true,
    });

    // Permitir tráfico HTTP en el puerto del servicio
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(props.servicePort),
      `Allow HTTP on port ${props.servicePort}`
    );

    const role = iam.Role.fromRoleArn(
      this,
      `${props.serviceName}InstanceRole`,
      "arn:aws:iam::646981656470:role/LabRole"
    );

    const ami = ec2.MachineImage.latestAmazonLinux2023();

    this.instance = new ec2.Instance(this, `${props.serviceName}Instance`, {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ami,
      role,
      securityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      associatePublicIpAddress: true,
    });

    // UserData para instalar Git, Docker, clonar el repo y ejecutar el contenedor
    this.instance.addUserData(
      `#!/bin/bash
      set -e
      
      # Instalar Git y Docker
      yum update -y
      yum install -y git docker
      systemctl start docker
      systemctl enable docker
      usermod -a -G docker ec2-user
      
      # Clonar el repositorio
      cd /home/ec2-user
      git clone ${props.gitRepoUrl} repo
      cd repo/${props.serviceDirectory}
      
      # Instalar dependencias de Node.js
      curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
      yum install -y nodejs
      npm install --production
      
      # Construir y ejecutar el contenedor Docker
      docker build -t ${props.serviceName} .
      docker run -d --name ${props.serviceName} \
        -p ${props.servicePort}:${props.servicePort} \
        -e DYNAMODB_TABLE=${props.serviceRegistryTable.tableName} \
        -e AWS_DEFAULT_REGION=${this.region} \
        -e PORT=${props.servicePort} \
        ${props.serviceName}
      
      echo "Service ${props.serviceName} started successfully"
      `
    );
  }
}
