import * as cdk from 'aws-cdk-lib/core'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import {Construct} from 'constructs';
import {StackProps} from "aws-cdk-lib";
import {ContainerImage} from "aws-cdk-lib/aws-ecs";
import {ApplicationLoadBalancer} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as Certificate from 'aws-cdk-lib/aws-certificatemanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class EcsFargateOnlineStack extends cdk.Stack {
  public readonly loadBalancer: ApplicationLoadBalancer;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const argContext = 'environment';
    const envKey = this.node.tryGetContext(argContext);
      if (envKey == undefined)
        throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=stg`);
    const context = this.node.tryGetContext(envKey);
      if (context == undefined) throw new Error('Invalid environment.');

      const vpc = ec2.Vpc.fromLookup(this, 'VPCapp', {
        vpcName: `${context.AWSENV}-to2go-app-vpc`,
      });

    // IAM Role
    const executionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      roleName: `${context.AWSENV}-to2go-online-EcsTaskExecutionRole`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    })

    const ssmPolicy = new iam.Policy(this, 'ssm-policy', {
        statements:[ new iam.PolicyStatement( {
          effect: iam.Effect.ALLOW,
          actions: ['ssm:GetParameters'],
          resources : ["*"],
        })],
    })

    executionRole.attachInlinePolicy(ssmPolicy)

    const serviceTaskRole = new iam.Role(this, 'EcsServiceTaskRole', {
      roleName: `${context.AWSENV}-to2go-online-ecs-service-task-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })

    // const staticbucket = s3.Bucket.fromBucketName(this, "Bucket", `${context.AWSENV}-to2go-app-s3`);

    // const s3Policy = new iam.Policy(this, 's3-policy', {
    //       statements:[ new iam.PolicyStatement( {
    //       effect: iam.Effect.ALLOW,
    //       actions: ['s3:ListBucket', 's3:PutObject', 's3:GetObject', 's3:DeleteObject'],
    //       resources : [`${staticbucket.bucketArn}/*`]},
    //       )],
    // })

    // const ecsexecPolicy = new iam.Policy(this, 'ecsexec-policy', {
    //   statements:[ new iam.PolicyStatement( {
    //   effect: iam.Effect.ALLOW,
    //   actions: ['ssmmessages:CreateControlChannel','ssmmessages:CreateDataChannel','ssmmessages:OpenControlChannel','ssmmessages:OpenDataChannel'],
    //   resources : ["*"]},
    //   )],
    // })

    // serviceTaskRole.attachInlinePolicy(s3Policy)
    // serviceTaskRole.attachInlinePolicy(ecsexecPolicy)

  // ECS TaskDefinition

    const logGroup = new logs.LogGroup(this, 'ServiceLogGroup', {
      logGroupName: `${context.AWSENV}-to2go-app-online-fargate-log`
    })

    const ecrname = ecr.Repository.fromRepositoryName(this ,'ecrname', `${context.AWSENV}-to2go-app-ecr-repository`)
    const image = ContainerImage.fromEcrRepository(ecrname, 'latest')

    const serviceTaskDefinition = new ecs.FargateTaskDefinition(this, 'ServiceTaskDefinition', {
      executionRole: executionRole,
      taskRole: serviceTaskRole,
      cpu: context.ONLINECPU,
      memoryLimitMiB: context.ONLINEMEMORY,
      // runtimePlatform: {
      //   cpuArchitecture: ecs.CpuArchitecture.of('ARM64')
      // }
    })

    serviceTaskDefinition.addContainer(`${context.AWSENV}-to2go-app-online`, {
      image:image,
      cpu: context.ONLINECPU,
      memoryLimitMiB: context.ONLINEMEMORY,
      memoryReservationMiB: context.ONLINEMEMORY,
      command: [
        "bundle",
        "exec",
        "rails",
        "s",
        "-e",
        "production",
        "-p",
        "8000",
        "-b",
        "0.0.0.0"
      ],
      secrets: {
        // 'CLIENT_ORIGIN': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'CLIENT_ORIGIN', 'CLIENT_ORIGIN')),
        // 'CORS_ALLOWED_ORIGINS': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'CORS_ALLOWED_ORIGINS', 'CORS_ALLOWED_ORIGINS')),
        'DB_DATABASE': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'DB_DATABASE', '/to2go/DB_DATABASE')),
        'DB_HOST': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'DB_HOST', '/to2go/DB_HOST')),
        'DB_PASSWORD': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'DB_PASSWORD', '/to2go/DB_PASSWORD')),
        'DB_PORT': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'DB_PORT', '/to2go/DB_PORT')),
        'DB_USERNAME': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'DB_USERNAME', '/to2go/DB_USERNAME')),
        'SECRET_KEY_BASE': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'SECRET_KEY_BASE', '/to2go/SECRET_KEY_BASE')),
        'RAILS_ENV': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'RAILS_ENV', '/to2go/RAILS_ENV')),
        // 'INTEC_ENDPOINT': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'INTEC_ENDPOINT', 'INTEC_ENDPOINT')),
        // 'JWT_PRIVATE_KEY': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY')),
        // 'RAILS_ENV': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'RAILS_ENV', 'RAILS_ENV')),
        // 'RAILS_HOST': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'RAILS_HOST', 'RAILS_HOST')),
        // 'RAILS_LOG_TO_STDOUT': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'RAILS_LOG_TO_STDOUT', 'RAILS_LOG_TO_STDOUT')),
        // 'REDIS_DB': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'REDIS_DB', 'REDIS_DB')),
        // 'REDIS_HOST': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'REDIS_HOST', 'REDIS_HOST')),
        // 'REDIS_PORT': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'REDIS_PORT', 'REDIS_PORT')),
        // 'SECRET_KEY_BASE': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'SECRET_KEY_BASE', 'SECRET_KEY_BASE')),
        // 'SIMOUNT_ENDPOINT': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'SIMOUNT_ENDPOINT', 'SIMOUNT_ENDPOINT')),
        // 'SIDEKIQ_LOGIN_ID': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'SIDEKIQ_LOGIN_ID', 'SIDEKIQ_LOGIN_ID')),
        // 'SIDEKIQ_LOGIN_PASS': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'SIDEKIQ_LOGIN_PASS', 'SIDEKIQ_LOGIN_PASS')),
        // 'S3_BUCKET_NAME': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'S3_BUCKET_NAME', 'S3_BUCKET_NAME')),
        // 'SERVER_HOST': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'SERVER_HOST', 'SERVER_HOST')),
        // 'ACTIVE_STORAGE_S3_BUCKET': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'ACTIVE_STORAGE_S3_BUCKET', 'ACTIVE_STORAGE_S3_BUCKET')),
        // 'DB_TEST_DATABASE': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'DB_TEST_DATABASE', 'DB_TEST_DATABASE')),
        // 'INTEC_AWS_ACCESS_KEY': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'INTEC_AWS_ACCESS_KEY', 'INTEC_AWS_ACCESS_KEY')),
        // 'INTEC_AWS_SECRET_KEY': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'INTEC_AWS_SECRET_KEY', 'INTEC_AWS_SECRET_KEY')),
        // 'INTEC_AWS_REGION': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'INTEC_AWS_REGION', 'INTEC_AWS_REGION')),
        // 'LOGS_S3_BUCKET_NAME': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'ILOGS_S3_BUCKET_NAME', 'LOGS_S3_BUCKET_NAME')),
        // 'OPENAI_ACCESS_TOKEN': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'OPENAI_ACCESS_TOKEN', 'OPENAI_ACCESS_TOKEN')),
        // 'OPENAI_SHOW_LOG_ERRORS': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'OPENAI_SHOW_LOG_ERRORS', 'OPENAI_SHOW_LOG_ERRORS')),
        // 'CPASS_TOKEN': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'CPASS_TOKEN', 'CPASS_TOKEN')),
        // 'CPASS_URI': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'CPASS_URI', 'CPASS_URI')),
        // 'FROM_ADDRESS': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'FROM_ADDRESS', 'FROM_ADDRESS')),
        // 'CPAAS_TOKEN': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'CPAAS_TOKEN', 'CPAAS_TOKEN')),
        // 'CPAAS_URI': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'CPAAS_URI', 'CPAAS_URI')),
        // 'CPAAS_FROM_ADDRESS': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'CPAAS_FROM_ADDRESS', 'CPAAS_FROM_ADDRESS')),
        // 'DOCUMENT_INTELLIGENCE_API_KEY': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'DOCUMENT_INTELLIGENCE_API_KEY', 'DOCUMENT_INTELLIGENCE_API_KEY')),
        // 'DOCUMENT_INTELLIGENCE_ENDPOINT': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'DOCUMENT_INTELLIGENCE_ENDPOINT', 'DOCUMENT_INTELLIGENCE_ENDPOINT')),
        // 'LD_PRELOAD': ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'LD_PRELOAD', 'LD_PRELOAD')),
      },
      logging: ecs.LogDriver.awsLogs({
      streamPrefix: `${context.AWSENV}-to2go-app-online-fargate-log`,
      logGroup,
      }),
    }).addPortMappings({
      containerPort: 8000,
      hostPort: 8000,
      protocol: ecs.Protocol.TCP,
    })

    // ECS Service
    const cluster = new ecs.Cluster(this, `${context.AWSENV}-to2go-app-online-ecs-cluster`, {
      vpc,
      clusterName: `${context.AWSENV}-to2go-app-online-ecs-cluster`,
      containerInsights: true
    })

    const securityGroup = new ec2.SecurityGroup(this, `${context.AWSENV}-to2go-app-online-securitygroup`, {
      vpc,
      securityGroupName: `${context.AWSENV}-to2go-app-online-securitygroup`,
      allowAllOutbound: true
    });

    new cdk.CfnOutput(this, 'SecurityGroupOutPut', {
      value: securityGroup.securityGroupId,
      exportName: 'online-sg-Id',
    });

    const serviceFargateService = new ecs.FargateService(this, 'ServiceServiceDefinition', {
      serviceName: `${context.AWSENV}-to2go-app-online-fargate-service`,
      cluster,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }), // プライベートサブネットを選択
      securityGroups: [securityGroup],
      taskDefinition: serviceTaskDefinition,
      assignPublicIp: true,
      enableExecuteCommand : true,
      desiredCount:context.ONLINETASK
    })

    const albsecurityGroup = new ec2.SecurityGroup(this, `${context.AWSENV}-to2go-app-online-alb-securitygroup`, {
      vpc,
      securityGroupName: `${context.AWSENV}-to2go-app-online-alb-securitygroup`,
      allowAllOutbound: true
    });

    securityGroup.addIngressRule(ec2.Peer.securityGroupId(albsecurityGroup.securityGroupId),ec2.Port.tcp(8000));
    albsecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

    //Log用S3取得
    const accessLogsBucket = s3.Bucket.fromBucketName(this, "MyBucket", `${context.AWSENV}-to2go-app-s3-access-logs-bucket`);

    // ALB
    const alb = new albv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      securityGroup: albsecurityGroup,
      internetFacing: true,
      loadBalancerName: `${context.AWSENV}-to2go-app-online-elb`
    });
    this.loadBalancer = alb
    alb.logAccessLogs(accessLogsBucket,`alb-access-log/${context.AWSENV}-to2go-app-online-elb`)

    const elbcertificate = Certificate.Certificate.fromCertificateArn(this, "Certificate",
      context.ELBCERT
    );

    const listenerHTTP = alb.addListener('ListenerHTTP', {
      port: 443,
      certificates: [elbcertificate],
      sslPolicy: albv2.SslPolicy.RECOMMENDED_TLS,
      open:false
    });

    // TargetGroup
    const targetGroup = new albv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: 8000,
      protocol: albv2.ApplicationProtocol.HTTP,
      targetType: albv2.TargetType.IP,
      healthCheck: {
        path: '/',
        healthyHttpCodes: '200',
      },
    });

    listenerHTTP.addTargetGroups('DefaultHTTPSResponse', {
      targetGroups: [targetGroup]
    });
    serviceFargateService.attachToApplicationTargetGroup(targetGroup);
  }
}
