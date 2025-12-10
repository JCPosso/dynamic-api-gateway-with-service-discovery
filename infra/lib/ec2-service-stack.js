"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ec2ServiceStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
class Ec2ServiceStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // VPC por defecto
        const vpc = aws_cdk_lib_1.aws_ec2.Vpc.fromLookup(this, `${props.serviceName}Vpc`, {
            isDefault: true,
        });
        const securityGroup = new aws_cdk_lib_1.aws_ec2.SecurityGroup(this, `${props.serviceName}SG`, {
            vpc,
            description: `Security group for ${props.serviceName} service`,
            allowAllOutbound: true,
        });
        // Security: Solo permitir tráfico desde la VPC (Lambda está en la VPC)
        // No exponer directamente a Internet (ANY IPv4)
        securityGroup.addIngressRule(aws_cdk_lib_1.aws_ec2.Peer.ipv4(vpc.vpcCidrBlock), // Solo desde VPC interna
        aws_cdk_lib_1.aws_ec2.Port.tcp(props.servicePort), `Allow port ${props.servicePort} from VPC only`);
        // Opcional: Permitir SSH solo para debugging (comentar en producción)
        securityGroup.addIngressRule(aws_cdk_lib_1.aws_ec2.Peer.anyIpv4(), aws_cdk_lib_1.aws_ec2.Port.tcp(22), "SSH for debugging (remove in production)");
        // Rol proporcionado por AWS Academy
        const role = aws_cdk_lib_1.aws_iam.Role.fromRoleArn(this, `${props.serviceName}InstanceRole`, "arn:aws:iam::646981656470:role/LabRole");
        // AMAZON LINUX 2023 🚀
        const ami = aws_cdk_lib_1.aws_ec2.MachineImage.latestAmazonLinux2023();
        this.instance = new aws_cdk_lib_1.aws_ec2.Instance(this, `${props.serviceName}Instance`, {
            vpc,
            instanceType: aws_cdk_lib_1.aws_ec2.InstanceType.of(aws_cdk_lib_1.aws_ec2.InstanceClass.T3, aws_cdk_lib_1.aws_ec2.InstanceSize.MICRO),
            machineImage: ami,
            role,
            securityGroup,
            vpcSubnets: { subnetType: aws_cdk_lib_1.aws_ec2.SubnetType.PUBLIC },
            associatePublicIpAddress: true,
        });
        // ================================
        // USER DATA PARA AL2023 (CORRECTO)
        // Update timestamp to force instance replacement on each deploy
        const deploymentId = Date.now() + Math.random();
        // ================================
        this.instance.addUserData(`#!/bin/bash
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
`);
    }
}
exports.Ec2ServiceStack = Ec2ServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLXNlcnZpY2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlYzItc2VydmljZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FLcUI7QUFXckIsTUFBYSxlQUFnQixTQUFRLG1CQUFLO0lBR3hDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsa0JBQWtCO1FBQ2xCLE1BQU0sR0FBRyxHQUFHLHFCQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxLQUFLLEVBQUU7WUFDOUQsU0FBUyxFQUFFLElBQUk7U0FDaEIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxhQUFhLEdBQUcsSUFBSSxxQkFBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEVBQUU7WUFDMUUsR0FBRztZQUNILFdBQVcsRUFBRSxzQkFBc0IsS0FBSyxDQUFDLFdBQVcsVUFBVTtZQUM5RCxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILHVFQUF1RTtRQUN2RSxnREFBZ0Q7UUFDaEQsYUFBYSxDQUFDLGNBQWMsQ0FDMUIscUJBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRyx5QkFBeUI7UUFDM0QscUJBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsRUFDL0IsY0FBYyxLQUFLLENBQUMsV0FBVyxnQkFBZ0IsQ0FDaEQsQ0FBQztRQUVGLHNFQUFzRTtRQUN0RSxhQUFhLENBQUMsY0FBYyxDQUMxQixxQkFBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFDbEIscUJBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUNoQiwwQ0FBMEMsQ0FDM0MsQ0FBQztRQUVGLG9DQUFvQztRQUNwQyxNQUFNLElBQUksR0FBRyxxQkFBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQy9CLElBQUksRUFDSixHQUFHLEtBQUssQ0FBQyxXQUFXLGNBQWMsRUFDbEMsd0NBQXdDLENBQ3pDLENBQUM7UUFFRix1QkFBdUI7UUFDdkIsTUFBTSxHQUFHLEdBQUcscUJBQUcsQ0FBQyxZQUFZLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUVyRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUkscUJBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsVUFBVSxFQUFFO1lBQ3JFLEdBQUc7WUFDSCxZQUFZLEVBQUUscUJBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUMvQixxQkFBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEVBQ3BCLHFCQUFHLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FDdkI7WUFDRCxZQUFZLEVBQUUsR0FBRztZQUNqQixJQUFJO1lBQ0osYUFBYTtZQUNiLFVBQVUsRUFBRSxFQUFFLFVBQVUsRUFBRSxxQkFBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUU7WUFDakQsd0JBQXdCLEVBQUUsSUFBSTtTQUMvQixDQUFDLENBQUM7UUFFSCxtQ0FBbUM7UUFDbkMsbUNBQW1DO1FBQ25DLGdFQUFnRTtRQUNoRSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2hELG1DQUFtQztRQUNuQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FDdkI7Ozs7O3dCQUtrQixZQUFZOzZCQUNQLFlBQVk7Ozs7Ozs7Ozs7Ozs7Ozs0QkFlYixLQUFLLENBQUMsVUFBVTs7Ozs7O29CQU14QixLQUFLLENBQUMsV0FBVztrQkFDbkIsS0FBSyxDQUFDLFdBQVc7bUJBQ2hCLEtBQUssQ0FBQyxXQUFXO21CQUNqQixLQUFLLENBQUMsV0FBVzs7Ozs7OytCQU1MLEtBQUssQ0FBQyxnQkFBZ0I7bUNBQ2xCLEtBQUssQ0FBQyxXQUFXLGNBQWMsS0FBSyxDQUFDLFdBQVc7c0RBQzdCLEtBQUssQ0FBQyxXQUFXO2FBQzFELEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVc7NEJBQ3ZCLEtBQUssQ0FBQyxpQkFBaUI7Z0NBQ25CLElBQUksQ0FBQyxNQUFNO2tCQUN6QixLQUFLLENBQUMsV0FBVztVQUN6QixLQUFLLENBQUMsV0FBVzs7O3NCQUdMLEtBQUssQ0FBQyxXQUFXO29CQUNuQixLQUFLLENBQUMsV0FBVztDQUNwQyxDQUNJLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFoSEQsMENBZ0hDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgU3RhY2ssXG4gIFN0YWNrUHJvcHMsXG4gIGF3c19lYzIgYXMgZWMyLFxuICBhd3NfaWFtIGFzIGlhbSxcbn0gZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuXG5pbnRlcmZhY2UgRWMyU2VydmljZVN0YWNrUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAgc2VydmljZU5hbWU6IHN0cmluZztcbiAgc2VydmljZURpcmVjdG9yeTogc3RyaW5nO1xuICBzZXJ2aWNlUG9ydDogbnVtYmVyO1xuICBkeW5hbW9EYlRhYmxlTmFtZTogc3RyaW5nO1xuICBnaXRSZXBvVXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBFYzJTZXJ2aWNlU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBpbnN0YW5jZTogZWMyLkluc3RhbmNlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBFYzJTZXJ2aWNlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gVlBDIHBvciBkZWZlY3RvXG4gICAgY29uc3QgdnBjID0gZWMyLlZwYy5mcm9tTG9va3VwKHRoaXMsIGAke3Byb3BzLnNlcnZpY2VOYW1lfVZwY2AsIHtcbiAgICAgIGlzRGVmYXVsdDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgYCR7cHJvcHMuc2VydmljZU5hbWV9U0dgLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogYFNlY3VyaXR5IGdyb3VwIGZvciAke3Byb3BzLnNlcnZpY2VOYW1lfSBzZXJ2aWNlYCxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBTZWN1cml0eTogU29sbyBwZXJtaXRpciB0csOhZmljbyBkZXNkZSBsYSBWUEMgKExhbWJkYSBlc3TDoSBlbiBsYSBWUEMpXG4gICAgLy8gTm8gZXhwb25lciBkaXJlY3RhbWVudGUgYSBJbnRlcm5ldCAoQU5ZIElQdjQpXG4gICAgc2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmlwdjQodnBjLnZwY0NpZHJCbG9jayksICAvLyBTb2xvIGRlc2RlIFZQQyBpbnRlcm5hXG4gICAgICBlYzIuUG9ydC50Y3AocHJvcHMuc2VydmljZVBvcnQpLFxuICAgICAgYEFsbG93IHBvcnQgJHtwcm9wcy5zZXJ2aWNlUG9ydH0gZnJvbSBWUEMgb25seWBcbiAgICApO1xuXG4gICAgLy8gT3BjaW9uYWw6IFBlcm1pdGlyIFNTSCBzb2xvIHBhcmEgZGVidWdnaW5nIChjb21lbnRhciBlbiBwcm9kdWNjacOzbilcbiAgICBzZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDIyKSxcbiAgICAgIFwiU1NIIGZvciBkZWJ1Z2dpbmcgKHJlbW92ZSBpbiBwcm9kdWN0aW9uKVwiXG4gICAgKTtcblxuICAgIC8vIFJvbCBwcm9wb3JjaW9uYWRvIHBvciBBV1MgQWNhZGVteVxuICAgIGNvbnN0IHJvbGUgPSBpYW0uUm9sZS5mcm9tUm9sZUFybihcbiAgICAgIHRoaXMsXG4gICAgICBgJHtwcm9wcy5zZXJ2aWNlTmFtZX1JbnN0YW5jZVJvbGVgLFxuICAgICAgXCJhcm46YXdzOmlhbTo6NjQ2OTgxNjU2NDcwOnJvbGUvTGFiUm9sZVwiXG4gICAgKTtcblxuICAgIC8vIEFNQVpPTiBMSU5VWCAyMDIzIPCfmoBcbiAgICBjb25zdCBhbWkgPSBlYzIuTWFjaGluZUltYWdlLmxhdGVzdEFtYXpvbkxpbnV4MjAyMygpO1xuXG4gICAgdGhpcy5pbnN0YW5jZSA9IG5ldyBlYzIuSW5zdGFuY2UodGhpcywgYCR7cHJvcHMuc2VydmljZU5hbWV9SW5zdGFuY2VgLCB7XG4gICAgICB2cGMsXG4gICAgICBpbnN0YW5jZVR5cGU6IGVjMi5JbnN0YW5jZVR5cGUub2YoXG4gICAgICAgIGVjMi5JbnN0YW5jZUNsYXNzLlQzLFxuICAgICAgICBlYzIuSW5zdGFuY2VTaXplLk1JQ1JPXG4gICAgICApLFxuICAgICAgbWFjaGluZUltYWdlOiBhbWksXG4gICAgICByb2xlLFxuICAgICAgc2VjdXJpdHlHcm91cCxcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDIH0sXG4gICAgICBhc3NvY2lhdGVQdWJsaWNJcEFkZHJlc3M6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFVTRVIgREFUQSBQQVJBIEFMMjAyMyAoQ09SUkVDVE8pXG4gICAgLy8gVXBkYXRlIHRpbWVzdGFtcCB0byBmb3JjZSBpbnN0YW5jZSByZXBsYWNlbWVudCBvbiBlYWNoIGRlcGxveVxuICAgIGNvbnN0IGRlcGxveW1lbnRJZCA9IERhdGUubm93KCkgKyBNYXRoLnJhbmRvbSgpO1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5pbnN0YW5jZS5hZGRVc2VyRGF0YShcbiAgICAgIGAjIS9iaW4vYmFzaFxuICAgICAgc2V0IC1leFxuICAgICAgTE9HPS92YXIvbG9nL3VzZXItZGF0YS5sb2dcbiAgICAgIGV4ZWMgPiA+KHRlZSAtYSAkTE9HIHwgbG9nZ2VyIC10IHVzZXItZGF0YSAtcyAyPi9kZXYvY29uc29sZSkgMj4mMVxuICAgICAgXG4gICAgICAjIEZvcmNlIHVwZGF0ZTogJHtkZXBsb3ltZW50SWR9XG4gICAgICBlY2hvIFwiRGVwbG95bWVudCBJRDogJHtkZXBsb3ltZW50SWR9XCJcblxuICAgICAgIyBVcGRhdGUgYmFzZSBzeXN0ZW1cbiAgICAgIGRuZiB1cGRhdGUgLXlcblxuICAgICAgIyBJbnN0YWxsIGdpdCwgZG9ja2VyIGFuZCBub2RlanMgKE5vZGUgMTggYnkgZGVmYXVsdCBpbiBBTDIwMjMpXG4gICAgICBkbmYgaW5zdGFsbCAteSBnaXQgZG9ja2VyIG5vZGVqc1xuXG4gICAgICAjIEVuYWJsZSBEb2NrZXJcbiAgICAgIHN5c3RlbWN0bCBlbmFibGUgLS1ub3cgZG9ja2VyXG4gICAgICB1c2VybW9kIC1hRyBkb2NrZXIgZWMyLXVzZXJcblxuICAgICAgIyBQcmVwYXJlIHdvcmtzcGFjZVxuICAgICAgY2QgL2hvbWUvZWMyLXVzZXJcbiAgICAgIHJtIC1yZiByZXBvXG4gICAgICBnaXQgY2xvbmUgLS1kZXB0aCAxICR7cHJvcHMuZ2l0UmVwb1VybH0gcmVwb1xuICAgICAgY2QgcmVwby9zZXJ2aWNlc1xuXG4gICAgICBucG0gaW5zdGFsbCAtLXByb2R1Y3Rpb25cblxuICAgICAgIyBDbGVhbiBBTEwgRG9ja2VyIGFydGlmYWN0cyB0byBlbnN1cmUgZnJlc2ggYnVpbGRcbiAgICAgIGRvY2tlciBzdG9wICR7cHJvcHMuc2VydmljZU5hbWV9IHx8IHRydWVcbiAgICAgIGRvY2tlciBybSAke3Byb3BzLnNlcnZpY2VOYW1lfSB8fCB0cnVlXG4gICAgICBkb2NrZXIgcm1pICR7cHJvcHMuc2VydmljZU5hbWV9OmxhdGVzdCB8fCB0cnVlXG4gICAgICBkb2NrZXIgcm1pICR7cHJvcHMuc2VydmljZU5hbWV9IHx8IHRydWVcbiAgICAgICMgUmVtb3ZlIGRhbmdsaW5nIGltYWdlcyBhbmQgcHJ1bmUgYnVpbGQgY2FjaGVcbiAgICAgIGRvY2tlciBpbWFnZSBwcnVuZSAtYWZcbiAgICAgIGRvY2tlciBidWlsZGVyIHBydW5lIC1hZlxuXG4gICAgICAjIEJ1aWxkIGFuZCBydW4gRG9ja2VyIGNvbnRhaW5lciBmcm9tIHNlcnZpY2VzIGRpcmVjdG9yeSB3aXRoIC0tbm8tY2FjaGVcbiAgICAgICMgc2VydmljZURpcmVjdG9yeSBpcyBcIiR7cHJvcHMuc2VydmljZURpcmVjdG9yeX1cIiBzbyB3ZSBleHRyYWN0IGp1c3QgXCJvcmRlcnNcIiBvciBcInVzZXJzXCJcbiAgICAgIGRvY2tlciBidWlsZCAtLW5vLWNhY2hlIC10ICR7cHJvcHMuc2VydmljZU5hbWV9OmxhdGVzdCAtZiAke3Byb3BzLnNlcnZpY2VOYW1lfS9Eb2NrZXJmaWxlIC5cbiAgICAgIGRvY2tlciBydW4gLWQgLS1yZXN0YXJ0IHVubGVzcy1zdG9wcGVkIC0tbmFtZSAke3Byb3BzLnNlcnZpY2VOYW1lfSBcXFxuICAgICAgICAtcCAke3Byb3BzLnNlcnZpY2VQb3J0fToke3Byb3BzLnNlcnZpY2VQb3J0fSBcXFxuICAgICAgICAtZSBEWU5BTU9EQl9UQUJMRT0ke3Byb3BzLmR5bmFtb0RiVGFibGVOYW1lfSBcXFxuICAgICAgICAtZSBBV1NfREVGQVVMVF9SRUdJT049JHt0aGlzLnJlZ2lvbn0gXFxcbiAgICAgICAgLWUgUE9SVD0ke3Byb3BzLnNlcnZpY2VQb3J0fSBcXFxuICAgICAgICAke3Byb3BzLnNlcnZpY2VOYW1lfTpsYXRlc3RcblxuICAgICAgc2xlZXAgM1xuICAgICAgZWNobyBcIlNlcnZpY2UgJHtwcm9wcy5zZXJ2aWNlTmFtZX0gZGVwbG95ZWQgc3VjY2Vzc2Z1bGx5XCJcbiAgICAgIGRvY2tlciBsb2dzICR7cHJvcHMuc2VydmljZU5hbWV9IHwgaGVhZCAtMzBcbmBcbiAgICApO1xuICB9XG59XG4iXX0=