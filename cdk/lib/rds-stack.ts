import {Duration, RemovalPolicy, SecretValue, Stack, StackProps} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {SecurityGroup} from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib/core';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class RdsStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

const argContext = 'environment';
const envKey = this.node.tryGetContext(argContext);
    if (envKey == undefined)
      throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=stg`);
const context = this.node.tryGetContext(envKey);
    if (context == undefined) throw new Error('Invalid environment.');

    //VPC取得　
    const vpc = ec2.Vpc.fromLookup(this, 'VPCapp', {
      vpcName: `${context.AWSENV}-to2go-app-vpc`,
    });

    //Subnet取得
    const private_subnet = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    }).subnets

    //SubnetGroup作成
    const subnetGroup = new rds.SubnetGroup(this, `${context.AWSENV}-to2go-app-rds-subnetgroup`, {
      description: 'aurora subnet group',
      vpc: vpc,
      vpcSubnets: {
        subnets: private_subnet,
      }
    });

    //RDS用のSecurityGroup作成
    const secgroup01 = new SecurityGroup(this, `${context.AWSENV}-to2go-app-rds-securitygroup`, {
      vpc: vpc,
      securityGroupName: `${context.AWSENV}-to2go-app-rds-securitygroup`,
    });

    //QuickSight用のSecurityGroup作成
    // const secgroup02 = new SecurityGroup(this, `${context.AWSENV}-to2go-quicksight-eni-securitygroup`, {
    //   vpc: vpc,
    //   securityGroupName: `${context.AWSENV}-to2go-quicksight-eni-securitygroup`,
    //   allowAllOutbound: false
    // });

    //RDS用のSecurityGroupにFargateからのIngressルール追加
    // const onlinesgId = cdk.Fn.importValue('online-sg-Id'); //こんな形でSGをimportする
    // const batchsgId = cdk.Fn.importValue('batch-sg-Id');

    secgroup01.addIngressRule(ec2.Peer.ipv4('10.30.0.0/16'), ec2.Port.tcp(3306));
    // secgroup01.addIngressRule(ec2.Peer.securityGroupId(batchsgId),ec2.Port.tcp(3306));

    //QuickSight用のSecurityGroupにRDSからのIngress/Egressルール追加
    // secgroup02.addIngressRule(ec2.Peer.securityGroupId(secgroup01.securityGroupId),ec2.Port.allTcp());
    // secgroup02.addEgressRule(ec2.Peer.securityGroupId(secgroup01.securityGroupId),ec2.Port.tcp(3306));

    //ログローテーション用のIAM Role作成
    // const LogsRetentionRole = new iam.Role(this, 'LogsRetentionRole', {
    //   roleName: `${context.AWSENV}-to2go-CloudWatch-LogsRetentionRole`,
    //   assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    // })

    // const LogsRetentionPolicy = new iam.Policy(this, 'LogsRetentionpolicy', {
    //   statements:[ new iam.PolicyStatement( {
    //      effect: iam.Effect.ALLOW,
    //      actions: ['logs:DeleteRetentionPolicy', 'logs:PutRetentionPolicy', 'logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    //      resources : ["*"],
    //      }),
    //   ],
    // })

    // LogsRetentionRole.attachInlinePolicy(LogsRetentionPolicy)

    //RDS作成
    const dbpw = ssm.StringParameter.valueFromLookup(this, '/to2go/DB_PASSWORD')

    // AuroraMysqlEngineVersion を動的に取得
    const auroraMysqlEngineVersion = (rds.AuroraMysqlEngineVersion as any)[context.RDSVER]; //https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.AuroraMysqlEngineVersion.htmlより指定
    if (!auroraMysqlEngineVersion) {
      throw new Error(`Invalid Aurora MySQL version: ${context.RDSVER}`);
    }

    //開発/STG環境用RDS作成(リードレプリカ無し)
    if (envKey === "dev" || envKey === "stg") {
    const cluster = new rds.DatabaseCluster(this, `${context.AWSENV}-to2go-app-rds-aurora`, {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: auroraMysqlEngineVersion
      }),
      vpc: vpc,
      securityGroups: [secgroup01],
      vpcSubnets: {
          subnets: private_subnet,
      },
      credentials: {
        username: 'admin',
        password : SecretValue.unsafePlainText(dbpw)
      },
      clusterIdentifier: `${context.AWSENV}-to2go-app-rds-cluster`,
      backup: {
        retention: Duration.days(3),//30
      },
      defaultDatabaseName: 'app_development',
      writer: rds.ClusterInstance.provisioned(`Instance1`, {
        instanceType: context.RDSTYPE,
        isFromLegacyInstanceProps: true,
        instanceIdentifier: `${context.AWSENV}-to2go-app-rds-instance1`,
      }),
      parameters: {
        slow_query_log: '1',
        general_log: '1',
        long_query_time: '3',
        log_output: 'FILE',
        server_audit_logging: '1',
        server_audit_events: 'CONNECT,QUERY'
      },
      cloudwatchLogsExports:['error','general','slowquery','audit'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      // cloudwatchLogsRetentionRole: LogsRetentionRole,
      storageEncrypted: true,
      deletionProtection: false,
      iamAuthentication: true,
      preferredMaintenanceWindow: 'Sat:16:00-Sat:16:30',
      removalPolicy: RemovalPolicy.DESTROY,
      subnetGroup: subnetGroup,
      monitoringInterval: cdk.Duration.minutes(1)
    })
    //RDS用のSecurityGroupにQuickSightからのIngressルール追加
    // cluster.connections.allowFrom(secgroup02, ec2.Port.tcp(3306))
    };

    //本番環境用RDS作成(リードレプリカ有り)
    // if (envKey === "prod") {
    // const cluster = new rds.DatabaseCluster(this, `${context.AWSENV}-to2go-app-rds-aurora`, {
      // engine: rds.DatabaseClusterEngine.auroraMysql({
      //   version: auroraMysqlEngineVersion
      // }),
      // vpc: vpc,
      // securityGroups: [secgroup01],
      // vpcSubnets: {
      //     subnets: private_subnet,
      // },
      // credentials: {
      //   username: 'to2goadmin',
      //   password : SecretValue.unsafePlainText(dbpw)
      // },
      // clusterIdentifier: `${context.AWSENV}-to2go-app-rds-cluster`,
      // backup: {
      //   retention: Duration.days(3),//30
      // },
      // defaultDatabaseName: 'to2go',
      // writer: rds.ClusterInstance.provisioned(`Instance1`, {
      //   instanceType: context.RDSTYPE,
      //   isFromLegacyInstanceProps: true,
      //   instanceIdentifier: `${context.AWSENV}-to2go-app-rds-instance1`,
      // }),
      // readers: [
      //   rds.ClusterInstance.provisioned(`${context.AWSENV}-to2go-app-rds-readreplica1`, {
      //     instanceType: context.RDSTYPE,
      //     isFromLegacyInstanceProps: true,
      //     instanceIdentifier: `${context.AWSENV}-to2go-app-rds-readreplica1`,
      //   }),
      // ],
      // parameters: {
      //   slow_query_log: '1',
      //   general_log: '1',
      //   long_query_time: '3',
      //   log_output: 'FILE',
      //   server_audit_logging: '1',
      //   server_audit_events: 'CONNECT,QUERY'
      // },
      // cloudwatchLogsExports:['error','general','slowquery','audit'],
      // cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      // cloudwatchLogsRetentionRole: LogsRetentionRole,
      // storageEncrypted: true,
      // deletionProtection: false,
      // iamAuthentication: true,
      // preferredMaintenanceWindow: 'Sat:16:00-Sat:16:30',
      // removalPolicy: RemovalPolicy.DESTROY,
      // subnetGroup: subnetGroup,
      // monitoringInterval: cdk.Duration.minutes(1)
    // })
    //RDS用のSecurityGroupにQuickSightからのIngressルール追加
    // cluster.connections.allowFrom(secgroup02, ec2.Port.tcp(3306))
    // };
  }
}
