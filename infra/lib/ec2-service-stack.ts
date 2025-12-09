import {
  Stack,
  StackProps,
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_dynamodb as dynamodb,
} from "aws-cdk-lib";
import { Construct } from "constructs";

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

    // VPC por defecto
    const vpc = ec2.Vpc.fromLookup(this, `${props.serviceName}Vpc`, {
      isDefault: true,
    });

    const securityGroup = new ec2.SecurityGroup(this, `${props.serviceName}SG`, {
      vpc,
      description: `Security group for ${props.serviceName} service`,
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(props.servicePort),
      `Allow port ${props.servicePort}`
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
    // ================================
    this.instance.addUserData(
      `#!/bin/bash
      set -ex
      LOG=/var/log/user-data.log
      exec > >(tee -a $LOG | logger -t user-data -s 2>/dev/console) 2>&1

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
      git clone ${props.gitRepoUrl} repo
      cd repo/services

      npm install --production

      # Build and run Docker container from services directory
      docker build -t ${props.serviceName} -f ${props.serviceDirectory}/Dockerfile .
      docker run -d --restart unless-stopped --name ${props.serviceName} \
        -p ${props.servicePort}:${props.servicePort} \
        -e DYNAMODB_TABLE=${props.serviceRegistryTable.tableName} \
        -e AWS_DEFAULT_REGION=${this.region} \
        -e PORT=${props.servicePort} \
        ${props.serviceName}

      echo "Service ${props.serviceName} deployed successfully"
`
    );
  }
}
